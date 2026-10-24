const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  companyName: { type: String, required: true },
  officeStart: { type: String, default: '09:00' },
  graceMinutes: { type: Number, default: 15 },
  halfDayHours: { type: Number, default: 5 },
  weekend: { type: [String], default: ['Saturday', 'Sunday'] },
  officeLat: { type: Number },
  officeLng: { type: Number },
  officeRadius: { type: Number, default: 150 }, // meters
  leaveTypes: [{
    name: String,
    quota: Number,
    isPaid: { type: Boolean, default: true }
  }],
  createdAt: { type: Date, default: Date.now }
}, { collection: 'settings' });

module.exports = mongoose.model('Settings', settingsSchema);
