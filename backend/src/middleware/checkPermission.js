import Role from '../models/Role.js';
import User from '../models/User.js';

// Static permissions mapping for predefined system roles
const PREDEFINED_PERMISSIONS = {
  EMPLOYEE: [
    'own_profile:read',
    'own_profile:write',
    'attendance:punch',
    'leave:apply',
    'leave:read'
  ],
  MANAGER: [
    'own_profile:read',
    'own_profile:write',
    'attendance:punch',
    'leave:apply',
    'leave:read',
    'team:approve',
    'team:read'
  ],
  HR_ADMIN: ['*'], // Bypass permission granting access to all features
  LEADERSHIP: [
    'own_profile:read',
    'own_profile:write',
    'attendance:punch',
    'leave:apply',
    'leave:read',
    'org_analytics:read'
  ]
};

const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'User context missing. Authentication required.' });
    }

    try {
      // 1. Check if the user is bound to a custom role
      const user = await User.findById(req.user.id).populate('customRole');
      if (!user) {
        return res.status(404).json({ error: 'Authenticated user record not found.' });
      }

      let userPermissions = [];

      if (user.customRole) {
        // Use custom role permissions
        userPermissions = user.customRole.permissions;
      } else {
        // Fallback to static predefined role permissions
        userPermissions = PREDEFINED_PERMISSIONS[user.role] || [];
      }

      // 2. Validate permission matches
      const hasPermission = 
        userPermissions.includes('*') || 
        userPermissions.includes(requiredPermission);

      if (!hasPermission) {
        return res.status(403).json({ 
          error: `Access denied: Missing required permission [${requiredPermission}].` 
        });
      }

      next();
    } catch (err) {
      console.error('Permission validation failure:', err);
      return res.status(500).json({ error: 'Internal server error validating user permissions.' });
    }
  };
};

export default checkPermission;
export { PREDEFINED_PERMISSIONS };
