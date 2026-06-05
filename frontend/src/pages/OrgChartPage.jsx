import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { ShieldAlert, Users, ChevronDown, ChevronRight, User } from 'lucide-react';
import api from '../services/api';

const OrgChartPage = () => {
  const { user } = useSelector((state) => state.auth);
  
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Controls collapse states of node sub-trees
  const [collapsedNodes, setCollapsedNodes] = useState({});

  useEffect(() => {
    fetchDirectory();
  }, []);

  const fetchDirectory = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all employees to construct the local hierarchy tree
      const response = await api.get('/employees', { params: { limit: 200 } });
      setEmployees(response.data.employees || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to retrieve directory structure.');
    } finally {
      setLoading(false);
    }
  };

  const toggleCollapse = (id) => {
    setCollapsedNodes(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Recursively renders tree nodes
  const renderTreeNode = (node) => {
    const isCollapsed = collapsedNodes[node._id];
    const hasChildren = node.children && node.children.length > 0;
    const isSelf = node.userId?._id === user?.id || node.userId === user?.id;

    return (
      <div key={node._id} className="flex flex-col items-center">
        {/* Connection line helper */}
        <div className="h-4 w-0.5 bg-slate-700/60"></div>
        
        {/* Node box */}
        <div className={`relative flex flex-col items-center rounded-2xl border bg-slate-950 p-4 min-w-[200px] text-center shadow-lg transition duration-200 ${
          isSelf 
            ? 'border-teal-400 bg-teal-500/5 ring-1 ring-teal-500/20' 
            : 'border-slate-800/80 bg-slate-900/30 hover:border-slate-700'
        }`}>
          {/* Initials badge */}
          <div className={`mb-2 flex h-10 w-10 items-center justify-center rounded-xl font-bold text-xs border ${
            isSelf 
              ? 'bg-teal-500/20 text-teal-300 border-teal-500/30' 
              : 'bg-slate-800/50 text-slate-300 border-slate-700/50'
          }`}>
            {`${node.personal?.firstName?.[0] || 'E'}${node.personal?.lastName?.[0] || ''}`}
          </div>

          <h4 className="text-sm font-bold text-slate-100">
            {node.personal?.firstName} {node.personal?.lastName}
          </h4>
          <p className="text-[11px] text-slate-400 font-medium mt-0.5">{node.employment?.designation || 'Staff Member'}</p>
          <span className="text-[10px] text-slate-500 mt-1 uppercase font-semibold tracking-wider font-sans">
            {node.employment?.department || 'N/A'}
          </span>

          {/* Expand/Collapse Toggle */}
          {hasChildren && (
            <button
              onClick={() => toggleCollapse(node._id)}
              className="absolute -bottom-3 rounded-full bg-slate-800 border border-slate-700 p-0.5 text-slate-400 hover:text-slate-200 transition cursor-pointer"
            >
              {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}
        </div>

        {/* Children nodes container */}
        {hasChildren && !isCollapsed && (
          <div className="flex flex-col items-center">
            {/* Split connection lines */}
            <div className="h-4 w-0.5 bg-slate-700/60"></div>
            
            <div className="relative flex gap-6 pt-2">
              {/* Draw horizontal connector bar for children */}
              {node.children.length > 1 && (
                <div className="absolute top-0 left-[10%] right-[10%] h-0.5 bg-slate-700/60"></div>
              )}
              
              {node.children.map(child => renderTreeNode(child))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Build the hierarchical tree structure from flat directory array
  const buildHierarchy = () => {
    // Index employees by ID
    const employeeMap = {};
    employees.forEach(emp => {
      employeeMap[emp._id] = { ...emp, children: [] };
    });

    const roots = [];

    employees.forEach(emp => {
      const mappedNode = employeeMap[emp._id];
      const managerId = emp.employment?.reportingManagerId?._id || emp.employment?.reportingManagerId;

      if (managerId && employeeMap[managerId]) {
        // Add to manager's children array
        employeeMap[managerId].children.push(mappedNode);
      } else {
        // No valid reporting manager inside index, belongs to root layer
        roots.push(mappedNode);
      }
    });

    return roots;
  };

  const hierarchyRoots = buildHierarchy();

  return (
    <div className="min-h-screen bg-radial from-slate-900 via-slate-950 to-black p-6 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 text-center md:text-left">
          <h1 className="bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
            Organizational Structure Chart
          </h1>
          <p className="mt-1 text-slate-400 text-sm">
            View the corporate reporting connections and organizational reporting trees.
          </p>
        </div>

        {loading ? (
          <div className="flex h-96 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent"></div>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-center max-w-md mx-auto mt-12">
            <ShieldAlert className="mx-auto mb-2 h-10 w-10 text-rose-400" />
            <p className="font-semibold text-rose-300">{error}</p>
          </div>
        ) : hierarchyRoots.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/20 p-12 text-center text-slate-400 max-w-md mx-auto mt-12">
            <p className="font-medium text-lg">No active employee nodes registered in hierarchy.</p>
          </div>
        ) : (
          /* Tree roots wrapper */
          <div className="overflow-x-auto pb-16 pt-4 flex flex-col items-center min-w-full">
            <div className="flex flex-col items-center gap-12">
              {hierarchyRoots.map(rootNode => (
                <div key={rootNode._id} className="flex flex-col items-center">
                  {/* Root box */}
                  <div className={`relative flex flex-col items-center rounded-2xl border p-5 min-w-[210px] text-center shadow-xl transition duration-200 ${
                    rootNode.userId?._id === user?.id || rootNode.userId === user?.id
                      ? 'border-teal-400 bg-teal-500/5 ring-1 ring-teal-500/20' 
                      : 'border-slate-800/80 bg-slate-900/30'
                  }`}>
                    {/* Initials badge */}
                    <div className="mb-2.5 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500/20 to-cyan-500/20 text-teal-300 font-extrabold text-sm border border-teal-500/20">
                      {`${rootNode.personal?.firstName?.[0] || 'E'}${rootNode.personal?.lastName?.[0] || ''}`}
                    </div>

                    <h4 className="font-extrabold text-slate-100">
                      {rootNode.personal?.firstName} {rootNode.personal?.lastName}
                    </h4>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">{rootNode.employment?.designation || 'Staff Member'}</p>
                    <span className="text-[10px] text-slate-500 mt-1 uppercase font-semibold tracking-wider">
                      {rootNode.employment?.department || 'N/A'}
                    </span>
                    
                    {rootNode.children?.length > 0 && (
                      <button
                        onClick={() => toggleCollapse(rootNode._id)}
                        className="absolute -bottom-3 rounded-full bg-slate-850 border border-slate-700 p-0.5 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                      >
                        {collapsedNodes[rootNode._id] ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>

                  {rootNode.children?.length > 0 && !collapsedNodes[rootNode._id] && (
                    <div className="flex flex-col items-center">
                      <div className="h-6 w-0.5 bg-slate-700/60"></div>
                      <div className="relative flex gap-8 pt-2">
                        {rootNode.children.length > 1 && (
                          <div className="absolute top-0 left-[10%] right-[10%] h-0.5 bg-slate-700/60"></div>
                        )}
                        {rootNode.children.map(child => renderTreeNode(child))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrgChartPage;
