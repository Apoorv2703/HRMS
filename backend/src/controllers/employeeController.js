import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Employee from '../models/Employee.js';
import Tenant from '../models/Tenant.js';
import AuditLog from '../models/AuditLog.js';
import { validatePassword } from '../utils/passwordValidator.js';
import { parseCSV, formatCSV } from '../utils/csv.js';
import { uploadFile, deleteFile } from '../utils/objectStorage.js';

/**
 * Checks for circular reporting up the reporting manager tree.
 * Retuns true if a cycle is detected, false otherwise.
 */
export const hasCircularReporting = async (employeeId, managerId) => {
  if (!managerId) return false;
  
  // An employee cannot report to themselves
  if (employeeId && employeeId.toString() === managerId.toString()) return true;

  const visited = new Set();
  if (employeeId) {
    visited.add(employeeId.toString());
  }

  let currentId = managerId;
  while (currentId) {
    if (visited.has(currentId.toString())) {
      return true; // Cycle detected
    }
    visited.add(currentId.toString());

    const manager = await Employee.findById(currentId);
    if (!manager || !manager.employment || !manager.employment.reportingManagerId) {
      break;
    }
    currentId = manager.employment.reportingManagerId;
  }
  return false;
};

/**
 * Creates user shell and employee invite. Returns an invite link.
 */
export const inviteEmployee = async (req, res, next) => {
  try {
    const { personal, employment, workEmail } = req.body;

    if (!workEmail || !personal?.firstName || !personal?.lastName) {
      return res.status(400).json({ error: 'workEmail, firstName, and lastName are required.' });
    }

    // Ensure email is unique per tenant
    const existingUser = await User.findOne({ tenantId: req.tenantId, email: workEmail.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'Email is already registered for this tenant.' });
    }

    // Auto-generate employeeId if not provided
    let finalEmployeeId = employment?.employeeId;
    if (!finalEmployeeId) {
      const count = await Employee.countDocuments({ tenantId: req.tenantId });
      let index = count + 1;
      let isUnique = false;
      while (!isUnique) {
        finalEmployeeId = `EMP-${String(index).padStart(5, '0')}`;
        const dup = await Employee.findOne({ tenantId: req.tenantId, employeeId: finalEmployeeId });
        if (!dup) {
          isUnique = true;
        } else {
          index++;
        }
      }
    }

    // Ensure employee ID is unique per tenant
    const existingEmp = await Employee.findOne({ tenantId: req.tenantId, employeeId: finalEmployeeId });
    if (existingEmp) {
      return res.status(400).json({ error: 'Employee ID is already registered for this tenant.' });
    }

    // Ensure manager exists
    if (employment.reportingManagerId) {
      const manager = await Employee.findOne({ tenantId: req.tenantId, _id: employment.reportingManagerId });
      if (!manager) {
        return res.status(400).json({ error: 'Reporting manager does not exist.' });
      }
    }

    // Create User record in inactive state
    const user = new User({
      tenantId: req.tenantId,
      email: workEmail.toLowerCase(),
      passwordHash: crypto.randomBytes(32).toString('hex'), // temp random
      role: employment.role || 'EMPLOYEE',
    });
    await user.save();

    // Generate onboarding code (expires in 7 days)
    const inviteCode = crypto.randomBytes(32).toString('hex');
    const inviteExpiresAt = new Date();
    inviteExpiresAt.setDate(inviteExpiresAt.getDate() + 7);

    // Create Employee record
    const employee = new Employee({
      tenantId: req.tenantId,
      userId: user._id,
      employeeId: finalEmployeeId,
      personal: {
        firstName: personal.firstName,
        lastName: personal.lastName,
        dob: personal.dob || null,
        avatarUrl: personal.avatarUrl || null,
        gender: personal.gender || null,
        contactNumber: personal.contactNumber || null,
        personalEmail: personal.personalEmail || null,
        maritalStatus: personal.maritalStatus || null,
        nationality: personal.nationality || null,
        currentAddress: personal.currentAddress || null,
        permanentAddress: personal.permanentAddress || null,
        emergencyContact: personal.emergencyContact || { name: null, relationship: null, phone: null },
      },
      employment: {
        joiningDate: employment.joiningDate || new Date(),
        status: 'PROBATION',
        reportingManagerId: employment.reportingManagerId || null,
        department: employment.department || '',
        designation: employment.designation || '',
        location: employment.location || '',
        grade: employment.grade || '',
        assignedShift: employment.assignedShift || '',
        employmentType: employment.employmentType || 'FULL_TIME',
      },
      professional: {
        education: req.body.professional?.education || [],
        experience: req.body.professional?.experience || [],
        skills: req.body.professional?.skills || [],
        certifications: req.body.professional?.certifications || [],
      },
      inviteCode,
      inviteExpiresAt,
    });
    await employee.save();

    // Log event
    await AuditLog.create({
      tenantId: req.tenantId,
      actorId: req.user.id,
      action: 'EMPLOYEE_INVITE',
      entity: 'EMPLOYEE',
      entityId: employee._id,
      details: { email: workEmail, employeeId: finalEmployeeId },
      ip: req.ip || '127.0.0.1',
      userAgent: req.headers?.['user-agent'] || 'Server',
    });

    return res.status(201).json({
      message: 'Employee onboarding invitation created successfully.',
      inviteCode,
      inviteLink: `http://localhost:5173/onboard?code=${inviteCode}`,
      employee: {
        id: employee._id,
        employeeId: employee.employeeId,
        name: `${employee.personal.firstName} ${employee.personal.lastName}`,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Checks onboarding code validity and returns employee preview details.
 */
export const verifyInviteCode = async (req, res, next) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({ error: 'Invite code is required.' });
    }

    const employee = await Employee.findOne({ inviteCode: code, inviteExpiresAt: { $gt: new Date() } })
      .populate('userId', 'email role');

    if (!employee) {
      return res.status(400).json({ error: 'Invalid or expired onboarding invitation code.' });
    }

    return res.status(200).json({
      firstName: employee.personal.firstName,
      lastName: employee.personal.lastName,
      email: employee.userId.email,
      role: employee.userId.role,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Completes onboarding setup, verifies password policies, and signs login credentials.
 */
export const activateOnboardedEmployee = async (req, res, next) => {
  try {
    const { inviteCode, password } = req.body;
    if (!inviteCode || !password) {
      return res.status(400).json({ error: 'inviteCode and password are required.' });
    }

    const employee = await Employee.findOne({ inviteCode, inviteExpiresAt: { $gt: new Date() } });
    if (!employee) {
      return res.status(400).json({ error: 'Invalid or expired onboarding invitation code.' });
    }

    const user = await User.findById(employee.userId);
    if (!user) {
      return res.status(404).json({ error: 'Associated user account not found.' });
    }

    const tenant = await Tenant.findById(employee.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant context missing.' });
    }

    // Validate password complexity according to tenant policies
    const policy = tenant.settings?.passwordPolicy || { minLength: 8, requireSpecial: true, requireNumbers: true, requireUppercase: true };
    const passValidation = validatePassword(password, policy);
    if (!passValidation.isValid) {
      return res.status(400).json({ error: `Password policy violation: ${passValidation.error}` });
    }

    // Set password hash (pre-save hook will hash this)
    user.passwordHash = password;
    user.passwordChangedAt = new Date();
    await user.save();

    // Mark Employee active
    employee.employment.status = 'ACTIVE';
    employee.inviteCode = null;
    employee.inviteExpiresAt = null;
    await employee.save();

    // Audit log
    await AuditLog.create({
      tenantId: employee.tenantId,
      actorId: user._id,
      action: 'EMPLOYEE_ACTIVATION',
      entity: 'EMPLOYEE',
      entityId: employee._id,
      details: { email: user.email },
      ip: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'Server',
    });

    // Auto log-in: generate token session
    const accessToken = jwt.sign(
      { userId: user._id, tenantId: user.tenantId, role: user.role },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '15m' }
    );
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    if (user.sessions.length >= 5) {
      user.sessions.shift();
    }
    user.sessions.push({
      token: refreshToken,
      expiresAt,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    await user.save();

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      message: 'Account onboarding activated successfully.',
      token: accessToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        mfaEnabled: user.mfaEnabled,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Queries employees with page filters, department, location, and search string.
 * Enforces logical field redactions for regular employees.
 */
export const getDirectory = async (req, res, next) => {
  try {
    const { department, location, search, page = 1, limit = 20 } = req.query;
    const query = { tenantId: req.tenantId };

    if (department) {
      query['employment.department'] = department;
    }
    if (location) {
      query['employment.location'] = location;
    }
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { 'personal.firstName': searchRegex },
        { 'personal.lastName': searchRegex },
        { employeeId: searchRegex },
      ];
    }

    const baseCount = await Employee.countDocuments({ tenantId: req.tenantId });
    if (baseCount === 0) {
      const seedManagers = [
        {
          email: 'manager1@company.com',
          firstName: 'Manager',
          lastName: '1',
          employeeId: 'MGR-001',
          designation: 'Engineering Manager',
          department: 'Engineering',
          location: 'Headquarters',
          grade: 'Senior (L3)',
        },
        {
          email: 'manager2@company.com',
          firstName: 'Manager',
          lastName: '2',
          employeeId: 'MGR-002',
          designation: 'HR Manager',
          department: 'Human Resources',
          location: 'Headquarters',
          grade: 'Senior (L3)',
        },
        {
          email: 'manager3@company.com',
          firstName: 'Manager',
          lastName: '3',
          employeeId: 'MGR-003',
          designation: 'Sales Lead',
          department: 'Sales & Marketing',
          location: 'Remote',
          grade: 'Senior (L3)',
        },
      ];

      for (const m of seedManagers) {
        const user = new User({
          tenantId: req.tenantId,
          email: m.email,
          passwordHash: crypto.randomBytes(32).toString('hex'), // temp
          role: 'MANAGER',
        });
        await user.save();

        const employee = new Employee({
          tenantId: req.tenantId,
          userId: user._id,
          employeeId: m.employeeId,
          personal: {
            firstName: m.firstName,
            lastName: m.lastName,
          },
          employment: {
            joiningDate: new Date(),
            status: 'ACTIVE',
            designation: m.designation,
            department: m.department,
            location: m.location,
            grade: m.grade,
          },
        });
        await employee.save();
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const totalCount = await Employee.countDocuments(query);

    const results = await Employee.find(query)
      .populate('userId', 'email role')
      .populate({
        path: 'employment.reportingManagerId',
        select: 'personal.firstName personal.lastName employeeId',
      })
      .skip(skip)
      .limit(parseInt(limit));

    const isAdminOrLeadership = req.user.role === 'HR_ADMIN' || req.user.role === 'LEADERSHIP';

    // Redact sensitive details for public views
    const sanitizedResults = results.map(emp => {
      const isSelf = emp.userId?._id?.toString() === req.user.id.toString();
      if (isAdminOrLeadership || isSelf) {
        return emp;
      }
      const rawObj = emp.toObject();
      delete rawObj.bankDetails;
      delete rawObj.statutory;
      delete rawObj.documents;
      delete rawObj.pendingChanges;
      delete rawObj.inviteCode;
      delete rawObj.inviteExpiresAt;
      return rawObj;
    });

    return res.status(200).json({
      employees: sanitizedResults,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalCount / parseInt(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Returns a single employee profile. Sanitizes sensitive data if needed.
 */
export const getEmployeeById = async (req, res, next) => {
  try {
    const isMe = req.params.id === 'me';
    const query = isMe 
      ? { tenantId: req.tenantId, userId: req.user.id } 
      : { tenantId: req.tenantId, _id: req.params.id };

    let employee = await Employee.findOne(query)
      .populate('userId', 'email role')
      .populate({
        path: 'employment.reportingManagerId',
        select: 'personal.firstName personal.lastName employeeId',
      });

    if (!employee && isMe) {
      // Auto-create missing Employee profile shell for the logged-in user
      const user = await User.findById(req.user.id);
      if (user) {
        const emailPrefix = user.email.split('@')[0];
        const firstName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
        employee = new Employee({
          tenantId: req.tenantId,
          userId: user._id,
          employeeId: user.role === 'HR_ADMIN' ? 'ADMIN-00001' : `EMP-${Date.now().toString().slice(-5)}`,
          personal: {
            firstName,
            lastName: user.role === 'HR_ADMIN' ? 'Admin' : 'Staff',
            personalEmail: user.email,
          },
          employment: {
            joiningDate: new Date(),
            status: 'ACTIVE',
            department: user.role === 'HR_ADMIN' ? 'Human Resources' : 'General',
            designation: user.role === 'HR_ADMIN' ? 'HR Administrator' : 'Staff Member',
            location: 'HQ',
          }
        });
        await employee.save();
        employee.userId = user; // attach populated object
      }
    }

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    const isAdminOrLeadership = req.user.role === 'HR_ADMIN' || req.user.role === 'LEADERSHIP';
    const isSelf = employee.userId?._id?.toString() === req.user.id.toString();

    if (isAdminOrLeadership || isSelf) {
      return res.status(200).json(employee);
    }

    const rawObj = employee.toObject();
    delete rawObj.bankDetails;
    delete rawObj.statutory;
    delete rawObj.documents;
    delete rawObj.pendingChanges;
    delete rawObj.inviteCode;
    delete rawObj.inviteExpiresAt;

    return res.status(200).json(rawObj);
  } catch (err) {
    next(err);
  }
};

/**
 * Handles profile edits. For regular employees, changes to name, bank, and statutory
 * details are placed in pendingChanges approval buffer.
 */
export const updateProfile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isMe = id === 'me';
    const query = isMe 
      ? { tenantId: req.tenantId, userId: req.user.id } 
      : { tenantId: req.tenantId, _id: id };

    let employee = await Employee.findOne(query);
    if (!employee && isMe) {
      // Auto-create missing Employee profile shell for the logged-in user
      const user = await User.findById(req.user.id);
      if (user) {
        const emailPrefix = user.email.split('@')[0];
        const firstName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
        employee = new Employee({
          tenantId: req.tenantId,
          userId: user._id,
          employeeId: user.role === 'HR_ADMIN' ? 'ADMIN-00001' : `EMP-${Date.now().toString().slice(-5)}`,
          personal: {
            firstName,
            lastName: user.role === 'HR_ADMIN' ? 'Admin' : 'Staff',
            personalEmail: user.email,
          },
          employment: {
            joiningDate: new Date(),
            status: 'ACTIVE',
            department: user.role === 'HR_ADMIN' ? 'Human Resources' : 'General',
            designation: user.role === 'HR_ADMIN' ? 'HR Administrator' : 'Staff Member',
            location: 'HQ',
          }
        });
        await employee.save();
      }
    }

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    const isSelf = employee.userId.toString() === req.user.id.toString();
    const isAdmin = req.user.role === 'HR_ADMIN';

    if (!isSelf && !isAdmin) {
      return res.status(403).json({ error: 'Access denied. You cannot edit this profile.' });
    }

    const { personal, employment, bankDetails, statutory } = req.body;

    if (isAdmin) {
      // HR Admin edits directly
      if (employment?.reportingManagerId) {
        const circular = await hasCircularReporting(employee._id, employment.reportingManagerId);
        if (circular) {
          return res.status(400).json({ error: 'Circular reporting hierarchy detected. An employee cannot report to someone who reports to them.' });
        }
        employee.employment.reportingManagerId = employment.reportingManagerId;
      } else if (employment && 'reportingManagerId' in employment) {
        employee.employment.reportingManagerId = null;
      }

      if (personal) {
        if (personal.firstName) employee.personal.firstName = personal.firstName;
        if (personal.lastName) employee.personal.lastName = personal.lastName;
        if (personal.dob) employee.personal.dob = personal.dob;
        if (personal.avatarUrl) employee.personal.avatarUrl = personal.avatarUrl;
        if (personal.gender) employee.personal.gender = personal.gender;
        if (personal.contactNumber) employee.personal.contactNumber = personal.contactNumber;
        if (personal.personalEmail) employee.personal.personalEmail = personal.personalEmail;
        if (personal.maritalStatus !== undefined) employee.personal.maritalStatus = personal.maritalStatus;
        if (personal.nationality !== undefined) employee.personal.nationality = personal.nationality;
        if (personal.currentAddress !== undefined) employee.personal.currentAddress = personal.currentAddress;
        if (personal.permanentAddress !== undefined) employee.personal.permanentAddress = personal.permanentAddress;
        if (personal.emergencyContact !== undefined) {
          employee.personal.emergencyContact = {
            ...employee.personal.emergencyContact,
            ...personal.emergencyContact,
          };
        }
      }

      if (employment) {
        if (employment.joiningDate) employee.employment.joiningDate = employment.joiningDate;
        if (employment.status) employee.employment.status = employment.status;
        if (employment.department) employee.employment.department = employment.department;
        if (employment.designation) employee.employment.designation = employment.designation;
        if (employment.location) employee.employment.location = employment.location;
        if (employment.grade) employee.employment.grade = employment.grade;
        if (employment.assignedShift !== undefined) employee.employment.assignedShift = employment.assignedShift;
        if (employment.employmentType !== undefined) employee.employment.employmentType = employment.employmentType;
      }

      if (bankDetails) {
        employee.bankDetails = { ...employee.bankDetails, ...bankDetails };
      }

      if (statutory) {
        employee.statutory = { ...employee.statutory, ...statutory };
      }

      if (req.body.professional) {
        if (req.body.professional.education !== undefined) employee.professional.education = req.body.professional.education;
        if (req.body.professional.experience !== undefined) employee.professional.experience = req.body.professional.experience;
        if (req.body.professional.skills !== undefined) employee.professional.skills = req.body.professional.skills;
        if (req.body.professional.certifications !== undefined) employee.professional.certifications = req.body.professional.certifications;
      }

      await employee.save();

      await AuditLog.create({
        tenantId: req.tenantId,
        actorId: req.user.id,
        action: 'EMPLOYEE_UPDATE_DIRECT',
        entity: 'EMPLOYEE',
        entityId: employee._id,
        details: { targetEmployeeId: employee.employeeId },
        ip: req.ip || '127.0.0.1',
        userAgent: req.headers?.['user-agent'] || 'Server',
      });

      return res.status(200).json({ message: 'Employee profile updated successfully by Admin.', employee });
    }

    // Employee updating their own profile
    const sensitiveData = {};
    let hasSensitiveChanges = false;

    if (personal) {
      // Non-sensitive personal details are updated immediately
      if (personal.avatarUrl) employee.personal.avatarUrl = personal.avatarUrl;
      if (personal.contactNumber) employee.personal.contactNumber = personal.contactNumber;
      if (personal.personalEmail) employee.personal.personalEmail = personal.personalEmail;
      if (personal.gender) employee.personal.gender = personal.gender;
      if (personal.dob) employee.personal.dob = personal.dob;
      if (personal.maritalStatus !== undefined) employee.personal.maritalStatus = personal.maritalStatus;
      if (personal.nationality !== undefined) employee.personal.nationality = personal.nationality;
      if (personal.currentAddress !== undefined) employee.personal.currentAddress = personal.currentAddress;
      if (personal.permanentAddress !== undefined) employee.personal.permanentAddress = personal.permanentAddress;
      if (personal.emergencyContact !== undefined) {
        employee.personal.emergencyContact = {
          ...employee.personal.emergencyContact,
          ...personal.emergencyContact,
        };
      }

      // Sensitive names are buffered
      if ((personal.firstName && personal.firstName !== employee.personal.firstName) ||
          (personal.lastName && personal.lastName !== employee.personal.lastName)) {
        sensitiveData.personal = {
          firstName: personal.firstName || employee.personal.firstName,
          lastName: personal.lastName || employee.personal.lastName,
        };
        hasSensitiveChanges = true;
      }
    }

    if (req.body.professional) {
      if (req.body.professional.education !== undefined) employee.professional.education = req.body.professional.education;
      if (req.body.professional.experience !== undefined) employee.professional.experience = req.body.professional.experience;
      if (req.body.professional.skills !== undefined) employee.professional.skills = req.body.professional.skills;
      if (req.body.professional.certifications !== undefined) employee.professional.certifications = req.body.professional.certifications;
    }

    if (bankDetails) {
      const isModified = Object.keys(bankDetails).some(k => bankDetails[k] !== employee.bankDetails[k]);
      if (isModified) {
        sensitiveData.bankDetails = bankDetails;
        hasSensitiveChanges = true;
      }
    }

    if (statutory) {
      const isModified = Object.keys(statutory).some(k => statutory[k] !== employee.statutory[k]);
      if (isModified) {
        sensitiveData.statutory = statutory;
        hasSensitiveChanges = true;
      }
    }

    if (hasSensitiveChanges) {
      employee.pendingChanges = {
        data: sensitiveData,
        requestedAt: new Date(),
        status: 'PENDING',
      };
      await employee.save();

      await AuditLog.create({
        tenantId: req.tenantId,
        actorId: req.user.id,
        action: 'EMPLOYEE_UPDATE_REQUESTED',
        entity: 'EMPLOYEE',
        entityId: employee._id,
        details: { fields: Object.keys(sensitiveData) },
        ip: req.ip || '127.0.0.1',
        userAgent: req.headers?.['user-agent'] || 'Server',
      });

      return res.status(200).json({
        message: 'Immediate fields updated. Sensitive changes require HR Admin approval.',
        pending: true,
        employee,
      });
    }

    await employee.save();
    return res.status(200).json({
      message: 'Profile details updated successfully.',
      pending: false,
      employee,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Retrieves all employees with pending edits (HR Admins only).
 */
export const getPendingEdits = async (req, res, next) => {
  try {
    const list = await Employee.find({
      tenantId: req.tenantId,
      'pendingChanges.status': 'PENDING',
    }).populate('userId', 'email role');

    return res.status(200).json(list);
  } catch (err) {
    next(err);
  }
};

/**
 * Approves or Rejects a pending change request. Merges changes on APPROVE.
 */
export const reviewPendingEdits = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action } = req.body;

    if (!action || !['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ error: 'action must be either APPROVE or REJECT.' });
    }

    const employee = await Employee.findOne({ tenantId: req.tenantId, _id: id });
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    if (!employee.pendingChanges || employee.pendingChanges.status !== 'PENDING') {
      return res.status(400).json({ error: 'No pending profile change request exists.' });
    }

    const changeData = employee.pendingChanges.data;

    if (action === 'APPROVE') {
      if (changeData.personal) {
        if (changeData.personal.firstName) employee.personal.firstName = changeData.personal.firstName;
        if (changeData.personal.lastName) employee.personal.lastName = changeData.personal.lastName;
      }
      if (changeData.bankDetails) {
        employee.bankDetails = { ...employee.bankDetails, ...changeData.bankDetails };
      }
      if (changeData.statutory) {
        employee.statutory = { ...employee.statutory, ...changeData.statutory };
      }

      employee.pendingChanges = {
        data: null,
        requestedAt: null,
        status: 'APPROVED',
      };
      await employee.save();

      await AuditLog.create({
        tenantId: req.tenantId,
        actorId: req.user.id,
        action: 'EMPLOYEE_UPDATE_APPROVED',
        entity: 'EMPLOYEE',
        entityId: employee._id,
        details: { approvedFields: Object.keys(changeData) },
        ip: req.ip || '127.0.0.1',
        userAgent: req.headers?.['user-agent'] || 'Server',
      });

      return res.status(200).json({ message: 'Profile changes approved and applied.', employee });
    } else {
      // REJECT
      employee.pendingChanges = {
        data: null,
        requestedAt: null,
        status: 'REJECTED',
      };
      await employee.save();

      await AuditLog.create({
        tenantId: req.tenantId,
        actorId: req.user.id,
        action: 'EMPLOYEE_UPDATE_REJECTED',
        entity: 'EMPLOYEE',
        entityId: employee._id,
        details: { rejectedFields: Object.keys(changeData) },
        ip: req.ip || '127.0.0.1',
        userAgent: req.headers?.['user-agent'] || 'Server',
      });

      return res.status(200).json({ message: 'Profile changes rejected.', employee });
    }
  } catch (err) {
    next(err);
  }
};

/**
 * Standard termination route. Sets status EXITED and blocks deletion.
 */
export const terminateEmployee = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { exitDate, exitReason } = req.body;

    if (!exitDate || !exitReason) {
      return res.status(400).json({ error: 'exitDate and exitReason are required.' });
    }

    const employee = await Employee.findOne({ tenantId: req.tenantId, _id: id });
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    employee.employment.status = 'EXITED';
    employee.employment.exitDate = new Date(exitDate);
    employee.employment.exitReason = exitReason;
    await employee.save();

    await AuditLog.create({
      tenantId: req.tenantId,
      actorId: req.user.id,
      action: 'EMPLOYEE_TERMINATED',
      entity: 'EMPLOYEE',
      entityId: employee._id,
      details: { exitDate, exitReason, employeeId: employee.employeeId },
      ip: req.ip || '127.0.0.1',
      userAgent: req.headers?.['user-agent'] || 'Server',
    });

    return res.status(200).json({ message: 'Employee terminated successfully.', employee });
  } catch (err) {
    next(err);
  }
};

/**
 * Downloads a CSV record of the tenant directory.
 */
export const exportCSV = async (req, res, next) => {
  try {
    const employees = await Employee.find({ tenantId: req.tenantId }).populate('userId', 'email role');

    const headers = [
      'EmployeeID', 'FirstName', 'LastName', 'WorkEmail', 'Role',
      'Department', 'Designation', 'Location', 'JoiningDate', 'Status',
    ];

    const data = employees.map(emp => ({
      EmployeeID: emp.employeeId,
      FirstName: emp.personal.firstName,
      LastName: emp.personal.lastName,
      WorkEmail: emp.userId?.email || '',
      Role: emp.userId?.role || 'EMPLOYEE',
      Department: emp.employment.department || '',
      Designation: emp.employment.designation || '',
      Location: emp.employment.location || '',
      JoiningDate: emp.employment.joiningDate ? emp.employment.joiningDate.toISOString().split('T')[0] : '',
      Status: emp.employment.status,
    }));

    const csvContent = formatCSV(data, headers);

    res.header('Content-Type', 'text/csv');
    res.attachment('employees.csv');
    return res.status(200).send(csvContent);
  } catch (err) {
    next(err);
  }
};

/**
 * Bulk imports employees from a raw CSV text body.
 */
export const importCSV = async (req, res, next) => {
  try {
    const { csvText } = req.body;
    if (!csvText) {
      return res.status(400).json({ error: 'csvText body parameter is required.' });
    }

    const rows = parseCSV(csvText);
    if (rows.length === 0) {
      return res.status(400).json({ error: 'No records found in CSV content.' });
    }

    const successes = [];
    const failures = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const empId = row.EmployeeID;
      const firstName = row.FirstName;
      const lastName = row.LastName;
      const email = row.WorkEmail;
      const role = row.Role || 'EMPLOYEE';
      const dept = row.Department;
      const desig = row.Designation;
      const loc = row.Location;
      const joining = row.JoiningDate;

      if (!empId || !firstName || !lastName || !email) {
        failures.push({
          row: rowNum,
          email: email || 'UNKNOWN',
          error: 'Missing required fields (EmployeeID, FirstName, LastName, WorkEmail).',
        });
        continue;
      }

      // Check duplicate user email
      const existingUser = await User.findOne({ tenantId: req.tenantId, email: email.toLowerCase() });
      if (existingUser) {
        failures.push({ row: rowNum, email, error: `Email ${email} is already registered.` });
        continue;
      }

      // Check duplicate employee ID
      const existingEmp = await Employee.findOne({ tenantId: req.tenantId, employeeId: empId });
      if (existingEmp) {
        failures.push({ row: rowNum, email, error: `Employee ID ${empId} is already registered.` });
        continue;
      }

      try {
        const user = new User({
          tenantId: req.tenantId,
          email: email.toLowerCase(),
          passwordHash: crypto.randomBytes(32).toString('hex'), // randomize
          role: ['EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'LEADERSHIP'].includes(role) ? role : 'EMPLOYEE',
        });
        await user.save();

        const employee = new Employee({
          tenantId: req.tenantId,
          userId: user._id,
          employeeId: empId,
          personal: {
            firstName,
            lastName,
          },
          employment: {
            joiningDate: joining ? new Date(joining) : new Date(),
            status: 'ACTIVE',
            department: dept || '',
            designation: desig || '',
            location: loc || '',
          },
        });
        await employee.save();

        successes.push({ employeeId: empId, email });
      } catch (err) {
        failures.push({ row: rowNum, email, error: err.message });
      }
    }

    // Write audit log
    await AuditLog.create({
      tenantId: req.tenantId,
      actorId: req.user.id,
      action: 'BULK_EMPLOYEE_IMPORT',
      entity: 'EMPLOYEE',
      details: { successesCount: successes.length, failuresCount: failures.length },
      ip: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'Server',
    });

    return res.status(200).json({
      message: 'CSV bulk import processing completed.',
      total: rows.length,
      successCount: successes.length,
      failureCount: failures.length,
      successes,
      failures,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Uploads a document (ID Proof, Offer Letter, Contract, Certificate) for an employee.
 */
export const uploadDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, type } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    if (!name || !type) {
      return res.status(400).json({ error: 'document name and type are required.' });
    }

    const isMe = id === 'me';
    const query = isMe 
      ? { tenantId: req.tenantId, userId: req.user.id } 
      : { tenantId: req.tenantId, _id: id };

    const employee = await Employee.findOne(query);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    // Access check: only HR_ADMIN or the employee themselves can upload documents
    const isSelf = employee.userId.toString() === req.user.id.toString();
    const isAdmin = req.user.role === 'HR_ADMIN';
    if (!isSelf && !isAdmin) {
      return res.status(403).json({ error: 'Access denied. You cannot upload documents for this employee.' });
    }

    // Upload using storage utility
    const fileUrl = await uploadFile(file, req.tenantId, employee.employeeId);

    // Save document details
    const newDoc = {
      name,
      type,
      fileUrl,
      uploadedAt: new Date(),
    };
    employee.documents.push(newDoc);
    await employee.save();

    // Log event
    await AuditLog.create({
      tenantId: req.tenantId,
      actorId: req.user.id,
      action: 'EMPLOYEE_DOCUMENT_UPLOAD',
      entity: 'EMPLOYEE',
      entityId: employee._id,
      details: { docName: name, docType: type, employeeId: employee.employeeId },
      ip: req.ip || '127.0.0.1',
      userAgent: req.headers?.['user-agent'] || 'Server',
    });

    return res.status(201).json({
      message: 'Document uploaded successfully.',
      document: employee.documents[employee.documents.length - 1]
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Deletes an uploaded document.
 */
export const deleteDocument = async (req, res, next) => {
  try {
    const { id, docId } = req.params;

    const isMe = id === 'me';
    const query = isMe 
      ? { tenantId: req.tenantId, userId: req.user.id } 
      : { tenantId: req.tenantId, _id: id };

    const employee = await Employee.findOne(query);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    // Access check: only HR_ADMIN or the employee themselves can delete documents
    const isSelf = employee.userId.toString() === req.user.id.toString();
    const isAdmin = req.user.role === 'HR_ADMIN';
    if (!isSelf && !isAdmin) {
      return res.status(403).json({ error: 'Access denied. You cannot delete documents for this employee.' });
    }

    // Find target document
    const doc = employee.documents.id(docId);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    // Delete file from S3 or local system
    await deleteFile(doc.fileUrl);

    // Remove from array and save
    employee.documents.pull(docId);
    await employee.save();

    // Log event
    await AuditLog.create({
      tenantId: req.tenantId,
      actorId: req.user.id,
      action: 'EMPLOYEE_DOCUMENT_DELETE',
      entity: 'EMPLOYEE',
      entityId: employee._id,
      details: { docName: doc.name, docType: doc.type, employeeId: employee.employeeId },
      ip: req.ip || '127.0.0.1',
      userAgent: req.headers?.['user-agent'] || 'Server',
    });

    return res.status(200).json({ message: 'Document deleted successfully.' });
  } catch (err) {
    next(err);
  }
};
