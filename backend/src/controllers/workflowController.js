import ApprovalPolicy from '../models/ApprovalPolicy.js';
import ApprovalInstance from '../models/ApprovalInstance.js';
import ApprovalDelegation from '../models/ApprovalDelegation.js';
import AuditLog from '../models/AuditLog.js';
import User from '../models/User.js';
import * as workflowEngine from '../utils/workflowEngine.js';

// Configure or update an Approval Policy (HR Admin only)
export const configurePolicy = async (req, res, next) => {
  try {
    const { requestType, steps, conditionalRules, slaHours, escalationUserId } = req.body;

    if (!requestType || !steps || !Array.isArray(steps)) {
      return res.status(400).json({ error: 'requestType and steps array are required.' });
    }

    let policy = await ApprovalPolicy.findOne({ tenantId: req.tenantId, requestType });

    if (policy) {
      policy.steps = steps;
      policy.conditionalRules = conditionalRules || [];
      policy.slaHours = slaHours !== undefined ? Number(slaHours) : 72;
      policy.escalationUserId = escalationUserId || null;
      await policy.save();
    } else {
      policy = new ApprovalPolicy({
        tenantId: req.tenantId,
        requestType,
        steps,
        conditionalRules: conditionalRules || [],
        slaHours: slaHours !== undefined ? Number(slaHours) : 72,
        escalationUserId: escalationUserId || null,
      });
      await policy.save();
    }

    await AuditLog.create({
      tenantId: req.tenantId,
      actorId: req.user.id,
      action: 'WORKFLOW_POLICY_CONFIGURE',
      entity: 'APPROVAL_POLICY',
      entityId: policy._id,
      details: { requestType, stepsCount: steps.length },
      ip: req.ip || '127.0.0.1',
      userAgent: req.headers?.['user-agent'] || 'Server',
    });

    return res.status(200).json({ message: 'Approval policy configured successfully.', policy });
  } catch (err) {
    next(err);
  }
};

// Fetch Approval Policy (HR Admin)
export const getPolicy = async (req, res, next) => {
  try {
    const { requestType } = req.params;
    const policy = await ApprovalPolicy.findOne({ tenantId: req.tenantId, requestType });
    if (!policy) {
      return res.status(404).json({ error: 'No approval policy found for this request type.' });
    }
    return res.status(200).json(policy);
  } catch (err) {
    next(err);
  }
};

// Create an approval delegation profile (All Users)
export const createDelegation = async (req, res, next) => {
  try {
    const { delegateeId, startDate, endDate, deactivate } = req.body;

    if (deactivate) {
      await ApprovalDelegation.updateMany(
        { tenantId: req.tenantId, delegatorId: req.user.id, isActive: true },
        { isActive: false }
      );

      await AuditLog.create({
        tenantId: req.tenantId,
        actorId: req.user.id,
        action: 'WORKFLOW_DELEGATION_DEACTIVATE',
        entity: 'APPROVAL_DELEGATION',
        details: { cancelledByRequest: true },
        ip: req.ip || '127.0.0.1',
        userAgent: req.headers?.['user-agent'] || 'Server',
      });

      return res.status(200).json({ message: 'Delegations deactivated successfully.' });
    }

    if (!delegateeId || !startDate || !endDate) {
      return res.status(400).json({ error: 'delegateeId, startDate, and endDate are required.' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      return res.status(400).json({ error: 'startDate cannot be after endDate.' });
    }

    // Verify delegatee exists
    const delegatee = await User.findOne({ tenantId: req.tenantId, _id: delegateeId });
    if (!delegatee) {
      return res.status(404).json({ error: 'Delegatee user not found in this tenant.' });
    }

    // Deactivate previous active delegations for this delegator
    await ApprovalDelegation.updateMany(
      { tenantId: req.tenantId, delegatorId: req.user.id, isActive: true },
      { isActive: false }
    );

    const delegation = new ApprovalDelegation({
      tenantId: req.tenantId,
      delegatorId: req.user.id,
      delegateeId,
      startDate: start,
      endDate: end,
      isActive: true,
    });
    await delegation.save();

    await AuditLog.create({
      tenantId: req.tenantId,
      actorId: req.user.id,
      action: 'WORKFLOW_DELEGATION_CREATE',
      entity: 'APPROVAL_DELEGATION',
      entityId: delegation._id,
      details: { delegateeId },
      ip: req.ip || '127.0.0.1',
      userAgent: req.headers?.['user-agent'] || 'Server',
    });

    return res.status(201).json({ message: 'Delegation registered successfully.', delegation });
  } catch (err) {
    next(err);
  }
};

// Retrieve active delegations
export const getActiveDelegations = async (req, res, next) => {
  try {
    const delegations = await ApprovalDelegation.find({
      tenantId: req.tenantId,
      delegatorId: req.user.id,
      isActive: true,
    }).populate('delegateeId', 'email role');

    return res.status(200).json(delegations);
  } catch (err) {
    next(err);
  }
};

// Review request workflow (Approvers / Delegatees)
export const reviewRequestWorkflow = async (req, res, next) => {
  try {
    const { id: requestId } = req.params;
    const { action, comment } = req.body;

    if (!action || !['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ error: 'action must be either APPROVE or REJECT.' });
    }

    const instance = await workflowEngine.processAction(
      req.tenantId,
      requestId,
      req.user.id,
      action,
      comment
    );

    return res.status(200).json({
      message: `Request successfully ${action === 'APPROVE' ? 'approved' : 'rejected'} in workflow.`,
      instance,
    });
  } catch (err) {
    next(err);
  }
};

// Retrieve workflow instance history and details
export const getWorkflowHistory = async (req, res, next) => {
  try {
    const { id: requestId } = req.params;
    const instance = await ApprovalInstance.findOne({
      tenantId: req.tenantId,
      requestId,
    }).populate('activeApproverId', 'email role')
      .populate('history.actedBy', 'email role')
      .populate('compiledApprovers.userId', 'email role');

    if (!instance) {
      return res.status(404).json({ error: 'No active approval workflow runs for this request.' });
    }

    return res.status(200).json(instance);
  } catch (err) {
    next(err);
  }
};

// Daemon trigger endpoint to manually check breaches during test/cron
export const runSlaCron = async (req, res, next) => {
  try {
    const processed = await workflowEngine.checkSlaBreaches();
    return res.status(200).json({ message: 'SLA checker cron run complete.', processedCount: processed });
  } catch (err) {
    next(err);
  }
};
