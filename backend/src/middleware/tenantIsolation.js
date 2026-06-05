const jwt = require('jsonwebtoken');
const Tenant = require('../models/Tenant');

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token required. Please authenticate.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');
    
    // Inject scope to request context
    req.user = {
      id: decoded.userId,
      tenantId: decoded.tenantId,
      role: decoded.role,
    };
    req.tenantId = decoded.tenantId;

    // Verify tenant status
    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) {
      return res.status(403).json({ error: 'Tenant does not exist.' });
    }
    if (!tenant.isActive) {
      return res.status(403).json({ error: 'Tenant account is suspended. Contact administrator.' });
    }

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Access token expired. Please refresh token.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid or corrupted token.' });
  }
};
