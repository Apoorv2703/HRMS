import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Briefcase, FileSpreadsheet, UserPlus, Upload, ShieldAlert, ArrowLeft, ArrowRight, UserCheck, FileText, ExternalLink } from 'lucide-react';
import api, { BASE_BACKEND_URL } from '../services/api';

const DirectoryPage = () => {
  const { user } = useSelector((state) => state.auth);
  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters and pagination
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Org config data
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);

  // Modal detail view
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [exitDate, setExitDate] = useState('');
  const [exitReason, setExitReason] = useState('');

  // Bulk Import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [importLoading, setImportLoading] = useState(false);

  const isAdmin = user?.role === 'HR_ADMIN';
  const isAdminOrLeadership = user?.role === 'HR_ADMIN' || user?.role === 'LEADERSHIP';

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchDirectory();
  }, [search, department, location, page]);

  const fetchMetadata = async () => {
    try {
      const response = await api.get('/organization');
      setDepartments(response.data.departments || []);
      setLocations(response.data.locations || []);
    } catch (err) {
      console.error('Failed to load org metadata', err);
    }
  };

  const fetchDirectory = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/employees', {
        params: {
          search,
          department,
          location,
          page,
          limit: 12
        }
      });
      setEmployees(response.data.employees || []);
      setTotalPages(response.data.pagination?.pages || 1);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch directory list.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (empId) => {
    setDetailLoading(true);
    try {
      const response = await api.get(`/employees/${empId}`);
      setSelectedEmp(response.data);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to fetch employee profile details.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const response = await api.get('/employees/export-csv', { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'employee_directory.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert('Failed to export employee directory CSV.');
    }
  };

  const handleBulkImport = async (e) => {
    e.preventDefault();
    setImportLoading(true);
    setImportResult(null);
    try {
      const response = await api.post('/employees/import-csv', { csvText });
      setImportResult(response.data);
      fetchDirectory();
    } catch (err) {
      alert(err.response?.data?.error || 'CSV Bulk Import failed.');
    } finally {
      setImportLoading(false);
    }
  };

  const handleTerminateSubmit = async (e) => {
    e.preventDefault();
    if (!exitDate || !exitReason) return;
    try {
      await api.post(`/employees/${selectedEmp._id}/terminate`, { exitDate, exitReason });
      alert('Employee status updated to EXITED.');
      setShowExitModal(false);
      setSelectedEmp(null);
      fetchDirectory();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to exit employee.');
    }
  };

  const getInitials = (personal) => {
    if (!personal?.firstName) return 'EE';
    return `${personal.firstName[0]}${personal.lastName?.[0] || ''}`.toUpperCase();
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">Active</span>;
      case 'PROBATION':
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">Probation</span>;
      case 'SUSPENDED':
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200">Suspended</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">Exited</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-7xl">
        {/* Header section */}
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-950">
              Employee Directory
            </h1>
            <p className="mt-1 text-slate-500">View corporate reporting structure, departments, and onboarding portals.</p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            {isAdminOrLeadership && (
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 px-4 py-2.5 font-medium transition duration-200 cursor-pointer shadow-sm"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-650" />
                Export CSV
              </button>
            )}

            {isAdmin && (
              <>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="flex items-center gap-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 px-4 py-2.5 font-medium transition duration-200 cursor-pointer shadow-sm"
                >
                  <Upload className="h-4 w-4 text-cyan-650" />
                  Bulk Import
                </button>

                <button
                  onClick={() => navigate('/onboard-staff')}
                  className="flex items-center gap-2 rounded-xl bg-slate-950 hover:bg-slate-900 px-4 py-2.5 font-semibold text-white transition duration-200 cursor-pointer shadow-md"
                >
                  <UserPlus className="h-4 w-4" />
                  Onboard Staff
                </button>
              </>
            )}
          </div>
        </div>

        {/* Toolbar filters */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="relative">
            <Search className="absolute top-3.5 left-4 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search employee name or ID..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pr-4 pl-11 text-slate-900 placeholder-slate-400 outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950/20 transition duration-200"
            />
          </div>

          <div className="relative">
            <Briefcase className="absolute top-3.5 left-4 h-4 w-4 text-slate-400 pointer-events-none" />
            <select
              value={department}
              onChange={(e) => { setDepartment(e.target.value); setPage(1); }}
              className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-3 pr-10 pl-11 text-slate-900 outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950/20 transition duration-200 cursor-pointer"
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept.code} value={dept.name}>{dept.name}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <MapPin className="absolute top-3.5 left-4 h-4 w-4 text-slate-400 pointer-events-none" />
            <select
              value={location}
              onChange={(e) => { setLocation(e.target.value); setPage(1); }}
              className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-3 pr-10 pl-11 text-slate-900 outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950/20 transition duration-200 cursor-pointer"
            >
              <option value="">All Locations</option>
              {locations.map((loc) => (
                <option key={loc.name} value={loc.name}>{loc.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Directory Grid */}
        {loading ? (
          <div className="flex h-96 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent"></div>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700">
            <ShieldAlert className="mx-auto mb-2 h-10 w-10 text-rose-600" />
            <p className="font-semibold">{error}</p>
          </div>
        ) : employees.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-550">
            <p className="font-medium text-lg">No employee profiles found matching current search filters.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {employees.map((emp) => (
                <div
                  key={emp._id}
                  onClick={() => handleViewDetails(emp._id)}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white hover:bg-slate-50/50 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 shadow-md hover:shadow-xl cursor-pointer"
                >
                  <div className="mb-4 flex items-center justify-between">
                    {emp.personal.avatarUrl ? (
                      <img
                        src={emp.personal.avatarUrl}
                        alt={`${emp.personal.firstName} ${emp.personal.lastName}`}
                        className="h-12 w-12 rounded-xl object-cover ring-2 ring-slate-200"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700 font-bold text-sm border border-slate-200">
                        {getInitials(emp.personal)}
                      </div>
                    )}
                    {getStatusBadge(emp.employment.status)}
                  </div>

                  <h3 className="font-bold text-lg text-slate-900 group-hover:text-slate-950 transition-colors duration-200">
                    {emp.personal.firstName} {emp.personal.lastName}
                  </h3>
                  <p className="text-sm font-medium text-slate-500 mt-1">{emp.employment.designation || 'Staff Member'}</p>
                  
                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                    <p className="text-xs text-slate-655 flex items-center gap-1.5">
                      <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                      {emp.employment.department || 'N/A'}
                    </p>
                    <p className="text-xs text-slate-655 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      {emp.employment.location || 'N/A'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 font-mono tracking-wider">#{emp.employeeId}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-12 flex items-center justify-center gap-4">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(p - 1, 1))}
                  className="flex items-center gap-1 rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer shadow-sm"
                >
                  <ArrowLeft className="h-4 w-4" /> Previous
                </button>
                <span className="text-sm text-slate-500">
                  Page <strong className="text-slate-900">{page}</strong> of <strong className="text-slate-900">{totalPages}</strong>
                </span>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                  className="flex items-center gap-1 rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer shadow-sm"
                >
                  Next <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}

        {/* Profile Detail Modal */}
        {selectedEmp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 md:p-8 text-slate-900 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
              <button
                onClick={() => setSelectedEmp(null)}
                className="absolute top-6 right-6 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>

              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
                {selectedEmp.personal.avatarUrl ? (
                  <img
                    src={selectedEmp.personal.avatarUrl}
                    alt={`${selectedEmp.personal.firstName} ${selectedEmp.personal.lastName}`}
                    className="h-20 w-20 rounded-2xl object-cover ring-2 ring-slate-200"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 font-bold text-2xl border border-slate-200">
                    {getInitials(selectedEmp.personal)}
                  </div>
                )}

                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="text-2xl font-extrabold text-slate-950">
                      {selectedEmp.personal.firstName} {selectedEmp.personal.lastName}
                    </h2>
                    {getStatusBadge(selectedEmp.employment.status)}
                  </div>
                  <p className="text-slate-500 font-medium">{selectedEmp.employment.designation || 'Staff Member'}</p>
                  <p className="text-xs text-slate-400 mt-1 font-mono">ID: {selectedEmp.employeeId}</p>
                </div>
              </div>

              {/* Grid content */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 max-h-[60vh] overflow-y-auto pr-2">
                {/* Personal Info */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <h3 className="mb-3 font-bold text-slate-950 border-b border-slate-200 pb-1">Personal Details</h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-slate-500 font-medium">Gender:</span> {selectedEmp.personal.gender || 'Not specified'}</p>
                    <p><span className="text-slate-500 font-medium">Marital Status:</span> {selectedEmp.personal.maritalStatus || 'Not specified'}</p>
                    <p><span className="text-slate-500 font-medium">Nationality:</span> {selectedEmp.personal.nationality || 'Not specified'}</p>
                    <p><span className="text-slate-500 font-medium">Date of Birth:</span> {selectedEmp.personal.dob ? new Date(selectedEmp.personal.dob).toLocaleDateString() : 'N/A'}</p>
                    <p><span className="text-slate-500 font-medium">Contact Number:</span> {selectedEmp.personal.contactNumber || 'N/A'}</p>
                    <p><span className="text-slate-500 font-medium">Personal Email:</span> {selectedEmp.personal.personalEmail || 'N/A'}</p>
                    <p><span className="text-slate-500 font-medium">Work Email:</span> <span className="text-slate-900 font-semibold">{selectedEmp.userId?.email || 'N/A'}</span></p>
                    <p><span className="text-slate-500 font-medium">Current Address:</span> {selectedEmp.personal.currentAddress || 'Not specified'}</p>
                    <p><span className="text-slate-500 font-medium">Permanent Address:</span> {selectedEmp.personal.permanentAddress || 'Not specified'}</p>
                  </div>
                </div>

                {/* Emergency Contact */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <h3 className="mb-3 font-bold text-slate-950 border-b border-slate-200 pb-1">Emergency Contact</h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-slate-500 font-medium">Name:</span> {selectedEmp.personal.emergencyContact?.name || 'N/A'}</p>
                    <p><span className="text-slate-500 font-medium">Relationship:</span> {selectedEmp.personal.emergencyContact?.relationship || 'N/A'}</p>
                    <p><span className="text-slate-500 font-medium">Phone:</span> {selectedEmp.personal.emergencyContact?.phone || 'N/A'}</p>
                  </div>
                </div>

                {/* Job details */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <h3 className="mb-3 font-bold text-slate-950 border-b border-slate-200 pb-1">Employment Details</h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-slate-500 font-medium">Department:</span> {selectedEmp.employment.department || 'N/A'}</p>
                    <p><span className="text-slate-500 font-medium">Location:</span> {selectedEmp.employment.location || 'N/A'}</p>
                    <p><span className="text-slate-500 font-medium">Grade:</span> {selectedEmp.employment.grade || 'N/A'}</p>
                    <p><span className="text-slate-500 font-medium">Employment Type:</span> {
                      selectedEmp.employment.employmentType === 'FULL_TIME' ? 'Full-time' :
                      selectedEmp.employment.employmentType === 'PART_TIME' ? 'Part-time' :
                      selectedEmp.employment.employmentType === 'CONTRACT' ? 'Contract' :
                      selectedEmp.employment.employmentType === 'INTERN' ? 'Intern' : selectedEmp.employment.employmentType || 'Full-time'
                    }</p>
                    <p><span className="text-slate-500 font-medium">Assigned Shift:</span> {selectedEmp.employment.assignedShift || 'No shift assigned'}</p>
                    <p><span className="text-slate-500 font-medium">Joining Date:</span> {selectedEmp.employment.joiningDate ? new Date(selectedEmp.employment.joiningDate).toLocaleDateString() : 'N/A'}</p>
                    <p>
                      <span className="text-slate-500 font-medium">Manager:</span>{' '}
                      {selectedEmp.employment.reportingManagerId ? (
                        <span className="font-semibold text-slate-900">
                          {selectedEmp.employment.reportingManagerId.personal?.firstName} {selectedEmp.employment.reportingManagerId.personal?.lastName}
                        </span>
                      ) : (
                        'No reporting manager'
                      )}
                    </p>
                  </div>
                </div>

                {/* Bank details (If loaded/present in profile) */}
                {selectedEmp.bankDetails && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                    <h3 className="mb-3 font-bold text-slate-950 border-b border-slate-200 pb-1 flex items-center gap-1.5">
                      Bank Details <span className="rounded bg-rose-50 border border-rose-100 px-1.5 py-0.5 text-[10px] text-rose-700 font-semibold uppercase tracking-wider">Sensitive</span>
                    </h3>
                    <div className="space-y-2 text-sm">
                      <p><span className="text-slate-500 font-medium">Account Holder:</span> {selectedEmp.bankDetails.accountHolderName || 'N/A'}</p>
                      <p><span className="text-slate-500 font-medium">Account Number:</span> {selectedEmp.bankDetails.accountNumber || 'N/A'}</p>
                      <p><span className="text-slate-500 font-medium">Bank Name:</span> {selectedEmp.bankDetails.bankName || 'N/A'}</p>
                      <p><span className="text-slate-500 font-medium">IFSC Code:</span> {selectedEmp.bankDetails.ifscCode || 'N/A'}</p>
                      <p><span className="text-slate-500 font-medium">PAN Card:</span> {selectedEmp.bankDetails.pan || 'N/A'}</p>
                    </div>
                  </div>
                )}

                {/* Statutory details (If loaded/present in profile) */}
                {selectedEmp.statutory && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                    <h3 className="mb-3 font-bold text-slate-950 border-b border-slate-200 pb-1 flex items-center gap-1.5">
                      Statutory Records <span className="rounded bg-rose-50 border border-rose-100 px-1.5 py-0.5 text-[10px] text-rose-700 font-semibold uppercase tracking-wider">Sensitive</span>
                    </h3>
                    <div className="space-y-2 text-sm">
                      <p><span className="text-slate-500 font-medium">UAN (PF):</span> {selectedEmp.statutory.uan || 'N/A'}</p>
                      <p><span className="text-slate-500 font-medium font-mono">PF Number:</span> {selectedEmp.statutory.pfNumber || 'N/A'}</p>
                      <p><span className="text-slate-500 font-medium">ESI Number:</span> {selectedEmp.statutory.esiNumber || 'N/A'}</p>
                      <p><span className="text-slate-500 font-medium">SSN (US):</span> {selectedEmp.statutory.ssn || 'N/A'}</p>
                    </div>
                  </div>
                )}
                {/* Professional History */}
                {selectedEmp.professional && 
                 ((selectedEmp.professional.education?.length > 0) || 
                  (selectedEmp.professional.experience?.length > 0) || 
                  (selectedEmp.professional.skills?.length > 0) || 
                  (selectedEmp.professional.certifications?.length > 0)) && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 md:col-span-2 space-y-4 text-sm">
                    <h3 className="font-bold text-slate-950 border-b border-slate-200 pb-1">
                      Professional Background
                    </h3>
                    
                    {/* Skills */}
                    {selectedEmp.professional.skills?.length > 0 && (
                      <div>
                        <span className="block text-xs font-semibold text-slate-500 mb-1.5">Key Skills & Tech Stack</span>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedEmp.professional.skills.map((skill, idx) => (
                            <span key={idx} className="rounded bg-slate-100 border border-slate-205 px-2 py-0.5 text-xs text-slate-805 font-medium">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Education */}
                    {selectedEmp.professional.education?.length > 0 && (
                      <div className="border-t border-slate-200 pt-3">
                        <span className="block text-xs font-semibold text-slate-555 mb-2">Education History</span>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {selectedEmp.professional.education.map((edu, idx) => (
                            <div key={idx} className="rounded-lg bg-white border border-slate-200 p-2.5 text-xs">
                              <span className="font-bold text-slate-900 block">{edu.degree} in {edu.fieldOfStudy}</span>
                              <span className="text-slate-800 font-semibold mt-0.5 block">{edu.institution}</span>
                              <span className="text-[10px] text-slate-400 mt-1 block font-mono">{edu.startYear} — {edu.endYear || 'Present'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Experience */}
                    {selectedEmp.professional.experience?.length > 0 && (
                      <div className="border-t border-slate-200 pt-3">
                        <span className="block text-xs font-semibold text-slate-555 mb-2">Prior Work History</span>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {selectedEmp.professional.experience.map((exp, idx) => (
                            <div key={idx} className="rounded-lg bg-white border border-slate-200 p-2.5 text-xs">
                              <span className="font-bold text-slate-900 block">{exp.designation}</span>
                              <span className="text-slate-800 font-semibold mt-0.5 block">{exp.company}</span>
                              {exp.description && <span className="text-slate-600 mt-1.5 block leading-relaxed">{exp.description}</span>}
                              <span className="text-[10px] text-slate-400 mt-2 block font-mono">
                                {exp.startDate ? new Date(exp.startDate).toLocaleDateString() : 'N/A'} — {exp.endDate ? new Date(exp.endDate).toLocaleDateString() : 'Present'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Certifications */}
                    {selectedEmp.professional.certifications?.length > 0 && (
                      <div className="border-t border-slate-200 pt-3">
                        <span className="block text-xs font-semibold text-slate-555 mb-2">Certifications & Credentials</span>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {selectedEmp.professional.certifications.map((cert, idx) => (
                            <div key={idx} className="rounded-lg bg-white border border-slate-200 p-2.5 text-xs">
                              <span className="font-bold text-slate-900 block">{cert.name}</span>
                              <span className="text-slate-800 font-semibold mt-0.5 block">{cert.issuer}</span>
                              {cert.credentialId && <span className="text-[10px] text-slate-400 mt-1 block font-mono">ID: {cert.credentialId}</span>}
                              <span className="text-[10px] text-slate-400 mt-1.5 block font-mono">
                                Issued: {cert.issueDate ? new Date(cert.issueDate).toLocaleDateString() : 'N/A'}
                                {cert.expiryDate ? ` — Expires: ${new Date(cert.expiryDate).toLocaleDateString()}` : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Documents & Attachments */}
                {selectedEmp.documents && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 md:col-span-2 space-y-3 animate-in fade-in duration-150">
                    <h3 className="mb-2 font-bold text-slate-950 border-b border-slate-200 pb-1 flex items-center gap-1.5">
                      <FileText className="h-4.5 w-4.5" /> Documents & Attachments
                    </h3>
                    {selectedEmp.documents.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No documents uploaded for this employee.</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        {selectedEmp.documents.map((doc) => (
                          <div key={doc._id} className="flex items-center justify-between p-3 rounded-lg bg-white border border-slate-200 text-xs hover:border-slate-300 transition duration-150">
                            <div>
                              <span className="font-bold text-slate-900 block">{doc.name}</span>
                              <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 border border-slate-200 text-slate-600">
                                {doc.type.replace('_', ' ')}
                              </span>
                            </div>
                            <a
                              href={doc.fileUrl.startsWith('http') ? doc.fileUrl : `${BASE_BACKEND_URL}${doc.fileUrl}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2.5 py-1 bg-slate-950 hover:bg-slate-900 border border-slate-950 hover:border-slate-900 rounded-lg text-white font-medium transition cursor-pointer"
                            >
                              <ExternalLink className="h-3.5 w-3.5" /> View
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Edit and Exit triggers */}
              <div className="mt-8 pt-6 border-t border-slate-200 flex flex-wrap justify-between gap-3">
                <div className="flex gap-2">
                  {(isAdmin || selectedEmp.userId?._id === user?.id) && (
                    <button
                      onClick={() => navigate(`/profile?id=${selectedEmp._id}`)}
                      className="rounded-xl bg-white hover:bg-slate-50 border border-slate-200 px-5 py-2 font-semibold transition cursor-pointer text-slate-800"
                    >
                      Update Profile
                    </button>
                  )}
                </div>

                {isAdmin && selectedEmp.employment.status !== 'EXITED' && (
                  <button
                    onClick={() => setShowExitModal(true)}
                    className="rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 px-5 py-2 font-semibold text-rose-700 transition cursor-pointer"
                  >
                    Terminate Employee
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Exit Terminate Dialog */}
        {showExitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-955/80 backdrop-blur-sm p-4">
            <form
              onSubmit={handleTerminateSubmit}
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150 text-slate-850"
            >
              <h3 className="text-xl font-bold text-rose-700 mb-2">Terminate Employee Record</h3>
              <p className="text-sm text-slate-600 mb-6">
                This action will mark the status of {selectedEmp?.personal?.firstName} {selectedEmp?.personal?.lastName} as EXITED. Physical deletions are disabled.
              </p>

              <div className="mb-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-550 mb-2">Exit Date</label>
                <input
                  type="date"
                  required
                  value={exitDate}
                  onChange={(e) => setExitDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-800 outline-none focus:border-rose-500"
                />
              </div>

              <div className="mb-6">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-555 mb-2">Exit Reason</label>
                <textarea
                  rows="3"
                  required
                  placeholder="e.g. Voluntary resignation, end of contract..."
                  value={exitReason}
                  onChange={(e) => setExitReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-800 outline-none focus:border-rose-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowExitModal(false)}
                  className="rounded-xl bg-white border border-slate-200 text-slate-700 px-4 py-2 text-sm font-semibold transition cursor-pointer hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 transition cursor-pointer shadow-md"
                >
                  Confirm Exit
                </button>
              </div>
            </form>
          </div>
        )}

        {/* CSV Import Modal */}
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-2xl relative animate-in zoom-in-95 duration-200 text-slate-850">
              <button
                onClick={() => { setShowImportModal(false); setImportResult(null); setCsvText(''); }}
                className="absolute top-6 right-6 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>

              <h2 className="text-2xl font-bold text-slate-950 mb-2">
                CSV Employee Bulk Import
              </h2>
              <p className="text-slate-500 text-sm mb-6">
                Paste raw CSV lines matching our import schema template. Users and profile shells will be created automatically.
              </p>

              {!importResult ? (
                <form onSubmit={handleBulkImport}>
                  <div className="mb-3 flex justify-between text-xs font-semibold text-slate-450">
                    <span>CSV TEMPLATE HEADER</span>
                    <span className="text-slate-800 font-mono">EmployeeID,FirstName,LastName,WorkEmail,Role,Department,Designation,Location,JoiningDate</span>
                  </div>
                  <textarea
                    rows="8"
                    required
                    placeholder="e.g.&#10;RV-102,Alice,Smith,alice@company.com,EMPLOYEE,Engineering,SDE,Headquarters,2026-06-01"
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950 resize-none"
                  />

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => { setShowImportModal(false); setCsvText(''); }}
                      className="rounded-xl bg-white border border-slate-200 text-slate-750 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={importLoading}
                      className="flex items-center gap-1.5 rounded-xl bg-slate-950 hover:bg-slate-900 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-55 transition cursor-pointer shadow-md"
                    >
                      {importLoading ? 'Processing Rows...' : 'Start Import'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 text-sm">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <span className="block text-xs text-slate-500">TOTAL PROCESSED</span>
                      <strong className="text-xl text-slate-900">{importResult.total}</strong>
                    </div>
                    <div>
                      <span className="block text-xs text-slate-500">SUCCESSFUL</span>
                      <strong className="text-xl text-emerald-700">{importResult.successCount}</strong>
                    </div>
                    <div>
                      <span className="block text-xs text-slate-500">FAILED</span>
                      <strong className="text-xl text-rose-700">{importResult.failureCount}</strong>
                    </div>
                  </div>

                  {importResult.failures?.length > 0 && (
                    <div>
                      <h4 className="font-bold text-rose-700 mb-2 flex items-center gap-1.5">
                        <ShieldAlert className="h-4 w-4" /> Failures Report ({importResult.failures.length})
                      </h4>
                      <div className="space-y-2">
                        {importResult.failures.map((f, idx) => (
                          <div key={idx} className="rounded-lg bg-rose-50 border border-rose-100 p-2.5 font-mono text-xs flex justify-between gap-4 text-rose-700">
                            <span>Row {f.row} ({f.email}):</span>
                            <span className="text-right font-bold text-rose-750">{f.error}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end pt-4">
                    <button
                      onClick={() => { setShowImportModal(false); setImportResult(null); setCsvText(''); }}
                      className="rounded-xl bg-slate-950 text-white px-6 py-2 font-bold cursor-pointer transition hover:bg-slate-900 shadow-md"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DirectoryPage;
