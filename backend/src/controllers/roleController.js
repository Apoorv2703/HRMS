import Role from '../models/Role.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';

export const createRole = async (req, res) => {
  const { name, permissions } = req.body;

  if (!name || !permissions || !Array.isArray(permissions)) {
    return res.status(400).json({ error: 'Role name and permissions list (array) are required.' });
  }

  try {
    // Check if role name already exists in this tenant
    const existingRole = await Role.findOne({ tenantId: req.tenantId, name: name.trim() });
    if (existingRole) {
      return res.status(400).json({ error: 'A role with this name already exists in your organization.' });
    }

    const newRole = new Role({
      tenantId: req.tenantId,
      name: name.trim(),
      permissions,
    });
    await newRole.save();

    // Log security audit log
    await AuditLog.create({
      tenantId: req.tenantId,
      userId: req.user.id,
      action: 'ROLE_CREATED',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { roleName: name, permissions },
    });

    return res.status(201).json({ message: 'Custom role created successfully.', role: newRole });
  } catch (err) {
    console.error('Create Role Error:', err);
    return res.status(500).json({ error: 'Internal server error during role creation.' });
  }
};

export const getRoles = async (req, res) => {
  try {
    const roles = await Role.find({ tenantId: req.tenantId });
    return res.status(200).json({ roles });
  } catch (err) {
    console.error('Get Roles Error:', err);
    return res.status(500).json({ error: 'Internal server error fetching roles.' });
  }
};

export const updateRole = async (req, res) => {
  const { id } = req.params;
  const { permissions } = req.body;

  if (!permissions || !Array.isArray(permissions)) {
    return res.status(400).json({ error: 'Permissions list (array) is required.' });
  }

  try {
    const role = await Role.findOne({ _id: id, tenantId: req.tenantId });
    if (!role) {
      return res.status(404).json({ error: 'Role not found or outside organization boundaries.' });
    }

    const oldPermissions = role.permissions;
    role.permissions = permissions;
    await role.save();

    // Log security audit log
    await AuditLog.create({
      tenantId: req.tenantId,
      userId: req.user.id,
      action: 'ROLE_UPDATED',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { roleName: role.name, before: oldPermissions, after: permissions },
    });

    return res.status(200).json({ message: 'Role permissions updated successfully.', role });
  } catch (err) {
    console.error('Update Role Error:', err);
    return res.status(500).json({ error: 'Internal server error updating role.' });
  }
};

export const deleteRole = async (req, res) => {
  const { id } = req.params;

  try {
    const role = await Role.findOne({ _id: id, tenantId: req.tenantId });
    if (!role) {
      return res.status(404).json({ error: 'Role not found.' });
    }

    // Check if any user is currently bound to this role
    const userUsingRole = await User.findOne({ tenantId: req.tenantId, customRole: id });
    if (userUsingRole) {
      return res.status(400).json({ error: 'Cannot delete a custom role while users are currently assigned to it.' });
    }

    await Role.deleteOne({ _id: id });

    // Log audit log
    await AuditLog.create({
      tenantId: req.tenantId,
      userId: req.user.id,
      action: 'ROLE_DELETED',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { roleName: role.name },
    });

    return res.status(200).json({ message: 'Custom role deleted successfully.' });
  } catch (err) {
    console.error('Delete Role Error:', err);
    return res.status(500).json({ error: 'Internal server error deleting role.' });
  }
};

export const assignUserRole = async (req, res) => {
  const { userId } = req.params;
  const { customRoleId, systemRole } = req.body;

  try {
    const user = await User.findOne({ _id: userId, tenantId: req.tenantId });
    if (!user) {
      return res.status(404).json({ error: 'User not found in your organization.' });
    }

    const previousRole = { customRole: user.customRole, systemRole: user.role };

    if (customRoleId) {
      // Validate custom role exists in tenant
      const customRole = await Role.findOne({ _id: customRoleId, tenantId: req.tenantId });
      if (!customRole) {
        return res.status(400).json({ error: 'Invalid custom role identifier.' });
      }
      user.customRole = customRoleId;
    } else if (systemRole) {
      // Revert to predefined system role
      const validRoles = ['EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'LEADERSHIP'];
      if (!validRoles.includes(systemRole)) {
        return res.status(400).json({ error: 'Invalid predefined system role.' });
      }
      user.customRole = null;
      user.role = systemRole;
    } else {
      return res.status(400).json({ error: 'Provide either customRoleId or systemRole parameter.' });
    }

    await user.save();

    // Log security audit log
    await AuditLog.create({
      tenantId: req.tenantId,
      userId: req.user.id,
      action: 'USER_ROLE_ASSIGNED',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        targetUserId: userId,
        before: previousRole,
        after: { customRole: user.customRole, systemRole: user.role },
      },
    });

    return res.status(200).json({ message: 'User role updated successfully.', user });
  } catch (err) {
    console.error('Assign User Role Error:', err);
    return res.status(500).json({ error: 'Internal server error assigning user role.' });
  }
};
