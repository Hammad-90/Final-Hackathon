require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hcm-lite')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

// Models
const User = require('./models/User');
const Settings = require('./models/Settings');
const Department = require('./models/Department');
const Designation = require('./models/Designation');
const Employee = require('./models/Employee');
const Attendance = require('./models/Attendance');
const Leave = require('./models/Leave');
const Payroll = require('./models/Payroll');
const Announcement = require('./models/Announcement');
const AuditLog = require('./models/AuditLog');
const AILog = require('./models/AILog');

const { auth, requireRole } = require('./middleware/auth');
const { logAudit } = require('./utils/audit');

// Helper: generate token
const generateToken = (user) => jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

// ============ AUTH ROUTES ============
app.post('/api/auth/first-run', async (req, res) => {
  const settingsCount = await Settings.countDocuments();
  if (settingsCount > 0) return res.status(400).json({ error: 'Already initialized' });

  const { companyName, adminEmail, adminPassword } = req.body;
  if (!companyName || !adminEmail || !adminPassword) return res.status(400).json({ error: 'Missing fields' });

  const settings = await Settings.create({
    companyName,
    leaveTypes: [
      { name: 'annual', quota: 14 },
      { name: 'sick', quota: 8 },
      { name: 'casual', quota: 10 },
      { name: 'unpaid', quota: 999, isPaid: false }
    ]
  });

  const admin = await User.create({
    email: adminEmail,
    password: adminPassword,
    role: 'admin'
  });

  await logAudit(admin._id, 'CREATE', 'Settings', settings._id, null, settings);

  const token = generateToken(admin);
  res.json({ token, user: { id: admin._id, email: admin.email, role: admin.role }, settings });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  if (!user.isActive) return res.status(401).json({ error: 'Account deactivated' });

  const token = generateToken(user);
  res.json({
    token,
    user: { id: user._id, email: user.email, role: user.role, employeeId: user.employeeId, mustChangePassword: user.mustChangePassword }
  });
});

app.post('/api/auth/change-password', auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id);
  if (!(await user.comparePassword(currentPassword))) return res.status(400).json({ error: 'Wrong current password' });

  user.password = newPassword;
  user.mustChangePassword = false;
  await user.save();
  res.json({ message: 'Password changed' });
});

app.get('/api/auth/me', auth, async (req, res) => {
  res.json(req.user);
});

// ============ SETTINGS (Admin) ============
app.get('/api/settings', auth, async (req, res) => {
  const settings = await Settings.findOne();
  res.json(settings);
});

app.put('/api/settings', auth, requireRole('admin'), async (req, res) => {
  const before = await Settings.findOne();
  const settings = await Settings.findOneAndUpdate({}, req.body, { new: true, upsert: true });
  await logAudit(req.user._id, 'UPDATE', 'Settings', settings._id, before, settings);
  res.json(settings);
});

// Departments
app.get('/api/departments', auth, async (req, res) => {
  const depts = await Department.find();
  res.json(depts);
});

app.post('/api/departments', auth, requireRole('admin'), async (req, res) => {
  const dept = await Department.create(req.body);
  await logAudit(req.user._id, 'CREATE', 'Department', dept._id, null, dept);
  res.json(dept);
});

// ============ EMPLOYEES ============
app.post('/api/employees', auth, requireRole('hr', 'admin'), async (req, res) => {
  const { employeeCode, firstName, lastName, email, phone, address, department, designation, joinDate, basicSalary, allowances, gender } = req.body;

  // Create user with temp password
  const tempPassword = Math.random().toString(36).slice(-8);
  const user = await User.create({
    email,
    password: tempPassword,
    role: 'employee',
    mustChangePassword: true
  });

  const employee = await Employee.create({
    employeeCode, userId: user._id, firstName, lastName, email, phone, address,
    department, designation, joinDate, basicSalary, allowances: allowances || 0, gender
  });

  user.employeeId = employee._id;
  await user.save();

  await logAudit(req.user._id, 'CREATE', 'Employee', employee._id, null, employee);

  res.json({ employee, tempPassword });
});

app.get('/api/employees', auth, async (req, res) => {
  let query = {};
  if (req.user.role === 'employee') {
    query._id = req.user.employeeId;
  }
  const employees = await Employee.find(query).populate('department designation');
  res.json(employees);
});

app.get('/api/employees/:id', auth, async (req, res) => {
  if (req.user.role === 'employee' && req.user.employeeId.toString() !== req.params.id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const emp = await Employee.findById(req.params.id).populate('department designation');
  res.json(emp);
});

// ============ ATTENDANCE ============
app.post('/api/attendance/checkin', auth, requireRole('employee'), async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existing = await Attendance.findOne({ employee: req.user.employeeId, date: today });
  if (existing) return res.status(409).json({ error: 'Already checked in today' });

  const settings = await Settings.findOne();
  const now = new Date();
  const [h, m] = (settings?.officeStart || '09:00').split(':').map(Number);
  const grace = settings?.graceMinutes || 15;
  const cutoff = new Date(today);
  cutoff.setHours(h, m + grace, 0, 0);

  let status = now > cutoff ? 'late' : 'present';

  const att = await Attendance.create({
    employee: req.user.employeeId,
    date: today,
    checkIn: now,
    status,
    source: req.body.source || 'web',
    lat: req.body.lat,
    lng: req.body.lng
  });

  res.json(att);
});

app.post('/api/attendance/checkout', auth, requireRole('employee'), async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const att = await Attendance.findOne({ employee: req.user.employeeId, date: today });
  if (!att) return res.status(400).json({ error: 'No check-in today' });
  if (att.checkOut) return res.status(400).json({ error: 'Already checked out' });

  att.checkOut = new Date();
  const hours = (att.checkOut - att.checkIn) / (1000 * 60 * 60);
  const settings = await Settings.findOne();
  if (hours < (settings?.halfDayHours || 5)) {
    att.status = 'half_day';
  }
  await att.save();
  res.json(att);
});

app.get('/api/attendance', auth, async (req, res) => {
  let query = {};
  if (req.user.role === 'employee') query.employee = req.user.employeeId;
  const records = await Attendance.find(query).populate('employee').sort({ date: -1 });
  res.json(records);
});

// ============ LEAVE ============
app.post('/api/leave', auth, requireRole('employee'), async (req, res) => {
  const { type, startDate, endDate, reason } = req.body;
  // Simple working days calc (skip weekends for demo)
  const start = new Date(startDate);
  const end = new Date(endDate);
  let days = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 0 && d.getDay() !== 6) days++;
  }

  const leave = await Leave.create({
    employee: req.user.employeeId,
    type, startDate, endDate, days, reason
  });
  res.json(leave);
});

app.get('/api/leave', auth, async (req, res) => {
  let query = {};
  if (req.user.role === 'employee') query.employee = req.user.employeeId;
  const leaves = await Leave.find(query).populate('employee').sort({ createdAt: -1 });
  res.json(leaves);
});

app.put('/api/leave/:id', auth, requireRole('hr', 'admin'), async (req, res) => {
  const leave = await Leave.findByIdAndUpdate(req.params.id, {
    status: req.body.status,
    comment: req.body.comment,
    approvedBy: req.user._id
  }, { new: true });
  await logAudit(req.user._id, 'UPDATE', 'Leave', leave._id, null, leave);
  res.json(leave);
});

// ============ PAYROLL ============
app.post('/api/payroll', auth, requireRole('hr', 'admin'), async (req, res) => {
  const { month } = req.body; // YYYY-MM
  // Simplified payroll calculation
  const employees = await Employee.find({ status: 'active' });
  const payslips = [];

  for (const emp of employees) {
    const basic = emp.basicSalary;
    const hra = basic * 0.4;
    const medical = basic * 0.1;
    const gross = basic * 1.5;
    // Simplified deductions
    const deductions = 0;
    const tax = 0; // implement slabs later
    const net = gross - deductions - tax;

    payslips.push({
      employee: emp._id,
      basic, hra, medical, gross, deductions, tax, net,
      workingDays: 22, presentDays: 20, absentDays: 2, halfDays: 0, unpaidLeave: 0
    });
  }

  const payroll = await Payroll.create({ month, status: 'draft', payslips });
  await logAudit(req.user._id, 'CREATE', 'Payroll', payroll._id, null, payroll);
  res.json(payroll);
});

app.put('/api/payroll/:id/finalize', auth, requireRole('admin'), async (req, res) => {
  const payroll = await Payroll.findByIdAndUpdate(req.params.id, {
    status: 'finalized',
    finalizedBy: req.user._id,
    finalizedAt: new Date()
  }, { new: true });
  await logAudit(req.user._id, 'FINALIZE', 'Payroll', payroll._id, null, payroll);
  res.json(payroll);
});

app.get('/api/payroll', auth, async (req, res) => {
  const payrolls = await Payroll.find().sort({ createdAt: -1 });
  res.json(payrolls);
});

// ============ AI ASSISTANT ============
app.post('/api/ai/chat', auth, async (req, res) => {
  const { message } = req.body;
  // Simplified: for demo, respond based on keywords or mock tool calling
  // In production, call OpenAI/Groq with tools
  let response = "I'm the HCM Lite AI assistant. Ask me about attendance, leave, or employees (within your access).";

  if (message.toLowerCase().includes('leave') && req.user.role === 'employee') {
    response = "You can apply for leave using the Leave module. Smart leave: describe your need and I'll prefill the form.";
  } else if (message.toLowerCase().includes('salary') && req.user.role === 'employee') {
    response = "Sorry, I cannot share salary information of other employees.";
  }

  await AILog.create({ user: req.user._id, query: message, response });
  res.json({ response, aiGenerated: true });
});

// ============ ANNOUNCEMENTS ============
app.post('/api/announcements', auth, requireRole('admin', 'hr'), async (req, res) => {
  const ann = await Announcement.create({ ...req.body, postedBy: req.user._id });
  res.json(ann);
});

app.get('/api/announcements', auth, async (req, res) => {
  const anns = await Announcement.find().sort({ createdAt: -1 }).limit(10);
  res.json(anns);
});

// ============ DASHBOARDS ============
app.get('/api/dashboard', auth, async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let data = {};
  if (req.user.role === 'admin' || req.user.role === 'hr') {
    const headcount = await Employee.countDocuments({ status: 'active' });
    const present = await Attendance.countDocuments({ date: today, status: { $in: ['present', 'late'] } });
    const onLeave = await Leave.countDocuments({ status: 'approved', startDate: { $lte: today }, endDate: { $gte: today } });
    data = { headcount, present, onLeave, late: 0 };
  } else {
    data = { personal: true, message: 'Personal dashboard' };
  }
  res.json(data);
});

// Audit log (admin only)
app.get('/api/audit', auth, requireRole('admin'), async (req, res) => {
  const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(50).populate('actor', 'email');
  res.json(logs);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
