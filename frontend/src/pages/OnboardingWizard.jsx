import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Briefcase, CheckCircle2, Copy, Check, ChevronRight, ChevronLeft, UserPlus, ArrowLeft } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

const OnboardingWizard = () => {
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Wizard active step: 1 (Personal), 2 (Employment), 3 (Completed)
  const [step, setStep] = useState(1);

  // Form inputs
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [nationality, setNationality] = useState('');
  const [currentAddress, setCurrentAddress] = useState('');
  const [permanentAddress, setPermanentAddress] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyRelationship, setEmergencyRelationship] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  const [employeeId, setEmployeeId] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [role, setRole] = useState('EMPLOYEE');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [location, setLocation] = useState('');
  const [grade, setGrade] = useState('');
  const [joiningDate, setJoiningDate] = useState('');
  const [reportingManagerId, setReportingManagerId] = useState('');
  const [assignedShift, setAssignedShift] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [employmentType, setEmploymentType] = useState('FULL_TIME');

  // Dropdowns loading
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [grades, setGrades] = useState([]);
  const [managers, setManagers] = useState([]);
  const [shifts, setShifts] = useState([]);

  // Result info
  const [inviteResult, setInviteResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchMetadata();
  }, []);

  const fetchMetadata = async () => {
    try {
      const orgResponse = await api.get('/organization');
      setDepartments(orgResponse.data.departments || []);
      setLocations(orgResponse.data.locations || []);
      setGrades(orgResponse.data.grades || []);

      // Fetch managers directory (to populate manager selection)
      const empResponse = await api.get('/employees', { params: { limit: 100 } });
      // Filter out exited employees or show all
      setManagers(empResponse.data.employees || []);

      // Fetch active shifts list
      try {
        const shiftResponse = await api.get('/attendance-config/shifts');
        setShifts(shiftResponse.data || []);
      } catch (shiftErr) {
        console.error('Error fetching shifts config', shiftErr);
      }
    } catch (err) {
      console.error('Error fetching org metadata', err);
    }
  };

  const handleNext = () => {
    if (step === 1) {
      if (!firstName || !lastName || !personalEmail) {
        showToast('Please fill in First Name, Last Name, and Personal Email.', 'warning');
        return;
      }
      setStep(2);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!workEmail || !department || !location) {
      showToast('Please fill in Work Email, Department, and Location.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        workEmail,
        personal: {
          firstName,
          lastName,
          dob: dob || undefined,
          gender: gender || undefined,
          contactNumber: contactNumber || undefined,
          personalEmail,
          maritalStatus: maritalStatus || undefined,
          nationality: nationality || undefined,
          currentAddress: currentAddress || undefined,
          permanentAddress: permanentAddress || undefined,
          emergencyContact: {
            name: emergencyName || undefined,
            relationship: emergencyRelationship || undefined,
            phone: emergencyPhone || undefined,
          },
        },
        employment: {
          employeeId: employeeId || undefined,
          role,
          department,
          designation,
          location,
          grade: grade || undefined,
          joiningDate: joiningDate || undefined,
          reportingManagerId: reportingManagerId || undefined,
          assignedShift: assignedShift || undefined,
          shiftId: shiftId || undefined,
          employmentType: employmentType || 'FULL_TIME',
        },
      };

      const response = await api.post('/employees/invite', payload);
      showToast('Onboarding invitation submitted successfully.', 'success');
      setInviteResult(response.data);
      setStep(3);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to submit onboarding invitation.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!inviteResult?.inviteLink) return;
    navigator.clipboard.writeText(inviteResult.inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setPersonalEmail('');
    setContactNumber('');
    setDob('');
    setGender('');
    setMaritalStatus('');
    setNationality('');
    setCurrentAddress('');
    setPermanentAddress('');
    setEmergencyName('');
    setEmergencyRelationship('');
    setEmergencyPhone('');
    setEmployeeId('');
    setWorkEmail('');
    setRole('EMPLOYEE');
    setDepartment('');
    setDesignation('');
    setLocation('');
    setGrade('');
    setJoiningDate('');
    setReportingManagerId('');
    setAssignedShift('');
    setEmploymentType('FULL_TIME');
    setInviteResult(null);
    setStep(1);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900 flex items-center justify-center">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-2xl text-slate-800">
        {/* Back button */}
        {step < 3 && (
          <button
            onClick={() => navigate('/directory')}
            className="mb-6 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 text-slate-500" /> Back to Directory
          </button>
        )}

        <div className="mb-8 text-center">
          <h1 className="bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
            Staff Onboarding Wizard
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">Initialize a new employee profile and trigger credentials setup.</p>
        </div>

        {/* Multi-step Progress Bar */}
        <div className="mb-10 flex items-center justify-center">
          <div className="flex items-center gap-4">
            <div className={`flex h-9 w-9 items-center justify-center rounded-full border-2 font-bold transition duration-300 ${
              step >= 1 ? 'border-teal-500 bg-teal-50 text-teal-600' : 'border-slate-200 bg-slate-50 text-slate-400'
            }`}>
              1
            </div>
            <div className={`h-0.5 w-16 transition duration-300 ${step >= 2 ? 'bg-teal-500' : 'bg-slate-200'}`}></div>
            <div className={`flex h-9 w-9 items-center justify-center rounded-full border-2 font-bold transition duration-300 ${
              step >= 2 ? 'border-teal-500 bg-teal-50 text-teal-600' : 'border-slate-200 bg-slate-50 text-slate-400'
            }`}>
              2
            </div>
            <div className={`h-0.5 w-16 transition duration-300 ${step >= 3 ? 'bg-teal-500' : 'bg-slate-200'}`}></div>
            <div className={`flex h-9 w-9 items-center justify-center rounded-full border-2 font-bold transition duration-300 ${
              step >= 3 ? 'border-teal-500 bg-teal-50 text-teal-600' : 'border-slate-200 bg-slate-50 text-slate-400'
            }`}>
              3
            </div>
          </div>
        </div>

        {/* Step Contents */}
        {step === 1 && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-teal-600 flex items-center gap-2">
              <User className="h-5 w-5 text-teal-500" /> Step 1: Personal Details
            </h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">First Name *</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 placeholder-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">Last Name *</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 placeholder-slate-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">Personal Email *</label>
              <input
                type="email"
                required
                value={personalEmail}
                onChange={(e) => setPersonalEmail(e.target.value)}
                placeholder="john.doe@personal.com"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 placeholder-slate-400"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 cursor-pointer"
                >
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="sm:col-span-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">Date of Birth</label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20"
                />
              </div>

              <div className="sm:col-span-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">Phone Number</label>
                <input
                  type="tel"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="+1 555-0199"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 placeholder-slate-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">Marital Status</label>
                <select
                  value={maritalStatus}
                  onChange={(e) => setMaritalStatus(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 cursor-pointer"
                >
                  <option value="">Select Marital Status</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Divorced">Divorced</option>
                  <option value="Widowed">Widowed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">Nationality</label>
                <input
                  type="text"
                  placeholder="e.g. Indian, American"
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 placeholder-slate-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">Current Address</label>
                <input
                  type="text"
                  placeholder="Street, Apt, City, Country"
                  value={currentAddress}
                  onChange={(e) => setCurrentAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 placeholder-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">Permanent Address</label>
                <input
                  type="text"
                  placeholder="Street, Apt, City, Country"
                  value={permanentAddress}
                  onChange={(e) => setPermanentAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 placeholder-slate-400"
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
              <span className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Emergency Contact Details</span>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Contact Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Jane Doe"
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 placeholder-slate-400 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Relationship</label>
                  <input
                    type="text"
                    placeholder="e.g. Spouse, Parent"
                    value={emergencyRelationship}
                    onChange={(e) => setEmergencyRelationship(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 placeholder-slate-400 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="e.g. +1 555-0155"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 placeholder-slate-400 text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="pt-6 flex justify-end">
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 px-6 py-3 font-bold text-slate-950 shadow-lg shadow-teal-500/10 transition cursor-pointer"
              >
                Next Step <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <h3 className="text-lg font-bold text-teal-600 flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-teal-500" /> Step 2: Employment Profile
            </h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">Employee ID (Optional)</label>
                <input
                  type="text"
                  placeholder="Leave blank to auto-generate"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 placeholder-slate-400"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">Blank will auto-generate format: EMP-00001</span>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">Work Email *</label>
                <input
                  type="email"
                  required
                  placeholder="john@company.com"
                  value={workEmail}
                  onChange={(e) => setWorkEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 placeholder-slate-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">System Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 cursor-pointer"
                >
                  <option value="EMPLOYEE">Employee</option>
                  <option value="MANAGER">Manager</option>
                  <option value="HR_ADMIN">HR Admin</option>
                  <option value="LEADERSHIP">Leadership</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">Department *</label>
                <select
                  required
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 cursor-pointer"
                >
                  <option value="">Select Department</option>
                  {departments.map((d) => (
                    <option key={d.code} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">Designation</label>
                <input
                  type="text"
                  placeholder="e.g. Senior Software Architect"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 placeholder-slate-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">Office Location *</label>
                <select
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 cursor-pointer"
                >
                  <option value="">Select Location</option>
                  {locations.map((l) => (
                    <option key={l.name} value={l.name}>{l.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">Job Grade</label>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 cursor-pointer"
                >
                  <option value="">Select Grade</option>
                  {grades.map((g) => (
                    <option key={g.name} value={g.name}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">Joining Date</label>
                <input
                  type="date"
                  value={joiningDate}
                  onChange={(e) => setJoiningDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">Employment Type</label>
                <select
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 cursor-pointer"
                >
                  <option value="FULL_TIME">Full-time</option>
                  <option value="PART_TIME">Part-time</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="INTERN">Intern</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">Assigned Shift</label>
                <select
                  value={shiftId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setShiftId(id);
                    const match = shifts.find(s => s._id === id);
                    setAssignedShift(match ? match.name : '');
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 cursor-pointer"
                >
                  <option value="">Select Shift</option>
                  {shifts.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.startTime} - {s.endTime})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">Reporting Manager</label>
              <select
                value={reportingManagerId}
                onChange={(e) => setReportingManagerId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 cursor-pointer"
              >
                <option value="">None (Independent / Top Node)</option>
                {managers.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.personal?.firstName} {m.personal?.lastName} ({m.employment?.designation})
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-6 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-55 px-5 py-3 font-semibold text-slate-700 transition cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>

              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-1.5 rounded-xl bg-slate-950 hover:bg-slate-900 px-6 py-3 font-bold text-white disabled:opacity-50 transition cursor-pointer shadow-md"
              >
                {loading ? 'Creating Invitation...' : 'Complete & Generate Link'}
              </button>
            </div>
          </form>
        )}

        {step === 3 && inviteResult && (
          <div className="space-y-6 text-center animate-in zoom-in-95 duration-200">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
              <CheckCircle2 className="h-10 w-10" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-emerald-700">Onboarding Invitation Created!</h3>
              <p className="text-slate-500 text-sm mt-1">
                Profile shell initialized for {firstName} {lastName} (ID: {inviteResult.employee?.employeeId || employeeId}).
              </p>
            </div>

            {/* Invite link card */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 mt-4 shadow-sm">
              <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Onboarding Setup Link</span>
              
              <div className="flex gap-2 items-center bg-slate-50 p-3 rounded-lg border border-slate-250 font-mono text-xs select-all text-slate-800 break-all text-left">
                <span className="flex-1">{inviteResult.inviteLink}</span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="rounded bg-white hover:bg-slate-50 p-1.5 border border-slate-200 text-slate-600 hover:text-slate-900 cursor-pointer transition flex-shrink-0 shadow-sm"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>

              <p className="text-xs text-slate-500 mt-3 text-left">
                Provide this setup link to the employee. They will be directed to set their login password. Setup links expire in 7 days.
              </p>
            </div>

            <div className="pt-8 flex justify-center gap-4">
              <button
                onClick={resetForm}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-5 py-3 font-semibold text-slate-700 hover:text-slate-900 transition cursor-pointer shadow-sm"
              >
                <UserPlus className="h-4 w-4 text-slate-900" />
                Invite Another
              </button>

              <button
                onClick={() => navigate('/directory')}
                className="rounded-xl bg-slate-950 hover:bg-slate-900 text-white px-6 py-3 font-bold cursor-pointer transition shadow-md"
              >
                Back to Directory
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingWizard;
