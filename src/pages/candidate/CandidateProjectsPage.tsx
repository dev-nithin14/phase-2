import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { appStore } from '../../services/store';
import { Project, ProjectStatus } from '../../types';
import { 
  FolderGit2, Plus, GitBranch, ExternalLink, Users, 
  Calendar, CheckCircle, Award, ShieldCheck 
} from 'lucide-react';

export const CandidateProjectsPage: React.FC = () => {
  const { user } = useAuth();
  if (!user) return null;

  const projects = appStore.getCandidateProjects(user.id);
  const allSkills = appStore.getState().skills;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    github_url: '',
    live_url: '',
    candidate_role: 'Lead Architect',
    team_size: 1,
    completion_date: '2026-06-01',
    selectedSkillIds: [allSkills[0]?.id || ''],
  });

  const handleAddProject = (e: React.FormEvent) => {
    e.preventDefault();
    const chosenSkills = allSkills.filter((s) => formData.selectedSkillIds.includes(s.id));

    appStore.addCandidateProject(user.id, {
      title: formData.title,
      description: formData.description,
      github_url: formData.github_url,
      live_url: formData.live_url,
      candidate_role: formData.candidate_role,
      team_size: Number(formData.team_size),
      completion_date: formData.completion_date,
      verification_status: formData.github_url ? 'REPOSITORY_CONNECTED' : 'ADDED',
      skills: chosenSkills,
    });

    setIsModalOpen(false);
    setFormData({
      title: '',
      description: '',
      github_url: '',
      live_url: '',
      candidate_role: 'Lead Developer',
      team_size: 1,
      completion_date: '2026-06-01',
      selectedSkillIds: [allSkills[0]?.id || ''],
    });
  };

  const getStatusBadge = (status: ProjectStatus) => {
    switch (status) {
      case 'EVIDENCE_REVIEWED':
        return <span className="badge badge-verified">Evidence Reviewed</span>;
      case 'REPOSITORY_CONNECTED':
        return <span className="badge badge-accent">Repository Connected</span>;
      case 'LINK_VERIFIED':
        return <span className="badge badge-neutral">Link Verified</span>;
      case 'ADDED':
      default:
        return <span className="badge badge-neutral">Added</span>;
    }
  };

  return (
    <div className="main-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
            Verified Project Evidence
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Code repositories prove hands-on application and directly elevate your Skill Passport ranking.
          </p>
        </div>

        <button onClick={() => setIsModalOpen(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Plus size={16} /> Connect Project Repository
        </button>
      </div>

      {/* Projects Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {projects.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3.5rem' }}>
            <FolderGit2 size={36} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>No projects connected yet</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Connect your GitHub projects to attach verifiable code evidence to your skills.
            </p>
            <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
              Connect First Project
            </button>
          </div>
        ) : (
          projects.map((proj) => (
            <div key={proj.id} className="card" style={{ padding: '1.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 700 }}>{proj.title}</h3>
                    {getStatusBadge(proj.verification_status)}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                    <span>Role: <strong>{proj.candidate_role}</strong></span>
                    <span>•</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Users size={14} /> Team Size: {proj.team_size}
                    </span>
                    <span>•</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Calendar size={14} /> {proj.completion_date}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  {proj.github_url && (
                    <a
                      href={proj.github_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <GitBranch size={14} /> Repository
                    </a>
                  )}
                  {proj.live_url && (
                    <a
                      href={proj.live_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <ExternalLink size={14} /> Live Demo
                    </a>
                  )}
                </div>
              </div>

              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                {proj.description}
              </p>

              {/* Demonstrated Skills Tag Bar */}
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
                  Skills Demonstrated & Verified:
                </span>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {proj.skills?.map((s) => (
                    <span key={s.id} className="badge badge-accent">
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Project Modal */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1.5rem',
          }}
        >
          <div className="card" style={{ maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border-accent)' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '1.25rem' }}>Connect Project Repository Proof</h2>

            <form onSubmit={handleAddProject}>
              <div className="form-group">
                <label className="form-label">Project Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Distributed Task Queue"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description of Engineering Implementation</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain architecture, throughput, technical challenges overcome..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="form-textarea"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">GitHub Repository URL</label>
                  <input
                    type="url"
                    placeholder="https://github.com/..."
                    value={formData.github_url}
                    onChange={(e) => setFormData({ ...formData, github_url: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Live Deployment URL (Optional)</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={formData.live_url}
                    onChange={(e) => setFormData({ ...formData, live_url: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Your Role</label>
                  <input
                    type="text"
                    value={formData.candidate_role}
                    onChange={(e) => setFormData({ ...formData, candidate_role: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Team Size</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.team_size}
                    onChange={(e) => setFormData({ ...formData, team_size: Number(e.target.value) })}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Completion Date</label>
                  <input
                    type="date"
                    value={formData.completion_date}
                    onChange={(e) => setFormData({ ...formData, completion_date: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Select Skills Demonstrated in Code</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', maxHeight: '120px', overflowY: 'auto', padding: '0.5rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)' }}>
                  {allSkills.map((s) => {
                    const isSelected = formData.selectedSkillIds.includes(s.id);
                    return (
                      <button
                        type="button"
                        key={s.id}
                        onClick={() => {
                          if (isSelected) {
                            setFormData({
                              ...formData,
                              selectedSkillIds: formData.selectedSkillIds.filter((id) => id !== s.id),
                            });
                          } else {
                            setFormData({
                              ...formData,
                              selectedSkillIds: [...formData.selectedSkillIds, s.id],
                            });
                          }
                        }}
                        className={`badge ${isSelected ? 'badge-verified' : 'badge-neutral'}`}
                        style={{ cursor: 'pointer', padding: '0.35rem 0.65rem' }}
                      >
                        {s.name} {isSelected ? '✓' : '+'}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save & Connect Proof
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
