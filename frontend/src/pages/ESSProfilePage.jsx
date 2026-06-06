import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { User, Briefcase, Landmark, ShieldAlert, Check, X, ClipboardList, AlertCircle, Save, GraduationCap, Award, Plus, Trash2, FileText, UploadCloud, ExternalLink, Download, DollarSign, UserCheck, Bell } from 'lucide-react';
import api, { BASE_BACKEND_URL } from '../services/api';
import DelegationSettings from '../components/DelegationSettings';
import NotificationPreferences from '../components/NotificationPreferences';

const ESSProfilePage = () => {
  const { user } = useSelector((state) => state.auth);
  const [searchParams] = useSearchParams();

  // If query ?id=XYZ exists, load that profile (Admin viewing someone else)
  // Otherwise default to 'me'
  const profileId = searchParams.get('id') || 'me';

  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('personal');

  // Input states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [gender, setGender] = useState('');
  const [dob, setDob] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [nationality, setNationality] = useState('');
  const [currentAddress, setCurrentAddress] = useState('');
  const [permanentAddress, setPermanentAddress] = useState('');
  const [assignedShift, setAssignedShift] = useState('');
  const [employmentType, setEmploymentType] = useState('FULL_TIME');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyRelationship, setEmergencyRelationship] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  // Professional History states
  const [educationList, setEducationList] = useState([]);
  const [experienceList, setExperienceList] = useState([]);
  const [skillsList, setSkillsList] = useState([]);
  const [certificationsList, setCertificationsList] = useState([]);

  // Subform inputs states
  const [skillInput, setSkillInput] = useState('');
  const [newInst, setNewInst] = useState('');
  const [newDegree, setNewDegree] = useState('');
  const [newField, setNewField] = useState('');
  const [newStartYr, setNewStartYr] = useState('');
  const [newEndYr, setNewEndYr] = useState('');
  
  const [newCompany, setNewCompany] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newExpStart, setNewExpStart] = useState('');
  const [newExpEnd, setNewExpEnd] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const [newCertName, setNewCertName] = useState('');
  const [newIssuer, setNewIssuer] = useState('');
  const [newIssueDate, setNewIssueDate] = useState('');
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [newCredId, setNewCredId] = useState('');

  // Employment (Read-only for normal employees, editable for Admin)
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [location, setLocation] = useState('');
  const [grade, setGrade] = useState('');
  const [reportingManagerId, setReportingManagerId] = useState('');
  const [managers, setManagers] = useState([]);

  // Bank & Statutory
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [pan, setPan] = useState('');
  const [uan, setUan] = useState('');
  const [pfNumber, setPfNumber] = useState('');
  const [esiNumber, setEsiNumber] = useState('');
  const [ssn, setSsn] = useState('');

  // HR Review Tab state
  const [pendingRequests, setPendingRequests] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);

  // Document storage states
  const [docFile, setDocFile] = useState(null);
  const [docName, setDocName] = useState('');
  const [docType, setDocType] = useState('ID_PROOF');
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Payslips states
  const [payslips, setPayslips] = useState([]);
  const [payslipsLoading, setPayslipsLoading] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState(null);

  // HR Admin payslip generation states
  const [genMonth, setGenMonth] = useState(new Date().getMonth() + 1);
  const [genYear, setGenYear] = useState(new Date().getFullYear());
  const [genBasic, setGenBasic] = useState('');
  const [genAllowances, setGenAllowances] = useState('');
  const [genDeductions, setGenDeductions] = useState('');
  const [genLoading, setGenLoading] = useState(false);

  const isAdmin = user?.role === 'HR_ADMIN';

  useEffect(() => {
    fetchProfile();
    if (isAdmin) {
      fetchPendingRequests();
      fetchManagers();
    }
  }, [profileId]);

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/employees/${profileId}`);
      const emp = response.data;
      setEmployee(emp);

      // Map values to fields
      setFirstName(emp.personal?.firstName || '');
      setLastName(emp.personal?.lastName || '');
      setContactNumber(emp.personal?.contactNumber || '');
      setPersonalEmail(emp.personal?.personalEmail || '');
      setGender(emp.personal?.gender || '');
      setAvatarUrl(emp.personal?.avatarUrl || '');
      setMaritalStatus(emp.personal?.maritalStatus || '');
      setNationality(emp.personal?.nationality || '');
      setCurrentAddress(emp.personal?.currentAddress || '');
      setPermanentAddress(emp.personal?.permanentAddress || '');
      setEmergencyName(emp.personal?.emergencyContact?.name || '');
      setEmergencyRelationship(emp.personal?.emergencyContact?.relationship || '');
      setEmergencyPhone(emp.personal?.emergencyContact?.phone || '');
      if (emp.personal?.dob) {
        setDob(emp.personal.dob.split('T')[0]);
      }

      setDepartment(emp.employment?.department || '');
      setDesignation(emp.employment?.designation || '');
      setLocation(emp.employment?.location || '');
      setGrade(emp.employment?.grade || '');
      setReportingManagerId(emp.employment?.reportingManagerId?._id || emp.employment?.reportingManagerId || '');
      setAssignedShift(emp.employment?.assignedShift || '');
      setEmploymentType(emp.employment?.employmentType || 'FULL_TIME');

      setAccountHolderName(emp.bankDetails?.accountHolderName || '');
      setAccountNumber(emp.bankDetails?.accountNumber || '');
      setBankName(emp.bankDetails?.bankName || '');
      setIfscCode(emp.bankDetails?.ifscCode || '');
      setPan(emp.bankDetails?.pan || '');

      setUan(emp.statutory?.uan || '');
      setPfNumber(emp.statutory?.pfNumber || '');
      setEsiNumber(emp.statutory?.esiNumber || '');
      setSsn(emp.statutory?.ssn || '');

      setEducationList(emp.professional?.education || []);
      setExperienceList(emp.professional?.experience || []);
      setSkillsList(emp.professional?.skills || []);
      setCertificationsList(emp.professional?.certifications || []);
      
      // Load payslips list for this employee
      fetchPayslips(emp._id);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to retrieve employee profile data.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPayslips = async (empId) => {
    setPayslipsLoading(true);
    try {
      let response;
      if (profileId === 'me') {
        response = await api.get('/payslips/mine');
      } else {
        response = await api.get(`/payslips/employee/${empId}`);
      }
      setPayslips(response.data || []);
    } catch (err) {
      console.error('Failed to load payslips list', err);
    } finally {
      setPayslipsLoading(false);
    }
  };

  const handleGeneratePayslip = async (e) => {
    e.preventDefault();
    if (!genMonth || !genYear || !genBasic) {
      alert('Month, Year, and Basic Salary are required.');
      return;
    }
    setGenLoading(true);
    try {
      const response = await api.post('/payslips', {
        employeeId: employee._id,
        month: Number(genMonth),
        year: Number(genYear),
        basicSalary: Number(genBasic),
        allowances: Number(genAllowances) || 0,
        deductions: Number(genDeductions) || 0,
      });
      alert(response.data.message || 'Payslip generated successfully.');
      fetchPayslips(employee._id);
      
      // Reset inputs
      setGenBasic('');
      setGenAllowances('');
      setGenDeductions('');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to generate payslip.');
    } finally {
      setGenLoading(false);
    }
  };

  const fetchManagers = async () => {
    try {
      const response = await api.get('/employees', { params: { limit: 100 } });
      setManagers(response.data.employees || []);
    } catch (err) {
      console.error('Failed to load managers directory', err);
    }
  };

  const fetchPendingRequests = async () => {
    setPendingLoading(true);
    try {
      const response = await api.get('/employees/pending-edits');
      setPendingRequests(response.data || []);
    } catch (err) {
      console.error('Failed to retrieve pending review requests', err);
    } finally {
      setPendingLoading(false);
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        personal: {
          firstName,
          lastName,
          contactNumber,
          personalEmail,
          gender,
          avatarUrl,
          dob: dob || undefined,
          maritalStatus,
          nationality,
          currentAddress,
          permanentAddress,
          emergencyContact: {
            name: emergencyName,
            relationship: emergencyRelationship,
            phone: emergencyPhone,
          },
        },
        bankDetails: {
          accountHolderName,
          accountNumber,
          bankName,
          ifscCode,
          pan,
        },
        statutory: {
          uan,
          pfNumber,
          esiNumber,
          ssn,
        },
        professional: {
          education: educationList,
          experience: experienceList,
          skills: skillsList,
          certifications: certificationsList,
        },
      };

      if (isAdmin) {
        payload.employment = {
          department,
          designation,
          location,
          grade,
          reportingManagerId: reportingManagerId || null,
          assignedShift: assignedShift || '',
          employmentType: employmentType || 'FULL_TIME',
        };
      }

      const response = await api.put(`/employees/${profileId}`, payload);
      alert(response.data.message);
      fetchProfile();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update profile.');
    }
  };

  const handleReviewRequest = async (empId, action) => {
    try {
      const response = await api.post(`/employees/${empId}/review-edits`, { action });
      alert(response.data.message);
      fetchPendingRequests();
      if (empId === employee?._id || profileId === 'me') {
        fetchProfile();
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to process pending request.');
    }
  };

  const getDocumentUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${BASE_BACKEND_URL}${url}`;
  };

  const handleDocumentUpload = async (e) => {
    e.preventDefault();
    if (!docFile) {
      alert('Please select a file to upload.');
      return;
    }
    setUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append('file', docFile);
      formData.append('name', docName);
      formData.append('type', docType);

      const response = await api.post(`/employees/${profileId}/documents`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      alert(response.data.message || 'Document uploaded successfully.');
      setDocFile(null);
      setDocName('');
      setDocType('ID_PROOF');
      fetchProfile();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to upload document.');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDocumentDelete = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return;
    }
    try {
      const response = await api.delete(`/employees/${profileId}/documents/${docId}`);
      alert(response.data.message || 'Document deleted successfully.');
      fetchProfile();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete document.');
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-200">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent"></div>
        <span className="ml-3 font-medium">Loading profile context...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 p-6 flex items-center justify-center">
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-center max-w-md">
          <ShieldAlert className="mx-auto mb-2 h-10 w-10 text-rose-400" />
          <p className="font-semibold text-rose-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-radial from-slate-900 via-slate-950 to-black p-6 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
              {profileId === 'me' ? 'My Profile Self-Service' : `${employee?.personal?.firstName}'s Profile`}
            </h1>
            <p className="mt-1 text-slate-400 text-sm">
              Manage personal details, verify banking accounts, and check statutory parameters.
            </p>
          </div>

          <div className="rounded-xl bg-slate-900 px-4 py-2 border border-slate-800 font-mono text-xs flex flex-col items-end">
            <span className="text-slate-500">Employee ID</span>
            <span className="text-teal-400 font-semibold tracking-wider">{employee?.employeeId}</span>
          </div>
        </div>

        {/* Pending Approval Banner */}
        {employee?.pendingChanges?.status === 'PENDING' && (
          <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 flex items-start gap-3 text-amber-300">
            <AlertCircle className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm">Profile Updates Pending Review</p>
              <p className="text-xs text-amber-400/80 mt-1">
                You have updated sensitive details. These adjustments are buffered and will apply as soon as an HR Administrator reviews and approves them.
              </p>
            </div>
          </div>
        )}

        {/* Tab Controls */}
        <div className="mb-6 border-b border-slate-800 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('personal')}
            className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm border-b-2 transition cursor-pointer ${
              activeTab === 'personal' ? 'border-teal-500 text-teal-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="h-4 w-4" /> Personal Info
          </button>

          <button
            onClick={() => setActiveTab('employment')}
            className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm border-b-2 transition cursor-pointer ${
              activeTab === 'employment' ? 'border-teal-500 text-teal-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Briefcase className="h-4 w-4" /> Job Details
          </button>

          <button
            onClick={() => setActiveTab('professional')}
            className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm border-b-2 transition cursor-pointer ${
              activeTab === 'professional' ? 'border-teal-500 text-teal-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <GraduationCap className="h-4 w-4" /> Professional History
          </button>

          {(isAdmin || profileId === 'me' || employee?.userId?._id === user?.id) && (
            <button
              onClick={() => setActiveTab('finance')}
              className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm border-b-2 transition cursor-pointer ${
                activeTab === 'finance' ? 'border-teal-500 text-teal-400' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Landmark className="h-4 w-4" /> Bank & Statutory
            </button>
          )}

          {(isAdmin || user?.role === 'LEADERSHIP' || profileId === 'me' || employee?.userId?._id === user?.id) && (
            <button
              onClick={() => setActiveTab('documents')}
              className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm border-b-2 transition cursor-pointer ${
                activeTab === 'documents' ? 'border-teal-500 text-teal-400' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="h-4 w-4" /> Documents & Files
            </button>
          )}

          {(isAdmin || user?.role === 'LEADERSHIP' || profileId === 'me' || employee?.userId?._id === user?.id) && (
            <button
              onClick={() => setActiveTab('payslips')}
              className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm border-b-2 transition cursor-pointer ${
                activeTab === 'payslips' ? 'border-teal-500 text-teal-400' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <DollarSign className="h-4 w-4" /> Payslips & Salary
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => { setActiveTab('review'); fetchPendingRequests(); }}
              className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm border-b-2 transition cursor-pointer ${
                activeTab === 'review' ? 'border-teal-500 text-teal-400' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <ClipboardList className="h-4 w-4" /> Review Requests ({pendingRequests.length})
            </button>
          )}

          {profileId === 'me' && (
            <button
              onClick={() => setActiveTab('delegation')}
              className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm border-b-2 transition cursor-pointer ${
                activeTab === 'delegation' ? 'border-teal-500 text-teal-400' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserCheck className="h-4 w-4" /> Delegation Settings
            </button>
          )}

          {profileId === 'me' && (
            <button
              onClick={() => setActiveTab('notifications')}
              className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm border-b-2 transition cursor-pointer ${
                activeTab === 'notifications' ? 'border-teal-500 text-teal-400' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bell className="h-4 w-4" /> Notification Preferences
            </button>
          )}
        </div>

        {/* Form Container */}
        {activeTab !== 'review' && activeTab !== 'documents' && activeTab !== 'payslips' && activeTab !== 'delegation' && activeTab !== 'notifications' && (
          <form onSubmit={handleProfileSubmit} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6 md:p-8 backdrop-blur-md shadow-lg space-y-6">
            {activeTab === 'personal' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">First Name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-200 outline-none focus:border-teal-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Last Name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-200 outline-none focus:border-teal-500/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Phone Contact</label>
                    <input
                      type="text"
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-200 outline-none focus:border-teal-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Personal Email</label>
                    <input
                      type="email"
                      value={personalEmail}
                      onChange={(e) => setPersonalEmail(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-200 outline-none focus:border-teal-500/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Gender</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-200 outline-none focus:border-teal-500/50 cursor-pointer"
                    >
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Date of Birth</label>
                    <input
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-200 outline-none focus:border-teal-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Avatar URL</label>
                    <input
                      type="text"
                      placeholder="https://image-url"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-200 outline-none focus:border-teal-500/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Marital Status</label>
                    <select
                      value={maritalStatus}
                      onChange={(e) => setMaritalStatus(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-200 outline-none focus:border-teal-500/50 cursor-pointer"
                    >
                      <option value="">Select Marital Status</option>
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Divorced">Divorced</option>
                      <option value="Widowed">Widowed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Nationality</label>
                    <input
                      type="text"
                      placeholder="e.g. Indian, American"
                      value={nationality}
                      onChange={(e) => setNationality(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-200 outline-none focus:border-teal-500/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Current Address</label>
                    <input
                      type="text"
                      placeholder="Street, Apt, City, Country"
                      value={currentAddress}
                      onChange={(e) => setCurrentAddress(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-200 outline-none focus:border-teal-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Permanent Address</label>
                    <input
                      type="text"
                      placeholder="Street, Apt, City, Country"
                      value={permanentAddress}
                      onChange={(e) => setPermanentAddress(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-200 outline-none focus:border-teal-500/50"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-4 space-y-4">
                  <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Emergency Contact Details</span>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Contact Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Jane Doe"
                        value={emergencyName}
                        onChange={(e) => setEmergencyName(e.target.value)}
                        className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-200 outline-none focus:border-teal-500/50 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Relationship</label>
                      <input
                        type="text"
                        placeholder="e.g. Spouse, Parent"
                        value={emergencyRelationship}
                        onChange={(e) => setEmergencyRelationship(e.target.value)}
                        className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-200 outline-none focus:border-teal-500/50 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Phone Number</label>
                      <input
                        type="tel"
                        placeholder="e.g. +1 555-0155"
                        value={emergencyPhone}
                        onChange={(e) => setEmergencyPhone(e.target.value)}
                        className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-200 outline-none focus:border-teal-500/50 text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'professional' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* SKILLS SECTION */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-6 space-y-4">
                  <h3 className="text-sm font-bold text-teal-400 border-b border-slate-850 pb-2 flex items-center gap-2">
                    <Award className="h-4 w-4 text-teal-400" /> Core Skills & Technologies
                  </h3>
                  
                  <div className="flex flex-wrap gap-2 min-h-[40px] p-2 rounded-xl bg-slate-900/40 border border-slate-800/80">
                    {skillsList.length === 0 ? (
                      <span className="text-slate-500 text-xs italic self-center">No skills added yet. Add some below!</span>
                    ) : (
                      skillsList.map((skill, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 rounded-lg bg-teal-500/10 border border-teal-500/20 px-2.5 py-1 text-xs font-medium text-teal-400 animate-in zoom-in-95 duration-100">
                          {skill}
                          <button
                            type="button"
                            onClick={() => setSkillsList(skillsList.filter((_, i) => i !== idx))}
                            className="text-teal-500 hover:text-teal-300 font-bold ml-1 cursor-pointer"
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. React, Node.js, Python, Project Management"
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (skillInput.trim()) {
                            setSkillsList([...skillsList, skillInput.trim()]);
                            setSkillInput('');
                          }
                        }
                      }}
                      className="flex-1 rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-200 text-xs outline-none focus:border-teal-500/50"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (skillInput.trim()) {
                          setSkillsList([...skillsList, skillInput.trim()]);
                          setSkillInput('');
                        }
                      }}
                      className="rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-2 border border-slate-700 text-slate-200 text-xs font-semibold cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add
                    </button>
                  </div>
                </div>

                {/* EDUCATION SECTION */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-6 space-y-4">
                  <h3 className="text-sm font-bold text-teal-400 border-b border-slate-850 pb-2 flex items-center gap-2">
                    <GraduationCap className="h-4.5 w-4.5 text-teal-400" /> Education History
                  </h3>

                  {educationList.length > 0 && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {educationList.map((edu, idx) => (
                        <div key={idx} className="group relative rounded-xl border border-slate-850 bg-slate-900/40 p-4 hover:border-slate-800 transition duration-200 animate-in zoom-in-95">
                          <button
                            type="button"
                            onClick={() => setEducationList(educationList.filter((_, i) => i !== idx))}
                            className="absolute top-4 right-4 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <h4 className="font-bold text-sm text-slate-200">{edu.degree} in {edu.fieldOfStudy}</h4>
                          <p className="text-xs text-teal-400 mt-0.5">{edu.institution}</p>
                          <p className="text-[10px] text-slate-500 font-mono mt-2">{edu.startYear} — {edu.endYear || 'Present'}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Education Subform */}
                  <div className="rounded-xl border border-slate-850/60 bg-slate-950/20 p-4 space-y-3">
                    <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Add New Education</span>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <input
                        type="text"
                        placeholder="Institution (e.g. Stanford University)"
                        value={newInst}
                        onChange={(e) => setNewInst(e.target.value)}
                        className="rounded-xl border border-slate-800 bg-slate-900/40 p-2.5 text-slate-200 text-xs outline-none focus:border-teal-500/50"
                      />
                      <input
                        type="text"
                        placeholder="Degree (e.g. Bachelor of Science)"
                        value={newDegree}
                        onChange={(e) => setNewDegree(e.target.value)}
                        className="rounded-xl border border-slate-800 bg-slate-900/40 p-2.5 text-slate-200 text-xs outline-none focus:border-teal-500/50"
                      />
                      <input
                        type="text"
                        placeholder="Field of Study (e.g. Computer Science)"
                        value={newField}
                        onChange={(e) => setNewField(e.target.value)}
                        className="rounded-xl border border-slate-800 bg-slate-900/40 p-2.5 text-slate-200 text-xs outline-none focus:border-teal-500/50"
                      />
                    </div>
                    <div className="flex gap-3 items-center">
                      <input
                        type="text"
                        placeholder="Start Year (e.g. 2018)"
                        value={newStartYr}
                        onChange={(e) => setNewStartYr(e.target.value)}
                        className="w-1/3 rounded-xl border border-slate-800 bg-slate-900/40 p-2.5 text-slate-200 text-xs outline-none focus:border-teal-500/50"
                      />
                      <input
                        type="text"
                        placeholder="End Year (e.g. 2022)"
                        value={newEndYr}
                        onChange={(e) => setNewEndYr(e.target.value)}
                        className="w-1/3 rounded-xl border border-slate-800 bg-slate-900/40 p-2.5 text-slate-200 text-xs outline-none focus:border-teal-500/50"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newInst && newDegree && newField) {
                            setEducationList([...educationList, { institution: newInst, degree: newDegree, fieldOfStudy: newField, startYear: newStartYr, endYear: newEndYr }]);
                            setNewInst('');
                            setNewDegree('');
                            setNewField('');
                            setNewStartYr('');
                            setNewEndYr('');
                          } else {
                            alert('Please fill Institution, Degree, and Field of Study.');
                          }
                        }}
                        className="w-1/3 rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-2.5 border border-slate-700 text-slate-200 text-xs font-bold cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Plus className="h-4 w-4" /> Add Record
                      </button>
                    </div>
                  </div>
                </div>

                {/* EXPERIENCE SECTION */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-6 space-y-4">
                  <h3 className="text-sm font-bold text-teal-400 border-b border-slate-850 pb-2 flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-teal-400" /> Prior Experience
                  </h3>

                  {experienceList.length > 0 && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {experienceList.map((exp, idx) => (
                        <div key={idx} className="group relative rounded-xl border border-slate-850 bg-slate-900/40 p-4 hover:border-slate-800 transition duration-200 animate-in zoom-in-95">
                          <button
                            type="button"
                            onClick={() => setExperienceList(experienceList.filter((_, i) => i !== idx))}
                            className="absolute top-4 right-4 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <h4 className="font-bold text-sm text-slate-200">{exp.designation}</h4>
                          <p className="text-xs text-teal-400 mt-0.5">{exp.company}</p>
                          {exp.description && <p className="text-xs text-slate-400 mt-2 line-clamp-2">{exp.description}</p>}
                          <p className="text-[10px] text-slate-500 font-mono mt-2">
                            {exp.startDate ? new Date(exp.startDate).toLocaleDateString() : 'N/A'} — {exp.endDate ? new Date(exp.endDate).toLocaleDateString() : 'Present'}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Experience Subform */}
                  <div className="rounded-xl border border-slate-850/60 bg-slate-950/20 p-4 space-y-3">
                    <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Add Prior Work Experience</span>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <input
                        type="text"
                        placeholder="Company Name"
                        value={newCompany}
                        onChange={(e) => setNewCompany(e.target.value)}
                        className="rounded-xl border border-slate-800 bg-slate-900/40 p-2.5 text-slate-200 text-xs outline-none focus:border-teal-500/50"
                      />
                      <input
                        type="text"
                        placeholder="Role / Designation"
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value)}
                        className="rounded-xl border border-slate-800 bg-slate-900/40 p-2.5 text-slate-200 text-xs outline-none focus:border-teal-500/50"
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">Start Date</label>
                        <input
                          type="date"
                          value={newExpStart}
                          onChange={(e) => setNewExpStart(e.target.value)}
                          className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-2.5 text-slate-200 text-xs outline-none focus:border-teal-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">End Date (Leave blank if current)</label>
                        <input
                          type="date"
                          value={newExpEnd}
                          onChange={(e) => setNewExpEnd(e.target.value)}
                          className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-2.5 text-slate-200 text-xs outline-none focus:border-teal-500/50"
                        />
                      </div>
                    </div>
                    <textarea
                      placeholder="Brief description of duties/achievements"
                      rows="2"
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-2.5 text-slate-200 text-xs outline-none focus:border-teal-500/50 resize-none"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          if (newCompany && newRole) {
                            setExperienceList([...experienceList, {
                              company: newCompany,
                              designation: newRole,
                              startDate: newExpStart || undefined,
                              endDate: newExpEnd || undefined,
                              description: newDesc
                            }]);
                            setNewCompany('');
                            setNewRole('');
                            setNewExpStart('');
                            setNewExpEnd('');
                            setNewDesc('');
                          } else {
                            alert('Please fill Company and Designation.');
                          }
                        }}
                        className="rounded-xl bg-slate-800 hover:bg-slate-700 px-5 py-2.5 border border-slate-700 text-slate-200 text-xs font-bold cursor-pointer flex items-center gap-1"
                      >
                        <Plus className="h-4 w-4" /> Add Experience
                      </button>
                    </div>
                  </div>
                </div>

                {/* CERTIFICATIONS SECTION */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-6 space-y-4">
                  <h3 className="text-sm font-bold text-teal-400 border-b border-slate-850 pb-2 flex items-center gap-2">
                    <Award className="h-4.5 w-4.5 text-teal-400" /> Certifications
                  </h3>

                  {certificationsList.length > 0 && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {certificationsList.map((cert, idx) => (
                        <div key={idx} className="group relative rounded-xl border border-slate-850 bg-slate-900/40 p-4 hover:border-slate-800 transition duration-200 animate-in zoom-in-95">
                          <button
                            type="button"
                            onClick={() => setCertificationsList(certificationsList.filter((_, i) => i !== idx))}
                            className="absolute top-4 right-4 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <h4 className="font-bold text-sm text-slate-200">{cert.name}</h4>
                          <p className="text-xs text-teal-400 mt-0.5">{cert.issuer}</p>
                          {cert.credentialId && <p className="text-[10px] text-slate-400 font-mono mt-1">ID: {cert.credentialId}</p>}
                          <p className="text-[10px] text-slate-500 font-mono mt-2">
                            Issued: {cert.issueDate ? new Date(cert.issueDate).toLocaleDateString() : 'N/A'} 
                            {cert.expiryDate ? ` — Expires: ${new Date(cert.expiryDate).toLocaleDateString()}` : ' (No Expiration)'}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Cert Subform */}
                  <div className="rounded-xl border border-slate-850/60 bg-slate-950/20 p-4 space-y-3">
                    <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Add New Certification</span>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <input
                        type="text"
                        placeholder="Cert Name (e.g. AWS Solutions Architect)"
                        value={newCertName}
                        onChange={(e) => setNewCertName(e.target.value)}
                        className="rounded-xl border border-slate-800 bg-slate-900/40 p-2.5 text-slate-200 text-xs outline-none focus:border-teal-500/50"
                      />
                      <input
                        type="text"
                        placeholder="Issuing Org (e.g. Amazon Web Services)"
                        value={newIssuer}
                        onChange={(e) => setNewIssuer(e.target.value)}
                        className="rounded-xl border border-slate-800 bg-slate-900/40 p-2.5 text-slate-200 text-xs outline-none focus:border-teal-500/50"
                      />
                      <input
                        type="text"
                        placeholder="Credential ID (Optional)"
                        value={newCredId}
                        onChange={(e) => setNewCredId(e.target.value)}
                        className="rounded-xl border border-slate-800 bg-slate-900/40 p-2.5 text-slate-200 text-xs outline-none focus:border-teal-500/50"
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">Issue Date</label>
                        <input
                          type="date"
                          value={newIssueDate}
                          onChange={(e) => setNewIssueDate(e.target.value)}
                          className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-2.5 text-slate-200 text-xs outline-none focus:border-teal-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">Expiry Date (Optional)</label>
                        <input
                          type="date"
                          value={newExpiryDate}
                          onChange={(e) => setNewExpiryDate(e.target.value)}
                          className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-2.5 text-slate-200 text-xs outline-none focus:border-teal-500/50"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => {
                            if (newCertName && newIssuer) {
                              setCertificationsList([...certificationsList, {
                                name: newCertName,
                                issuer: newIssuer,
                                issueDate: newIssueDate || undefined,
                                expiryDate: newExpiryDate || undefined,
                                credentialId: newCredId
                              }]);
                              setNewCertName('');
                              setNewIssuer('');
                              setNewIssueDate('');
                              setNewExpiryDate('');
                              setNewCredId('');
                            } else {
                              alert('Please fill Certification Name and Issuer.');
                            }
                          }}
                          className="w-full rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-2.5 border border-slate-700 text-slate-200 text-xs font-bold cursor-pointer flex items-center justify-center gap-1"
                        >
                          <Plus className="h-4 w-4" /> Add Cert
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'employment' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Department</label>
                    <input
                      type="text"
                      disabled={!isAdmin}
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-200 outline-none focus:border-teal-500/50 disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Designation</label>
                    <input
                      type="text"
                      disabled={!isAdmin}
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-200 outline-none focus:border-teal-500/50 disabled:opacity-50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Location</label>
                    <input
                      type="text"
                      disabled={!isAdmin}
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-200 outline-none focus:border-teal-500/50 disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Job Grade</label>
                    <input
                      type="text"
                      disabled={!isAdmin}
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-200 outline-none focus:border-teal-500/50 disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Status</label>
                    <span className="block w-full rounded-xl border border-slate-800 bg-slate-900/20 p-3 text-slate-400 select-none font-semibold">
                      {employee?.employment?.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Employment Type</label>
                    {isAdmin ? (
                      <select
                        value={employmentType}
                        onChange={(e) => setEmploymentType(e.target.value)}
                        className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-200 outline-none focus:border-teal-500/50 cursor-pointer"
                      >
                        <option value="FULL_TIME">Full-time</option>
                        <option value="PART_TIME">Part-time</option>
                        <option value="CONTRACT">Contract</option>
                        <option value="INTERN">Intern</option>
                      </select>
                    ) : (
                      <span className="block w-full rounded-xl border border-slate-800 bg-slate-900/20 p-3 text-slate-400 select-none font-semibold">
                        {employmentType === 'FULL_TIME' ? 'Full-time' : 
                         employmentType === 'PART_TIME' ? 'Part-time' :
                         employmentType === 'CONTRACT' ? 'Contract' :
                         employmentType === 'INTERN' ? 'Intern' : employmentType}
                      </span>
                    )}
                  </div>
 
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Assigned Shift</label>
                    {isAdmin ? (
                      <select
                        value={assignedShift}
                        onChange={(e) => setAssignedShift(e.target.value)}
                        className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-200 outline-none focus:border-teal-500/50 cursor-pointer"
                      >
                        <option value="">Select Shift</option>
                        <option value="Day Shift">Day Shift</option>
                        <option value="Night Shift">Night Shift</option>
                        <option value="Morning Shift">Morning Shift</option>
                        <option value="Evening Shift">Evening Shift</option>
                      </select>
                    ) : (
                      <span className="block w-full rounded-xl border border-slate-800 bg-slate-900/20 p-3 text-slate-400 select-none">
                        {assignedShift || 'No shift assigned'}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Reporting Manager</label>
                  {isAdmin ? (
                    <select
                      value={reportingManagerId}
                      onChange={(e) => setReportingManagerId(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-200 outline-none focus:border-teal-500/50 cursor-pointer"
                    >
                      <option value="">None (Independent / Top Node)</option>
                      {managers
                        .filter(m => m._id !== employee?._id)
                        .map((m) => (
                          <option key={m._id} value={m._id}>
                            {m.personal?.firstName} {m.personal?.lastName} ({m.employment?.designation})
                          </option>
                        ))}
                    </select>
                  ) : (
                    <span className="block w-full rounded-xl border border-slate-800 bg-slate-900/20 p-3 text-slate-400 select-none">
                      {employee?.employment?.reportingManagerId
                        ? `${employee.employment.reportingManagerId.personal?.firstName} ${employee.employment.reportingManagerId.personal?.lastName}`
                        : 'No manager assigned'}
                    </span>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'finance' && (
              <div className="space-y-6">
                <h4 className="text-sm font-bold text-teal-400 border-b border-slate-850 pb-1 flex items-center gap-1.5">
                  Bank Details <span className="text-[10px] text-amber-400 font-normal normal-case">(Buffering approvals)</span>
                </h4>
                
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Account Holder Name</label>
                    <input
                      type="text"
                      value={accountHolderName}
                      onChange={(e) => setAccountHolderName(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-200 outline-none focus:border-teal-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Account Number</label>
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-200 outline-none focus:border-teal-500/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Bank Name</label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-200 outline-none focus:border-teal-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">IFSC / Routing Code</label>
                    <input
                      type="text"
                      value={ifscCode}
                      onChange={(e) => setIfscCode(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-200 outline-none focus:border-teal-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">PAN Card Number</label>
                    <input
                      type="text"
                      value={pan}
                      onChange={(e) => setPan(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-200 outline-none focus:border-teal-500/50"
                    />
                  </div>
                </div>

                <h4 className="text-sm font-bold text-teal-400 border-b border-slate-850 pt-4 pb-1 flex items-center gap-1.5">
                  Statutory Registrations <span className="text-[10px] text-amber-400 font-normal normal-case">(Buffering approvals)</span>
                </h4>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">UAN (Provident Fund Number)</label>
                    <input
                      type="text"
                      value={uan}
                      onChange={(e) => setUan(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-200 outline-none focus:border-teal-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">PF Account Number</label>
                    <input
                      type="text"
                      value={pfNumber}
                      onChange={(e) => setPfNumber(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-200 outline-none focus:border-teal-500/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">ESI Registration ID</label>
                    <input
                      type="text"
                      value={esiNumber}
                      onChange={(e) => setEsiNumber(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-200 outline-none focus:border-teal-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">US SSN (Social Security Number)</label>
                    <input
                      type="text"
                      placeholder="e.g. XXX-XX-XXXX"
                      value={ssn}
                      onChange={(e) => setSsn(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-200 outline-none focus:border-teal-500/50"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="pt-6 border-t border-slate-850 flex justify-end">
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 px-6 py-3 font-bold text-black shadow-lg shadow-teal-500/10 transition cursor-pointer"
              >
                <Save className="h-4 w-4" /> Save Profile Details
              </button>
            </div>
          </form>
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6 md:p-8 backdrop-blur-md shadow-lg space-y-6">
              <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-6 space-y-4">
                <h3 className="text-sm font-bold text-teal-400 border-b border-slate-850 pb-2 flex items-center gap-2">
                  <UploadCloud className="h-4.5 w-4.5 text-teal-400" /> Upload New Document
                </h3>
                
                <form onSubmit={handleDocumentUpload} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Document Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Passport, Drivers License, Offer Letter 2026"
                        value={docName}
                        onChange={(e) => setDocName(e.target.value)}
                        className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-200 outline-none focus:border-teal-500/50 text-sm"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Document Type</label>
                      <select
                        value={docType}
                        onChange={(e) => setDocType(e.target.value)}
                        className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-200 outline-none focus:border-teal-500/50 cursor-pointer text-sm"
                      >
                        <option value="ID_PROOF">ID Proof</option>
                        <option value="OFFER_LETTER">Offer Letter</option>
                        <option value="CONTRACT">Contract</option>
                        <option value="CERTIFICATE">Certificate</option>
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Select File</label>
                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer hover:bg-slate-900/20 border-slate-800 hover:border-teal-500/50 transition">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <UploadCloud className="w-8 h-8 mb-2 text-slate-400" />
                          <p className="mb-1 text-sm text-slate-400">
                            {docFile ? <span className="text-teal-400 font-semibold">{docFile.name}</span> : <span>Click to upload or drag & drop</span>}
                          </p>
                          <p className="text-xs text-slate-500">PDF, PNG, JPG, JPEG, DOC, DOCX (Max 5MB)</p>
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          required
                          onChange={(e) => setDocFile(e.target.files[0])}
                          accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                        />
                      </label>
                    </div>
                  </div>
                  
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={uploadingDoc}
                      className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 px-6 py-3 font-bold text-black shadow-lg shadow-teal-500/10 transition cursor-pointer disabled:opacity-50"
                    >
                      {uploadingDoc ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent"></div>
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <UploadCloud className="h-4 w-4" />
                          <span>Upload Document</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
              
              <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-6 space-y-4">
                <h3 className="text-sm font-bold text-teal-400 border-b border-slate-850 pb-2 flex items-center gap-2">
                  <FileText className="h-4.5 w-4.5 text-teal-400" /> Uploaded Documents
                </h3>
                
                {(!employee?.documents || employee.documents.length === 0) ? (
                  <div className="text-center py-8 text-slate-400 italic text-sm">
                    No documents uploaded yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                          <th className="py-3 px-4">Name</th>
                          <th className="py-3 px-4">Type</th>
                          <th className="py-3 px-4">Upload Date</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850 text-slate-200">
                        {employee.documents.map((doc) => (
                          <tr key={doc._id} className="hover:bg-slate-900/10">
                            <td className="py-3 px-4 font-semibold">{doc.name}</td>
                            <td className="py-3 px-4">
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 border border-slate-700 text-slate-300">
                                {doc.type.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-400">
                              {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="py-3 px-4 text-right flex justify-end gap-2">
                              <a
                                href={getDocumentUrl(doc.fileUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-lg text-slate-200 font-medium transition cursor-pointer"
                              >
                                <ExternalLink className="h-3.5 w-3.5" /> View
                              </a>
                              <button
                                type="button"
                                onClick={() => handleDocumentDelete(doc._id)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/30 rounded-lg text-rose-400 font-medium transition cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Payslips Tab */}
        {activeTab === 'payslips' && (
          <div className="space-y-8">
            <style>{`
              @media print {
                body * {
                  visibility: hidden;
                }
                #payslip-print-modal, #payslip-print-modal * {
                  visibility: visible;
                }
                #payslip-print-modal {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  background: white !important;
                  color: black !important;
                  box-shadow: none !important;
                  border: none !important;
                }
                .no-print {
                  display: none !important;
                }
                .no-print-overlay {
                  background: white !important;
                  backdrop-filter: none !important;
                }
                .print-only {
                  display: flex !important;
                }
              }
              .print-only {
                display: none;
              }
            `}</style>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              {/* HR Admin Payslip Generator Card */}
              {isAdmin && (
                <div className="lg:col-span-1 rounded-2xl border border-slate-800 bg-slate-900/20 p-6 space-y-6 h-fit">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-teal-400" /> Generate Payslip
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Calculate and publish monthly salaries with automated LOP deductions.
                    </p>
                  </div>

                  <form onSubmit={handleGeneratePayslip} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Month</label>
                        <select
                          value={genMonth}
                          onChange={(e) => setGenMonth(e.target.value)}
                          className="w-full rounded-xl border border-slate-800 bg-slate-950 text-slate-100 text-sm p-3 outline-none"
                        >
                          {Array.from({ length: 12 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>
                              {new Date(0, i).toLocaleString('default', { month: 'long' })}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Year</label>
                        <input
                          type="number"
                          value={genYear}
                          onChange={(e) => setGenYear(e.target.value)}
                          className="w-full rounded-xl border border-slate-800 bg-slate-950 text-slate-100 text-sm p-3 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Basic Salary (monthly) *</label>
                      <input
                        type="number"
                        placeholder="e.g. 50000"
                        value={genBasic}
                        onChange={(e) => setGenBasic(e.target.value)}
                        required
                        className="w-full rounded-xl border border-slate-800 bg-slate-950 text-slate-100 text-sm p-3 outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Allowances</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={genAllowances}
                          onChange={(e) => setGenAllowances(e.target.value)}
                          className="w-full rounded-xl border border-slate-800 bg-slate-950 text-slate-100 text-sm p-3 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">General Deductions</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={genDeductions}
                          onChange={(e) => setGenDeductions(e.target.value)}
                          className="w-full rounded-xl border border-slate-800 bg-slate-950 text-slate-100 text-sm p-3 outline-none"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={genLoading}
                      className="w-full rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-sm font-bold text-white py-3 transition duration-150 cursor-pointer shadow"
                    >
                      {genLoading ? 'Calculating...' : 'Generate & Publish'}
                    </button>
                  </form>
                </div>
              )}

              {/* Payslips History List */}
              <div className={`${isAdmin ? 'lg:col-span-2' : 'lg:col-span-3'} rounded-2xl border border-slate-800 bg-slate-900/20 p-6 space-y-4`}>
                <h3 className="text-base font-bold text-teal-400 border-b border-slate-850 pb-2 flex items-center gap-2">
                  <Landmark className="h-5 w-5 text-teal-400" /> Compensation & Payslip History
                </h3>

                {payslipsLoading ? (
                  <div className="flex h-48 items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent"></div>
                  </div>
                ) : payslips.length === 0 ? (
                  <div className="text-center py-12 text-slate-450 italic text-sm">
                    No payroll slips generated for this period.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-450 uppercase tracking-wider">
                          <th className="py-3 px-4">Period</th>
                          <th className="py-3 px-4 text-center">LOP Days</th>
                          <th className="py-3 px-4 text-right">Basic Pay</th>
                          <th className="py-3 px-4 text-right">Deductions</th>
                          <th className="py-3 px-4 text-right">Net Salary</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850 text-slate-200">
                        {payslips.map((pay) => (
                          <tr key={pay._id} className="hover:bg-slate-900/10">
                            <td className="py-3 px-4 font-semibold font-mono">
                              {new Date(pay.year, pay.month - 1).toLocaleString('default', { month: 'short' })} {pay.year}
                            </td>
                            <td className="py-3 px-4 text-center font-mono font-bold text-rose-450">
                              {pay.lopDays > 0 ? `${pay.lopDays} LOP` : '-'}
                            </td>
                            <td className="py-3 px-4 text-right font-mono">${pay.basicSalary.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right font-mono text-rose-400">${pay.deductions.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right font-semibold font-mono text-emerald-400">${pay.netSalary.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right flex justify-end">
                              <button
                                type="button"
                                onClick={() => setSelectedPayslip(pay)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 rounded-lg text-white font-bold transition duration-150 cursor-pointer shadow"
                              >
                                <Download className="h-3.5 w-3.5" /> Print / PDF
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Payslip Detail Printing Modal */}
        {selectedPayslip && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm no-print-overlay">
            <div id="payslip-print-modal" className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-8 space-y-6 shadow-2xl relative">
              
              {/* Header Details */}
              <div className="flex justify-between items-start border-b border-slate-800 pb-5">
                <div>
                  <h2 className="text-xl font-black text-white flex items-center gap-2">
                    <Landmark className="h-6 w-6 text-teal-400" />
                    {localStorage.getItem('workspaceSubdomain')?.toUpperCase() || 'HRMS'} CORPORATE PAYSLIP
                  </h2>
                  <p className="text-xs text-slate-450 mt-1 font-mono uppercase">
                    Payroll Cycle: {new Date(selectedPayslip.year, selectedPayslip.month - 1).toLocaleString('default', { month: 'long' })} {selectedPayslip.year}
                  </p>
                </div>
                <div className="no-print flex gap-2">
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-xs font-bold text-white px-3.5 py-2 transition shadow cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" /> Print / Save PDF
                  </button>
                  <button
                    onClick={() => setSelectedPayslip(null)}
                    className="flex items-center justify-center h-8 w-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Employee Information */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-950/40 border border-slate-850 p-4 rounded-xl text-slate-300">
                <div>
                  <p className="mb-1"><span className="text-slate-500">Employee Name:</span> <strong className="text-slate-200">{employee?.personal?.firstName} {employee?.personal?.lastName}</strong></p>
                  <p className="mb-1"><span className="text-slate-500">Employee ID:</span> <strong className="text-slate-200">{employee?.employeeId}</strong></p>
                  <p><span className="text-slate-500">Department:</span> <strong className="text-slate-200">{employee?.employment?.department}</strong></p>
                </div>
                <div>
                  <p className="mb-1"><span className="text-slate-500">Designation:</span> <strong className="text-slate-200">{employee?.employment?.designation}</strong></p>
                  <p className="mb-1"><span className="text-slate-500">Location:</span> <strong className="text-slate-200">{employee?.employment?.location || 'HQ'}</strong></p>
                  <p><span className="text-slate-500">Loss of Pay (LOP) Days:</span> <strong className="text-rose-400 font-mono">{selectedPayslip.lopDays > 0 ? `${selectedPayslip.lopDays} Days` : '0 Days'}</strong></p>
                </div>
              </div>

              {/* Salary Structure Grid */}
              <div className="grid grid-cols-2 gap-6 text-xs border border-slate-800 rounded-xl overflow-hidden">
                {/* Earnings */}
                <div className="divide-y divide-slate-850 border-r border-slate-800 bg-slate-900/10">
                  <div className="bg-slate-900 px-4 py-2.5 font-bold uppercase tracking-wider text-slate-400 text-[10px]">Earnings</div>
                  <div className="flex justify-between px-4 py-3 text-slate-300">
                    <span>Basic Salary</span>
                    <span className="font-mono">${selectedPayslip.basicSalary.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between px-4 py-3 text-slate-300">
                    <span>Allowances / Bonuses</span>
                    <span className="font-mono">${selectedPayslip.allowances.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between px-4 py-3 font-semibold text-slate-100 bg-slate-950/20">
                    <span>Gross Earnings</span>
                    <span className="font-mono">${(selectedPayslip.basicSalary + selectedPayslip.allowances).toLocaleString()}</span>
                  </div>
                </div>

                {/* Deductions */}
                <div className="divide-y divide-slate-850 bg-slate-900/10">
                  <div className="bg-slate-900 px-4 py-2.5 font-bold uppercase tracking-wider text-slate-400 text-[10px]">Deductions</div>
                  <div className="flex justify-between px-4 py-3 text-slate-350">
                    <span>Tax & Statutory Deductions</span>
                    <span className="font-mono">
                      ${Math.max(0, selectedPayslip.deductions - (selectedPayslip.lopDays * (selectedPayslip.basicSalary / new Date(selectedPayslip.year, selectedPayslip.month, 0).getDate()))).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between px-4 py-3 text-slate-355 text-slate-350">
                    <span>Loss of Pay (LOP) Deductions</span>
                    <span className="font-mono text-rose-400">
                      ${(selectedPayslip.lopDays * (selectedPayslip.basicSalary / new Date(selectedPayslip.year, selectedPayslip.month, 0).getDate())).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between px-4 py-3 font-semibold text-rose-455 text-rose-400 bg-slate-950/20">
                    <span>Total Deductions</span>
                    <span className="font-mono">${selectedPayslip.deductions.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Net Payable Summary */}
              <div className="flex justify-between items-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4.5 text-slate-100">
                <div>
                  <span className="text-xs text-slate-405 text-slate-400 uppercase tracking-wider font-bold">Net Payable Salary (Net Pay)</span>
                  <span className="block text-[10px] text-slate-500">Calculated after LOP deductions and statutory contributions</span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-emerald-400 font-mono">${selectedPayslip.netSalary.toLocaleString()}</span>
                </div>
              </div>

              {/* Signature Section */}
              <div className="print-only flex justify-between pt-16 text-xs text-slate-400 font-medium">
                <div>
                  <div className="border-t border-slate-500 w-48 text-center pt-1.5">Employee Signature</div>
                </div>
                <div>
                  <div className="border-t border-slate-500 w-48 text-center pt-1.5">Authorized Signatory</div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* HR Pending Requests tab review layout */}
        {activeTab === 'review' && isAdmin && (
          <div className="space-y-6">
            {pendingLoading ? (
              <div className="flex h-48 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent"></div>
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/20 p-12 text-center text-slate-400">
                <p className="font-semibold text-lg">No pending profile modification requests exist.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {pendingRequests.map((req) => (
                  <div
                    key={req._id}
                    className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6 backdrop-blur-md shadow-md space-y-4"
                  >
                    {/* Header */}
                    <div className="flex justify-between items-center border-b border-slate-850 pb-3">
                      <div>
                        <strong className="block text-slate-200 text-lg">
                          {req.personal?.firstName} {req.personal?.lastName}
                        </strong>
                        <span className="text-xs text-slate-500 font-mono">ID: {req.employeeId} | Email: {req.userId?.email}</span>
                      </div>
                      <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded font-mono font-semibold uppercase">
                        Requested Updates
                      </span>
                    </div>

                    {/* Before/After parameters table grid */}
                    <div className="space-y-4 text-xs font-mono">
                      {req.pendingChanges?.data?.personal && (
                        <div>
                          <span className="block text-teal-400 font-sans font-bold text-xs mb-2">Personal Fields</span>
                          <div className="grid grid-cols-2 gap-4 rounded-xl bg-slate-900/50 p-3 border border-slate-850">
                            <div>
                              <span className="block text-[10px] text-slate-500 mb-1">CURRENT VALUES</span>
                              <p>First Name: {req.personal?.firstName}</p>
                              <p>Last Name: {req.personal?.lastName}</p>
                            </div>
                            <div>
                              <span className="block text-[10px] text-teal-400 mb-1">PROPOSED VALUES</span>
                              <p className="text-teal-300 font-bold">First Name: {req.pendingChanges.data.personal.firstName}</p>
                              <p className="text-teal-300 font-bold">Last Name: {req.pendingChanges.data.personal.lastName}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {req.pendingChanges?.data?.bankDetails && (
                        <div>
                          <span className="block text-teal-400 font-sans font-bold text-xs mb-2">Bank Details</span>
                          <div className="grid grid-cols-2 gap-4 rounded-xl bg-slate-900/50 p-3 border border-slate-850">
                            <div>
                              <span className="block text-[10px] text-slate-500 mb-1">CURRENT VALUES</span>
                              <p>Holder: {req.bankDetails?.accountHolderName || 'N/A'}</p>
                              <p>Account: {req.bankDetails?.accountNumber || 'N/A'}</p>
                              <p>Bank: {req.bankDetails?.bankName || 'N/A'}</p>
                              <p>IFSC: {req.bankDetails?.ifscCode || 'N/A'}</p>
                              <p>PAN: {req.bankDetails?.pan || 'N/A'}</p>
                            </div>
                            <div>
                              <span className="block text-[10px] text-teal-400 mb-1">PROPOSED VALUES</span>
                              <p className="text-teal-300 font-bold">Holder: {req.pendingChanges.data.bankDetails.accountHolderName}</p>
                              <p className="text-teal-300 font-bold">Account: {req.pendingChanges.data.bankDetails.accountNumber}</p>
                              <p className="text-teal-300 font-bold">Bank: {req.pendingChanges.data.bankDetails.bankName}</p>
                              <p className="text-teal-300 font-bold">IFSC: {req.pendingChanges.data.bankDetails.ifscCode}</p>
                              <p className="text-teal-300 font-bold">PAN: {req.pendingChanges.data.bankDetails.pan}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {req.pendingChanges?.data?.statutory && (
                        <div>
                          <span className="block text-teal-400 font-sans font-bold text-xs mb-2">Statutory Registrations</span>
                          <div className="grid grid-cols-2 gap-4 rounded-xl bg-slate-900/50 p-3 border border-slate-850">
                            <div>
                              <span className="block text-[10px] text-slate-500 mb-1">CURRENT VALUES</span>
                              <p>UAN: {req.statutory?.uan || 'N/A'}</p>
                              <p>PF Number: {req.statutory?.pfNumber || 'N/A'}</p>
                              <p>ESI Number: {req.statutory?.esiNumber || 'N/A'}</p>
                              <p>SSN: {req.statutory?.ssn || 'N/A'}</p>
                            </div>
                            <div>
                              <span className="block text-[10px] text-teal-400 mb-1">PROPOSED VALUES</span>
                              <p className="text-teal-300 font-bold">UAN: {req.pendingChanges.data.statutory.uan}</p>
                              <p className="text-teal-300 font-bold">PF Number: {req.pendingChanges.data.statutory.pfNumber}</p>
                              <p className="text-teal-300 font-bold">ESI Number: {req.pendingChanges.data.statutory.esiNumber}</p>
                              <p className="text-teal-300 font-bold">SSN: {req.pendingChanges.data.statutory.ssn}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        onClick={() => handleReviewRequest(req._id, 'REJECT')}
                        className="flex items-center gap-1 px-4 py-2 bg-rose-500/10 hover:bg-rose-500 border border-rose-500/20 hover:border-rose-500 hover:text-black rounded-lg text-rose-400 text-xs font-bold transition cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" /> Reject Request
                      </button>

                      <button
                        onClick={() => handleReviewRequest(req._id, 'APPROVE')}
                        className="flex items-center gap-1 px-4 py-2 bg-teal-500/10 hover:bg-teal-500 border border-teal-500/20 hover:border-teal-500 hover:text-black rounded-lg text-teal-400 text-xs font-bold transition cursor-pointer"
                      >
                        <Check className="h-3.5 w-3.5" /> Approve & Apply
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Delegation Tab */}
        {activeTab === 'delegation' && (
          <DelegationSettings />
        )}

        {/* Notifications Preference Tab */}
        {activeTab === 'notifications' && (
          <NotificationPreferences />
        )}
      </div>
    </div>
  );
};

export default ESSProfilePage;
