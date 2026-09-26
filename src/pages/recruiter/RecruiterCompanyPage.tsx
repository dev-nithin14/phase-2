import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { appStore } from '../../services/store';
import { Building2, Save, CheckCircle, Globe, MapPin, Users } from 'lucide-react';

export const RecruiterCompanyPage: React.FC = () => {
  const { user } = useAuth();
  const companies = appStore.getState().companies;
  const currentComp = companies[0] || {
    id: 'comp_default',
    recruiter_id: user?.id || 'rec_karthik',
    name: 'CloudScale Systems',
    logo_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=150',
    description: 'Enterprise cloud infrastructure and developer observability tooling company.',
    industry: 'Cloud Infrastructure & Developer Tools',
    location: 'Bengaluru / Mysuru, India',
    website: 'https://cloudscale.io',
    company_size: '51-200',
  };

  const [formData, setFormData] = useState(currentComp);
  const [saved, setSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="main-content" style={{ maxWidth: '860px' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
          Company & Recruiter Profile
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Manage your enterprise profile and technical hiring brand presentation.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card">
        {saved && (
          <div style={{ padding: '0.75rem 1rem', background: 'var(--status-verified-bg)', border: '1px solid var(--status-verified-border)', color: 'var(--status-verified)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={16} /> Company profile updated!
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
          <div className="form-group">
            <label className="form-label">Company Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Logo Image URL</label>
            <input
              type="url"
              value={formData.logo_url}
              onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
              className="form-input"
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">About the Company</label>
          <textarea
            rows={4}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="form-textarea"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', marginBottom: '1.5rem' }}>
          <div className="form-group">
            <label className="form-label">Industry</label>
            <input
              type="text"
              value={formData.industry}
              onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Headquarters Location</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Company Size</label>
            <select
              value={formData.company_size}
              onChange={(e) => setFormData({ ...formData, company_size: e.target.value })}
              className="form-select"
            >
              <option value="1-10">1-10 Employees</option>
              <option value="11-50">11-50 Employees</option>
              <option value="51-200">51-200 Employees</option>
              <option value="201-500">201-500 Employees</option>
              <option value="500+">500+ Employees</option>
            </select>
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: '2rem' }}>
          <label className="form-label">Company Website</label>
          <input
            type="url"
            value={formData.website}
            onChange={(e) => setFormData({ ...formData, website: e.target.value })}
            className="form-input"
          />
        </div>

        <button type="submit" className="btn btn-primary btn-lg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Save size={18} /> Save Company Profile
        </button>
      </form>
    </div>
  );
};
