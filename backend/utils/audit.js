const AuditLog = require('../models/AuditLog');

const logAudit = async (actor, action, entity, entityId, before, after) => {
  try {
    await AuditLog.create({ actor, action, entity, entityId, before, after });
  } catch (err) {
    console.error('Audit log failed:', err);
  }
};

module.exports = { logAudit };
