const mongoose = require('mongoose');

const aiLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  query: String,
  response: String,
  toolsUsed: [String],
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AILog', aiLogSchema);
