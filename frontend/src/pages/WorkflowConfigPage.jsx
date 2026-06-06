import React, { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, Save, Calendar, Clock, AlertTriangle, ShieldCheck, HelpCircle } from 'lucide-react';
import api from '../services/api';

const WorkflowConfigPage = () => {
  const [requestType, setRequestType] = useState('LEAVE');
  const [steps, setSteps] = useState([]);
  const [conditionalRules, setConditionalRules] = useState([]);
  const [slaHours, setSlaHours] = useState(72);
  const [escalationUserId, setEscalationUserId] = useState('');
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchPolicy();
  }, [requestType]);

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/employees', { params: { limit: 150 } });
      const list = res.data?.employees || [];
      // Filter colleagues that have active user accounts
      setEmployees(list.filter(emp => emp.userId && emp.userId._id));
    } catch (err) {
      console.error('Failed to fetch employee list:', err);
    } finally {
      setPageLoading(false);
    }
  };

  const fetchPolicy = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await api.get(`/workflows/policy/${requestType}`);
      const policy = res.data;
      if (policy) {
        setSteps(policy.steps || []);
        setConditionalRules(policy.conditionalRules || []);
        setSlaHours(policy.slaHours || 72);
        setEscalationUserId(policy.escalationUserId || '');
      } else {
        resetToDefault();
      }
    } catch (err) {
      // If 404, reset to default empty state
      if (err.response?.status === 404) {
        resetToDefault();
      } else {
        setError(err.response?.data?.error || 'Failed to retrieve workflow policy.');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetToDefault = () => {
    setSteps([
      { level: 1, approverType: 'MANAGER', approverRole: 'HR_ADMIN', approverRoleId: null, approverUserId: null }
    ]);
    setConditionalRules([]);
    setSlaHours(72);
    setEscalationUserId('');
  };

  const addStep = () => {
    const nextLevel = steps.length > 0 ? Math.max(...steps.map(s => s.level)) + 1 : 1;
    setSteps([
      ...steps,
      { level: nextLevel, approverType: 'MANAGER', approverRole: 'HR_ADMIN', approverRoleId: null, approverUserId: null }
    ]);
  };

  const removeStep = (index) => {
    const updated = steps.filter((_, i) => i !== index);
    // Re-index levels sequentially
    const reindexed = updated.map((step, idx) => ({
      ...step,
      level: idx + 1
    }));
    setSteps(reindexed);
  };

  const updateStepField = (index, field, value) => {
    const updated = [...steps];
    updated[index][field] = value;
    
    // Clear unused fields based on type selection to avoid payload bloat
    if (field === 'approverType') {
      if (value === 'MANAGER') {
        updated[index].approverRole = null;
        updated[index].approverUserId = null;
      } else if (value === 'ROLE') {
        updated[index].approverRole = 'HR_ADMIN';
        updated[index].approverUserId = null;
      } else if (value === 'SPECIFIC_USER') {
        updated[index].approverRole = null;
        // Default to first employee in list if available
        updated[index].approverUserId = employees[0]?.userId?._id || null;
      }
    }
    setSteps(updated);
  };

  const addRule = () => {
    setConditionalRules([
      ...conditionalRules,
      {
        field: 'totalDays',
        operator: 'GT',
        value: 5,
        extraStep: {
          approverType: 'ROLE',
          approverRole: 'HR_ADMIN',
          approverRoleId: null,
          approverUserId: null
        }
      }
    ]);
  };

  const removeRule = (index) => {
    setConditionalRules(conditionalRules.filter((_, i) => i !== index));
  };

  const updateRuleField = (index, field, value) => {
    const updated = [...conditionalRules];
    updated[index][field] = value;
    setConditionalRules(updated);
  };

  const updateRuleExtraStepField = (index, field, value) => {
    const updated = [...conditionalRules];
    updated[index].extraStep[field] = value;
    
    if (field === 'approverType') {
      if (value === 'ROLE') {
        updated[index].extraStep.approverRole = 'HR_ADMIN';
        updated[index].extraStep.approverUserId = null;
      } else if (value === 'SPECIFIC_USER') {
        updated[index].extraStep.approverRole = null;
        updated[index].extraStep.approverUserId = employees[0]?.userId?._id || null;
      }
    }
    setConditionalRules(updated);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (steps.length === 0) {
      setError('You must specify at least one approval level.');
      return;
    }

    try {
      const payload = {
        requestType,
        steps,
        conditionalRules,
        slaHours: Number(slaHours),
        escalationUserId: escalationUserId || null
      };

      const res = await api.post('/workflows/policy', payload);
      setMessage(res.data?.message || 'Workflow configured and updated successfully.');
      fetchPolicy();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update workflow settings.');
    }
  };

  if (pageLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-200">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent"></div>
        <span className="ml-3 font-medium">Loading workflows manager...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-radial from-slate-900 via-slate-950 to-black p-6 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent flex items-center gap-2.5">
              <Settings className="h-7 w-7 text-teal-400" />
              Workflow & Approval Policy Config
            </h1>
            <p className="mt-1 text-slate-400 text-sm">
              Design approval processes per request type, enable SLA timelines, and configure conditional routing overrides.
            </p>
          </div>

          {/* Request Type Selector */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setRequestType('LEAVE')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                requestType === 'LEAVE'
                  ? 'bg-teal-500 text-black shadow shadow-teal-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Leaves (Time Off)
            </button>
            <button
              onClick={() => setRequestType('REGULARIZATION')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                requestType === 'REGULARIZATION'
                  ? 'bg-teal-500 text-black shadow shadow-teal-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Regularizations (Punch Corrections)
            </button>
          </div>
        </div>

        {message && (
          <div className="rounded-xl border border-teal-500/20 bg-teal-500/10 p-4 text-sm text-teal-300">
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent"></div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left Column: Basic Parameters & Conditional Routing */}
            <div className="lg:col-span-1 space-y-6">
              {/* SLA Details Card */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6 backdrop-blur-md shadow-lg space-y-4">
                <h3 className="text-sm font-bold text-teal-400 border-b border-slate-850 pb-2 flex items-center gap-2">
                  <Clock className="h-4.5 w-4.5" /> SLA & Escalation Limits
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      SLA Threshold Limit (Hours)
                    </label>
                    <input
                      type="number"
                      value={slaHours}
                      onChange={(e) => setSlaHours(e.target.value)}
                      min="1"
                      required
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-250 text-slate-250 text-slate-200 outline-none focus:border-teal-500/50"
                    />
                    <span className="block text-[10px] text-slate-500 mt-1">
                      Time frame allowed for each level before automatic escalation triggers.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      SLA Fallback Escalation User
                    </label>
                    <select
                      value={escalationUserId}
                      onChange={(e) => setEscalationUserId(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-200 outline-none focus:border-teal-500/50 cursor-pointer"
                    >
                      <option value="">-- First Active HR_ADMIN (System default) --</option>
                      {employees.map((emp) => (
                        <option key={emp._id} value={emp.userId._id}>
                          {emp.personal?.firstName} {emp.personal?.lastName} ({emp.userId?.email})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Conditional Routing Rules Card */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6 backdrop-blur-md shadow-lg space-y-4">
                <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                  <h3 className="text-sm font-bold text-teal-400 flex items-center gap-2">
                    <AlertTriangle className="h-4.5 w-4.5 text-teal-400" />
                    Conditional Overrides
                  </h3>
                  <button
                    type="button"
                    onClick={addRule}
                    className="flex items-center gap-0.5 text-xs text-teal-400 hover:text-teal-300 font-bold cursor-pointer"
                  >
                    <Plus className="h-3 w-3" /> Add Rule
                  </button>
                </div>

                {conditionalRules.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-xs italic">
                    No conditional overrides added. Routing is purely sequential.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {conditionalRules.map((rule, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-slate-850 bg-slate-900/30 p-4 space-y-3 relative group"
                      >
                        <button
                          type="button"
                          onClick={() => removeRule(idx)}
                          className="absolute top-3 right-3 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>

                        <div className="space-y-2">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Condition {idx + 1}
                          </span>
                          <div className="grid grid-cols-3 gap-2">
                            {/* Field */}
                            <select
                              value={rule.field}
                              onChange={(e) => updateRuleField(idx, 'field', e.target.value)}
                              className="rounded-lg border border-slate-800 bg-slate-950 text-slate-200 text-xs p-2 outline-none"
                            >
                              <option value="totalDays">totalDays (Leaves)</option>
                            </select>

                            {/* Operator */}
                            <select
                              value={rule.operator}
                              onChange={(e) => updateRuleField(idx, 'operator', e.target.value)}
                              className="rounded-lg border border-slate-800 bg-slate-950 text-slate-200 text-xs p-2 outline-none"
                            >
                              <option value="GT">&gt;</option>
                              <option value="LT">&lt;</option>
                              <option value="EQ">=</option>
                            </select>

                            {/* Value */}
                            <input
                              type="number"
                              value={rule.value}
                              onChange={(e) => updateRuleField(idx, 'value', Number(e.target.value))}
                              className="rounded-lg border border-slate-800 bg-slate-950 text-slate-200 text-xs p-2 outline-none"
                            />
                          </div>
                        </div>

                        {/* Extra Step details */}
                        <div className="space-y-2 pt-2 border-t border-slate-850/60">
                          <span className="block text-[10px] font-bold text-teal-400 uppercase tracking-wider">
                            THEN APPEND APPROVAL LEVEL
                          </span>
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={rule.extraStep?.approverType}
                              onChange={(e) => updateRuleExtraStepField(idx, 'approverType', e.target.value)}
                              className="rounded-lg border border-slate-800 bg-slate-950 text-slate-200 text-xs p-2 outline-none cursor-pointer"
                            >
                              <option value="ROLE">Role-based</option>
                              <option value="SPECIFIC_USER">Specific Colleague</option>
                            </select>

                            {rule.extraStep?.approverType === 'ROLE' ? (
                              <select
                                value={rule.extraStep?.approverRole}
                                onChange={(e) => updateRuleExtraStepField(idx, 'approverRole', e.target.value)}
                                className="rounded-lg border border-slate-800 bg-slate-950 text-slate-200 text-xs p-2 outline-none cursor-pointer"
                              >
                                <option value="HR_ADMIN">HR_ADMIN</option>
                                <option value="LEADERSHIP">LEADERSHIP</option>
                                <option value="MANAGER">MANAGER</option>
                              </select>
                            ) : (
                              <select
                                value={rule.extraStep?.approverUserId || ''}
                                onChange={(e) => updateRuleExtraStepField(idx, 'approverUserId', e.target.value)}
                                className="rounded-lg border border-slate-800 bg-slate-950 text-slate-200 text-xs p-2 outline-none cursor-pointer"
                              >
                                {employees.map((emp) => (
                                  <option key={emp._id} value={emp.userId._id}>
                                    {emp.personal?.firstName} {emp.personal?.lastName}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Approval Sequence Flow */}
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6 md:p-8 backdrop-blur-md shadow-lg space-y-6">
                <div className="flex justify-between items-center border-b border-slate-850 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-teal-400" />
                      Approval Flow Sequence
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Configure the sequential checkpoints that submissions must resolve to reach approved state.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={addStep}
                    className="flex items-center gap-1 rounded-xl bg-teal-500/10 hover:bg-teal-500 text-teal-400 hover:text-black border border-teal-500/20 px-3.5 py-2 text-xs font-bold transition cursor-pointer"
                  >
                    <Plus className="h-4 w-4" /> Add Level
                  </button>
                </div>

                {steps.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-850 py-16 text-center text-slate-500 italic text-sm">
                    No approval steps configured. Submissions will auto-approve or fail to route.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {steps.map((step, idx) => (
                      <div
                        key={idx}
                        className="group relative rounded-xl border border-slate-800 bg-slate-900/10 p-5 space-y-4 hover:border-slate-750 transition duration-200"
                      >
                        <div className="flex justify-between items-center">
                          <span className="inline-block rounded-lg bg-teal-500/15 border border-teal-500/30 px-3 py-1 text-xs font-black text-teal-400">
                            LEVEL {step.level}
                          </span>

                          {steps.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeStep(idx)}
                              className="text-slate-500 hover:text-rose-400 transition opacity-0 group-hover:opacity-100 cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                          {/* Approver Type */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-2 text-slate-400">
                              Approver Type
                            </label>
                            <select
                              value={step.approverType}
                              onChange={(e) => updateStepField(idx, 'approverType', e.target.value)}
                              className="w-full rounded-xl border border-slate-800 bg-slate-950 text-slate-100 text-xs p-3 outline-none focus:border-teal-500/50 cursor-pointer"
                            >
                              <option value="MANAGER">Reporting Manager</option>
                              <option value="ROLE">Role-based</option>
                              <option value="SPECIFIC_USER">Specific Colleague</option>
                            </select>
                          </div>

                          {/* Role-based selection (conditional) */}
                          {step.approverType === 'ROLE' && (
                            <div>
                              <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-2 text-slate-400">
                                System Role
                              </label>
                              <select
                                value={step.approverRole || 'HR_ADMIN'}
                                onChange={(e) => updateStepField(idx, 'approverRole', e.target.value)}
                                className="w-full rounded-xl border border-slate-800 bg-slate-950 text-slate-100 text-xs p-3 outline-none focus:border-teal-500/50 cursor-pointer"
                              >
                                <option value="HR_ADMIN">HR_ADMIN</option>
                                <option value="LEADERSHIP">LEADERSHIP</option>
                                <option value="MANAGER">MANAGER</option>
                              </select>
                            </div>
                          )}

                          {/* Specific User selection (conditional) */}
                          {step.approverType === 'SPECIFIC_USER' && (
                            <div className="md:col-span-2">
                              <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-2 text-slate-400">
                                Colleague Contact
                              </label>
                              <select
                                value={step.approverUserId || ''}
                                onChange={(e) => updateStepField(idx, 'approverUserId', e.target.value)}
                                className="w-full rounded-xl border border-slate-800 bg-slate-950 text-slate-100 text-xs p-3 outline-none focus:border-teal-500/50 cursor-pointer"
                              >
                                {employees.map((emp) => (
                                  <option key={emp._id} value={emp.userId._id}>
                                    {emp.personal?.firstName} {emp.personal?.lastName} ({emp.userId?.email})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Save Configurations Footer */}
                <div className="pt-6 border-t border-slate-850 flex justify-end">
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 px-6 py-3 font-bold text-black shadow-lg shadow-teal-500/10 transition cursor-pointer"
                  >
                    <Save className="h-4 w-4" /> Save Workflow Config
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default WorkflowConfigPage;
