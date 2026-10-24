const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema({
  month: { type: String, required: true }, // YYYY-MM
  status: { type: String, enum: ['draft', 'finalized'], default: 'draft' },
  finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  finalizedAt: Date,
  payslips: [{
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    basic: Number,
    hra: Number,
    medical: Number,
    gross: Number,
    deductions: Number,
    tax: Number,
    net: Number,
    workingDays: Number,
    presentDays: Number,
    absentDays: Number,
    halfDays: Number,
    unpaidLeave: Number
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Payroll', payrollSchema);
