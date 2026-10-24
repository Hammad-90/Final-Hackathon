const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  employeeCode: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: String,
  address: String,
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  designation: { type: mongoose.Schema.Types.ObjectId, ref: 'Designation' },
  joinDate: { type: Date, required: true },
  basicSalary: { type: Number, required: true },
  allowances: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'probation', 'inactive'], default: 'active' },
  gender: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Employee', employeeSchema);
