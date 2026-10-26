'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Workspace, UserProfile, Channel } from '@orbit/types';
import {
  ArrowLeft,
  Search,
  Plus,
  Shield,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  X,
  RefreshCw,
  Layers,
  FolderKanban,
  Users,
  ChevronDown,
  Check,
} from 'lucide-react';

interface ProjectPortfolioViewProps {
  workspace: Workspace;
  currentUser: UserProfile | null;
  members?: any[];
  channels?: Channel[];
  onBackToOrganizationControl: () => void;
  onOpenProjectBoard?: (project: any) => void;
}

export const ProjectPortfolioView: React.FC<ProjectPortfolioViewProps> = ({
  workspace,
  currentUser,
  members = [],
  channels = [],
  onBackToOrganizationControl,
  onOpenProjectBoard,
}) => {
  const [projects, setProjects] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'inactive' | 'delivered'>('active');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // New / Edit Project Modal State (Matching Image 1)
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingProject, setEditingProject] = useState<any | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'delivered'>('active');
  const [assignedEmployees, setAssignedEmployees] = useState<Array<{ name: string; uid?: string }>>([]);
  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Envs Modal State
  const [showEnvsModal, setShowEnvsModal] = useState<boolean>(false);
  const [selectedEnvProject, setSelectedEnvProject] = useState<any | null>(null);

  const fetchProjects = async () => {
    try {
      setIsLoading(true);
      const res = await api.get(`/api/projects/workspaces/${workspace.id}/projects`);
      setProjects(res.data || []);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [workspace.id]);

  // Derived counts
  const activeCount = projects.filter((p) => (p.status || 'active').toLowerCase() === 'active').length;
  const inactiveCount = projects.filter((p) => (p.status || '').toLowerCase() === 'inactive').length;
  const deliveredCount = projects.filter((p) => (p.status || '').toLowerCase() === 'delivered').length;

  // Filtered projects
  const filteredProjects = projects.filter((p) => {
    const pStatus = (p.status || 'active').toLowerCase();
    if (activeTab === 'active' && pStatus !== 'active') return false;
    if (activeTab === 'inactive' && pStatus !== 'inactive') return false;
    if (activeTab === 'delivered' && pStatus !== 'delivered') return false;

    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;

    const mgrs = Array.isArray(p.selectedManagers)
      ? p.selectedManagers.map((m: any) => m.name || '').join(' ')
      : '';
    const creatorName = p.creator?.displayName || '';

    return (
      p.name.toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      mgrs.toLowerCase().includes(q) ||
      creatorName.toLowerCase().includes(q)
    );
  });

  const handleOpenCreateModal = () => {
    setEditingProject(null);
    setName('');
    setDescription('');
    setStatus(activeTab);
    setAssignedEmployees([]);
    setEmployeeDropdownOpen(false);
    setShowModal(true);
  };

  const handleOpenEditModal = (p: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProject(p);
    setName(p.name);
    setDescription(p.description || '');
    setStatus(p.status || 'active');

    const emps = Array.isArray(p.assignedEmployees) ? p.assignedEmployees : [];
    setAssignedEmployees(emps);
    setEmployeeDropdownOpen(false);
    setShowModal(true);
  };

  const handleToggleEmployee = (empName: string, empUid?: string) => {
    setAssignedEmployees((prev) => {
      const exists = prev.some((e) => e.name === empName);
      if (exists) {
        return prev.filter((e) => e.name !== empName);
      }
      return [...prev, { name: empName, uid: empUid || empName }];
    });
  };

  const handleRemoveEmployee = (empName: string) => {
    setAssignedEmployees((prev) => prev.filter((e) => e.name !== empName));
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      if (editingProject) {
        // Update existing project
        const res = await api.put(`/api/projects/${editingProject.id}`, {
          name: name.trim(),
          description: description.trim() || undefined,
          status,
          assignedEmployees,
        });
        setProjects((prev) => prev.map((item) => (item.id === editingProject.id ? res.data : item)));
      } else {
        // Create new project
        const res = await api.post(`/api/projects/workspaces/${workspace.id}/projects`, {
          name: name.trim(),
          description: description.trim() || undefined,
          status,
          assignedEmployees,
        });
        setProjects((prev) => [res.data, ...prev]);
      }
      setShowModal(false);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save project');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="flex-1 flex flex-col h-full w-full overflow-hidden"
      style={{
        backgroundColor: 'var(--theme-bg-app)',
        color: 'var(--theme-text-primary)',
      }}
    >
      {/* 1. Top Navbar Header */}
      <div
        className="h-16 px-6 sm:px-8 border-b flex items-center justify-between gap-4 shrink-0"
        style={{
          backgroundColor: 'var(--theme-bg-surface)',
          borderColor: 'var(--theme-border)',
        }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToOrganizationControl}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold hover:opacity-85 transition"
            style={{
              backgroundColor: 'var(--theme-bg-app)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-muted)',
            }}
          >
            <ArrowLeft size={14} />
            <span>Organization control</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Search box */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs w-48 sm:w-64"
            style={{
              backgroundColor: 'var(--theme-bg-app)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-muted)',
            }}
          >
            <Search size={14} />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-xs w-full text-white placeholder-gray-500"
            />
          </div>

          {/* New Project Button */}
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white shadow-sm transition hover:opacity-90"
            style={{ backgroundColor: 'var(--theme-primary)' }}
          >
            <Plus size={14} />
            <span>New Project</span>
          </button>

          <button
            onClick={fetchProjects}
            title="Refresh list"
            className="p-2 rounded-xl border hover:opacity-85 transition"
            style={{
              backgroundColor: 'var(--theme-bg-app)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-muted)',
            }}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 2. Main Content Body */}
      <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 space-y-6">
        {/* Title */}
        <div className="text-center pt-2 pb-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Project Portfolio
          </h1>
        </div>

        {/* Status Sub-tabs (Active, Inactive, Delivered) */}
        <div className="flex items-center gap-6 border-b" style={{ borderColor: 'var(--theme-border)' }}>
          <button
            onClick={() => setActiveTab('active')}
            className={`pb-3 text-sm font-semibold transition border-b-2 flex items-center gap-1.5 ${
              activeTab === 'active'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>Active</span>
            <span className="text-xs opacity-70">({activeCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('inactive')}
            className={`pb-3 text-sm font-semibold transition border-b-2 flex items-center gap-1.5 ${
              activeTab === 'inactive'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>Inactive</span>
            <span className="text-xs opacity-70">({inactiveCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('delivered')}
            className={`pb-3 text-sm font-semibold transition border-b-2 flex items-center gap-1.5 ${
              activeTab === 'delivered'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>Delivered</span>
            <span className="text-xs opacity-70">({deliveredCount})</span>
          </button>
        </div>

        {/* 3-Column Grid of Project Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-1">
          {filteredProjects.map((project) => {
            // Manager text
            let managerDisplay = 'Talal Siddiqui';
            if (Array.isArray(project.selectedManagers) && project.selectedManagers.length > 0) {
              managerDisplay = project.selectedManagers.map((m: any) => m.name || '').filter(Boolean).join(', ');
            } else if (project.creator?.displayName) {
              managerDisplay = project.creator.displayName;
            }

            // Assigned team avatars
            const assignedList: Array<{ name: string; uid?: string }> = Array.isArray(project.assignedEmployees)
              ? project.assignedEmployees
              : [];

            const isDelivered = (project.status || '').toLowerCase() === 'delivered';
            const isInactive = (project.status || '').toLowerCase() === 'inactive';

            return (
              <div
                key={project.id}
                onClick={() => onOpenProjectBoard?.(project)}
                className="rounded-2xl border p-5 transition duration-150 transform hover:-translate-y-0.5 hover:shadow-xl cursor-pointer flex flex-col justify-between group overflow-hidden"
                style={{
                  backgroundColor: 'var(--theme-bg-surface)',
                  borderColor: 'var(--theme-border)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                }}
              >
                <div>
                  {/* Card Header: Title & Status Badge */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-blue-400 transition truncate flex-1">
                      {project.name}
                    </h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase shrink-0 border ${
                        isDelivered
                          ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                          : isInactive
                          ? 'bg-slate-500/15 text-slate-300 border-slate-500/30'
                          : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                      }`}
                    >
                      {project.status || 'ACTIVE'}
                    </span>
                  </div>

                  {/* Manager Name */}
                  <div className="flex items-center gap-1.5 text-xs mb-3 text-slate-400">
                    <Users size={13} className="shrink-0 text-slate-400" />
                    <span className="truncate">{managerDisplay}</span>
                  </div>

                  {/* Description */}
                  <p
                    className="text-xs line-clamp-2 leading-relaxed mb-4 min-h-[36px]"
                    style={{ color: 'var(--theme-text-muted)' }}
                  >
                    {project.description || 'No description provided.'}
                  </p>
                </div>

                {/* Card Footer: Team Avatars + Action Links */}
                <div
                  className="pt-4 border-t flex items-center justify-between gap-2"
                  style={{ borderColor: 'var(--theme-border)' }}
                >
                  {/* Team Avatars */}
                  <div className="flex items-center -space-x-1.5 overflow-hidden">
                    {assignedList.slice(0, 4).map((emp, idx) => (
                      <div
                        key={emp.uid || idx}
                        title={emp.name}
                        className="w-6 h-6 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-200 shrink-0"
                      >
                        {emp.name?.[0]?.toUpperCase() || 'U'}
                      </div>
                    ))}
                    {assignedList.length > 4 && (
                      <span className="text-[10px] font-bold text-amber-400 pl-2">
                        +{assignedList.length - 4}
                      </span>
                    )}
                    {assignedList.length === 0 && (
                      <div
                        title={managerDisplay}
                        className="w-6 h-6 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-200 shrink-0"
                      >
                        {managerDisplay?.[0]?.toUpperCase() || 'M'}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons: Envs & Edit */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEnvProject(project);
                        setShowEnvsModal(true);
                      }}
                      className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition"
                    >
                      <Shield size={13} />
                      <span>Envs</span>
                    </button>

                    <button
                      onClick={(e) => handleOpenEditModal(project, e)}
                      className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1 transition"
                    >
                      <Edit2 size={13} />
                      <span>Edit</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredProjects.length === 0 && !isLoading && (
          <div className="py-20 text-center text-xs" style={{ color: 'var(--theme-text-muted)' }}>
            No projects found under this status.
          </div>
        )}
      </div>

      {/* Edit / Create Project Modal (Matching Image 1) */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div
            className="w-full max-w-lg rounded-2xl border p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150"
            style={{
              backgroundColor: 'var(--theme-bg-surface)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-primary)',
            }}
          >
            {/* Header: Edit Project / Create Project + close 'x' */}
            <div className="flex items-center justify-between pb-1">
              <h3 className="text-base font-bold text-white tracking-tight">
                {editingProject ? 'Edit Project' : 'New Project'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white transition p-1 rounded-lg hover:bg-white/5"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="space-y-4 text-xs">
              {/* Field 1: Project Title */}
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-200">
                  <span className="text-rose-500 mr-1">*</span>Project Title
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="DeepAi Logics"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/20 border border-slate-700/80 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition text-xs"
                />
              </div>

              {/* Field 2: Project Details */}
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-200">
                  <span className="text-rose-500 mr-1">*</span>Project Details
                </label>
                <textarea
                  rows={4}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="DeepAi Logics Personal Website"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/20 border border-slate-700/80 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition resize-none text-xs"
                />
              </div>

              {/* Field 3: Status */}
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-200">
                  <span className="text-rose-500 mr-1">*</span>Status
                </label>
                <div className="relative">
                  <select
                    value={status}
                    onChange={(e: any) => setStatus(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/20 border border-slate-700/80 text-white focus:outline-none focus:border-blue-500 transition appearance-none cursor-pointer text-xs pr-9"
                  >
                    <option value="active" className="bg-slate-900 text-white">Active</option>
                    <option value="inactive" className="bg-slate-900 text-white">Inactive</option>
                    <option value="delivered" className="bg-slate-900 text-white">Delivered</option>
                  </select>
                  <ChevronDown
                    size={16}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                </div>
              </div>

              {/* Field 4: Assign Employees */}
              <div className="relative">
                <label className="block text-xs font-semibold mb-1.5 text-slate-200">
                  Assign Employees
                </label>
                {/* Chip Box */}
                <div
                  onClick={() => setEmployeeDropdownOpen((prev) => !prev)}
                  className="min-h-[46px] w-full px-2.5 py-2 rounded-xl bg-black/20 border border-slate-700/80 flex flex-wrap items-center gap-1.5 cursor-pointer hover:border-slate-600 transition pr-8 relative"
                >
                  {assignedEmployees.length === 0 ? (
                    <span className="text-slate-500 text-xs px-1 select-none">
                      Select employees to assign...
                    </span>
                  ) : (
                    assignedEmployees.map((emp) => (
                      <span
                        key={emp.name}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-800 text-slate-200 border border-slate-700 shadow-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {emp.name}
                        <button
                          type="button"
                          onClick={() => handleRemoveEmployee(emp.name)}
                          className="text-slate-400 hover:text-rose-400 transition ml-0.5"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))
                  )}
                  <ChevronDown
                    size={16}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                </div>

                {/* Dropdown Menu of Available Workspace Members */}
                {employeeDropdownOpen && (
                  <div
                    className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border p-2 shadow-2xl max-h-52 overflow-y-auto space-y-1 animate-in fade-in zoom-in-95"
                    style={{
                      backgroundColor: 'var(--theme-bg-surface, #1e293b)',
                      borderColor: 'var(--theme-border, #334155)',
                    }}
                  >
                    {members && members.length > 0 ? (
                      members.map((member: any) => {
                        const mName = member.user?.displayName || member.user?.name || member.displayName || member.name || 'Member';
                        const mUid = member.userId || member.user?.id || member.id;
                        const isAssigned = assignedEmployees.some((e) => e.name === mName);
                        return (
                          <div
                            key={mUid || mName}
                            onClick={() => handleToggleEmployee(mName, mUid)}
                            className={`flex items-center justify-between px-3 py-1.5 rounded-lg cursor-pointer text-xs transition ${
                              isAssigned
                                ? 'bg-blue-600/20 text-blue-300 font-semibold'
                                : 'hover:bg-white/5 text-slate-300'
                            }`}
                          >
                            <span>{mName}</span>
                            {isAssigned && <Check size={14} className="text-blue-400" />}
                          </div>
                        );
                      })
                    ) : (
                      <div className="px-3 py-2 text-xs text-slate-500 text-center">
                        No team members found in workspace
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons: Cancel and Save */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t" style={{ borderColor: 'var(--theme-border)' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-700 bg-transparent text-slate-300 hover:text-white hover:bg-white/5 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 active:scale-98 shadow-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Environment Variables Modal */}
      {showEnvsModal && selectedEnvProject && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div
            className="w-full max-w-md rounded-2xl border p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
            style={{
              backgroundColor: 'var(--theme-bg-surface)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-primary)',
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--theme-border)' }}>
              <div className="flex items-center gap-2">
                <Shield size={18} className="text-blue-400" />
                <h3 className="text-base font-bold text-white">
                  Environment Keys - {selectedEnvProject.name}
                </h3>
              </div>
              <button
                onClick={() => setShowEnvsModal(false)}
                className="text-gray-400 hover:text-white transition"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-black/20 border border-white/5 space-y-1 font-mono text-[11px]">
                <div className="text-slate-400"># Project Config</div>
                <div className="text-emerald-400">PROJECT_ID={selectedEnvProject.projectId || selectedEnvProject.id}</div>
                <div className="text-emerald-400">WORKSPACE_ID={selectedEnvProject.workspaceId}</div>
                <div className="text-emerald-400">STATUS={selectedEnvProject.status || 'active'}</div>
                {selectedEnvProject.clientEmail && (
                  <div className="text-blue-400">CLIENT_EMAIL={selectedEnvProject.clientEmail}</div>
                )}
              </div>

              <p className="text-[11px] text-slate-400">
                Encrypted environment secrets are synced across Orbit production pipelines.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowEnvsModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
