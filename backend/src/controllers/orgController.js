import Organization from '../models/Organization.js';
import AuditLog from '../models/AuditLog.js';

/**
 * Retrieves organization settings (departments, locations, grades) for the tenant.
 * Creates an empty default configuration if it does not exist yet.
 */
export const getOrganization = async (req, res, next) => {
  try {
    let org = await Organization.findOne({ tenantId: req.tenantId });
    
    const defaultLocations = [
      { name: 'Headquarters', address: 'Main Corporate Office Suite', code: 'HQ' },
      { name: 'Remote', address: 'Distributed/Work from Home', code: 'REM' },
    ];
    const defaultDepartments = [
      { name: 'Engineering', code: 'ENG' },
      { name: 'Human Resources', code: 'HR' },
      { name: 'Sales & Marketing', code: 'MKT' },
      { name: 'Finance', code: 'FIN' },
    ];
    const defaultGrades = [
      { name: 'Junior (L1)', level: 1 },
      { name: 'Mid (L2)', level: 2 },
      { name: 'Senior (L3)', level: 3 },
      { name: 'Principal (L4)', level: 4 },
    ];

    if (!org) {
      org = await Organization.create({
        tenantId: req.tenantId,
        locations: defaultLocations,
        departments: defaultDepartments,
        grades: defaultGrades,
      });
    } else {
      let updated = false;
      if (org.locations.length === 0) {
        org.locations = defaultLocations;
        updated = true;
      }
      if (org.departments.length === 0) {
        org.departments = defaultDepartments;
        updated = true;
      }
      if (org.grades.length === 0) {
        org.grades = defaultGrades;
        updated = true;
      }
      if (updated) {
        await org.save();
      }
    }
    return res.status(200).json(org);
  } catch (err) {
    next(err);
  }
};

/**
 * Updates or replaces the organization configuration settings.
 */
export const updateOrganization = async (req, res, next) => {
  try {
    const { locations, departments, grades } = req.body;

    const org = await Organization.findOneAndUpdate(
      { tenantId: req.tenantId },
      { locations, departments, grades },
      { new: true, upsert: true, runValidators: true }
    );

    // Write to security audit log
    await AuditLog.create({
      tenantId: req.tenantId,
      actorId: req.user.id,
      action: 'UPDATE',
      entity: 'ORGANIZATION_CONFIG',
      entityId: org._id,
      details: {
        locationsCount: locations?.length || 0,
        departmentsCount: departments?.length || 0,
        gradesCount: grades?.length || 0,
      },
      ip: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'Server',
    });

    return res.status(200).json(org);
  } catch (err) {
    next(err);
  }
};
