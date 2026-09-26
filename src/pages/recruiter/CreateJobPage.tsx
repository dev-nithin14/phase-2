import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { appStore } from '../../services/store';
import { supabase } from '../../services/supabase';
import { JobSkill } from '../../types';
import { Briefcase, ArrowLeft, Plus, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';

export const CreateJobPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [, setStoreRevision] = useState(0);
  const allSkills = appStore.getState().skills;
  const [companies, setCompanies] = useState(appStore.getState().companies.filter((company) => company.recruiter_id === user?.id));
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [companiesError, setCompaniesError] = useState('');

  useEffect(() => {
    const unsubscribe = appStore.subscribe(() => setStoreRevision((revision) => revision + 1));
    void appStore.syncFromSupabase();
    return unsubscribe;
  }, []);

  useEffect(() => {
    let active = true;
    const loadOwnedCompanies = async () => {
      if (!user) {
        setCompanies([]);
        setCompaniesLoading(false);
        return;
      }

      setCompaniesLoading(true);
      setCompaniesError('');
      const { data: { user: authenticatedUser }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authenticatedUser || authenticatedUser.id !== user.id) {
        throw new Error('The active Supabase user does not match the recruiter profile. Sign in again.');
      }

      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('recruiter_id', authenticatedUser.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (active) setCompanies(data || []);
    };

    loadOwnedCompanies()
      .catch((error: unknown) => {
        const details = error && typeof error === 'object' ? error as { code?: string; message?: string; details?: string } : {};
        const message = [details.code, details.message || (error instanceof Error ? error.message : String(error)), details.details]
          .filter(Boolean)
          .join(': ');
        if (active) {
          console.error('[CreateJobPage] Failed to load recruiter-owned companies:', error);
          setCompaniesError(message);
          setCompanies([]);
        }
      })
      .finally(() => { if (active) setCompaniesLoading(false); });

    return () => { active = false; };
  }, [user?.id]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    company_id: companies[0]?.id || '',
    employment_type: 'FULL_TIME' as const,
    location: '',
    work_mode: 'HYBRID' as const,
    min_experience: 0,
    max_experience: 0,
    min_salary: 0,
    max_salary: 0,
    salary_currency: 'INR',
    deadline: '',
    status: 'PUBLISHED' as const,
    assessment_required: true,
  });

  const [skillsConfig, setSkillsConfig] = useState<Array<{ skill_id: string; weight: number; is_required: boolean; min_acceptable_score: number }>>(() => {
    if (allSkills && allSkills.length >= 4) {
      return [
        { skill_id: allSkills[0].id, weight: 40, is_required: true, min_acceptable_score: 75 },
        { skill_id: allSkills[1].id, weight: 25, is_required: true, min_acceptable_score: 70 },
        { skill_id: allSkills[2].id, weight: 20, is_required: true, min_acceptable_score: 70 },
        { skill_id: allSkills[3].id, weight: 15, is_required: true, min_acceptable_score: 65 },
      ];
    }
    return [];
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const totalWeight = skillsConfig.reduce((acc, s) => acc + Number(s.weight), 0);

  const handleAddSkillRow = () => {
    const unselected = allSkills.find((s) => !skillsConfig.some((sc) => sc.skill_id === s.id));
    if (unselected) {
      setSkillsConfig([
        ...skillsConfig,
        { skill_id: unselected.id, weight: 10, is_required: true, min_acceptable_score: 60 },
      ]);
    }
  };

  const handleRemoveSkillRow = (index: number) => {
    setSkillsConfig(skillsConfig.filter((_, idx) => idx !== index));
  };

  const handleWeightChange = (index: number, weight: number) => {
    const updated = [...skillsConfig];
    updated[index].weight = weight;
    setSkillsConfig(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (totalWeight !== 100) {
      setErrorMsg(`Skill weights must sum to precisely 100%. Currently: ${totalWeight}%`);
      return;
    }
    const ownedCompany = companies.find((company) => company.id === formData.company_id && company.recruiter_id === user.id);
    if (!ownedCompany) {
      setErrorMsg('Select a company profile owned by your recruiter account before publishing a job.');
      return;
    }
    if (skillsConfig.length === 0) {
      setErrorMsg('Add at least one skill from the available skill catalog.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const compiledSkills: JobSkill[] = skillsConfig.map((sc, idx) => ({
        id: `js_${Date.now()}_${idx}`,
        job_id: '',
        skill_id: sc.skill_id,
        skill: allSkills.find((s) => s.id === sc.skill_id),
        weight: sc.weight,
        is_required: sc.is_required,
        min_acceptable_score: sc.min_acceptable_score,
      }));

      const targetCompany = companies.find((company) => company.id === formData.company_id && company.recruiter_id === user.id);
      if (!targetCompany) throw new Error('Select a company profile before publishing this job.');

      const created = await appStore.createJob({
        ...formData,
        company_id: targetCompany.id,
        company: targetCompany,
        recruiter_id: user.id,
        skills: compiledSkills,
      });

      navigate(`/recruiter/jobs/${created.id}/candidates`);
    } catch (err: any) {
      console.error('[CreateJobPage] Error persisting job:', err);
      setErrorMsg(err.message || 'Failed to persist job into Supabase database.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main-content" style={{ maxWidth: '860px' }}>
      <Link to="/recruiter/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
        <ArrowLeft size={16} /> Back to Dashboard
      </Link>

      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
          Create New Job Opportunity
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Specify required skill weights. Our matching engine uses these weights to deterministically rank applicants.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card">
        {errorMsg && (
          <div style={{ padding: '0.75rem 1rem', background: 'var(--status-danger-bg)', border: '1px solid var(--status-danger-border)', color: 'var(--status-danger)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={16} /> {errorMsg}
          </div>
        )}
        {companiesError && <div role="alert" style={{ padding: '0.75rem 1rem', border: '1px solid var(--status-danger-border)', color: 'var(--status-danger)', marginBottom: '1rem' }}>Unable to load your company profiles: {companiesError}</div>}

        <div className="form-group">
          <label className="form-label">Job Title</label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="form-input"
            placeholder="e.g. Senior Frontend Developer"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Company</label>
          <select
            required
            value={formData.company_id}
            onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
            className="form-select"
            disabled={companiesLoading || companies.length === 0}
          >
            <option value="">{companiesLoading ? 'Loading your companies…' : 'Select an owned company'}</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.industry})
              </option>
            ))}
          </select>
          {!companiesLoading && !companiesError && companies.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.4rem' }}>
              No company profile is owned by this recruiter account. A legitimate company relationship is required before publishing jobs.
            </p>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Job Description & Responsibilities</label>
          <textarea
            rows={4}
            required
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="form-textarea"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', marginBottom: '1.25rem' }}>
          <div className="form-group">
            <label className="form-label">Work Mode</label>
            <select
              value={formData.work_mode}
              onChange={(e) => setFormData({ ...formData, work_mode: e.target.value as any })}
              className="form-select"
            >
              <option value="HYBRID">Hybrid</option>
              <option value="REMOTE">Remote</option>
              <option value="ONSITE">Onsite</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Location</label>
            <input
              type="text"
              required
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Employment Type</label>
            <select
              value={formData.employment_type}
              onChange={(e) => setFormData({ ...formData, employment_type: e.target.value as any })}
              className="form-select"
            >
              <option value="FULL_TIME">Full Time</option>
              <option value="CONTRACT">Contract</option>
              <option value="INTERNSHIP">Internship</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.75rem' }}>
          <div className="form-group">
            <label className="form-label">Min Experience (Years)</label>
            <input
              type="number"
              min="0"
              value={formData.min_experience}
              onChange={(e) => setFormData({ ...formData, min_experience: Number(e.target.value) })}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Max Annual CTC (INR)</label>
            <input
              type="number"
              value={formData.max_salary}
              onChange={(e) => setFormData({ ...formData, max_salary: Number(e.target.value) })}
              className="form-input"
            />
          </div>
        </div>

        {/* Section 9: Required Skills & Skill Weights */}
        <div style={{ background: 'var(--bg-surface)', padding: '1.5rem', borderRadius: 'var(--radius-md)', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Required Skills & Weights</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Weights must total exactly 100%. Defines the deterministic matching algorithm.
              </p>
            </div>

            <div
              style={{
                fontSize: '1rem',
                fontWeight: 800,
                color: totalWeight === 100 ? 'var(--status-verified)' : 'var(--status-warning)',
              }}
            >
              Total Weight: {totalWeight}% / 100%
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {skillsConfig.map((sc, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <select
                  value={sc.skill_id}
                  onChange={(e) => {
                    const updated = [...skillsConfig];
                    updated[idx].skill_id = e.target.value;
                    setSkillsConfig(updated);
                  }}
                  className="form-select"
                  style={{ flex: 2 }}
                >
                  {allSkills.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.category})
                    </option>
                  ))}
                </select>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1 }}>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={sc.weight}
                    onChange={(e) => handleWeightChange(idx, Number(e.target.value))}
                    className="form-input"
                    style={{ width: '80px' }}
                  />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>%</span>
                </div>

                <div style={{ flex: 1 }}>
                  <input
                    type="number"
                    min="40"
                    max="100"
                    placeholder="Min Score"
                    value={sc.min_acceptable_score}
                    onChange={(e) => {
                      const updated = [...skillsConfig];
                      updated[idx].min_acceptable_score = Number(e.target.value);
                      setSkillsConfig(updated);
                    }}
                    className="form-input"
                    title="Minimum acceptable platform assessment score"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveSkillRow(idx)}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '0.5rem', color: 'var(--status-danger)' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddSkillRow}
            className="btn btn-secondary btn-sm"
            style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Plus size={14} /> Add Another Required Skill
          </button>
        </div>

        <button
          type="submit"
          disabled={totalWeight !== 100 || loading}
          className="btn btn-primary btn-lg"
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
        >
          {loading ? 'Publishing job...' : 'Publish Job & Calculate Candidate Matches'}
        </button>
      </form>
    </div>
  );
};
