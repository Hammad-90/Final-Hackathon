const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  date: { type: Date, required: true },
  checkIn: Date,
  checkOut: Date,
  status: { type: String, enum: ['present', 'late', 'half_day', 'absent', 'missing_checkout', 'on_leave'], default: 'present' },
  source: { type: String, enum: ['web', 'camera'], default: 'web' },
  correctionRequested: { type: Boolean, default: false },
  correctionReason: String,
  correctionStatus: { type: String, enum: ['pending', 'approved', 'rejected'] },
  lat: Number,
  lng: Number,
  createdAt: { type: Date, default: Date.now }
});

attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
