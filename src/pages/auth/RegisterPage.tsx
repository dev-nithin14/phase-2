import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { ShieldCheck, Mail, ArrowRight, User, Building2, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState<UserRole>('JOB_SEEKER');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!email.trim() || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const res = await register({
      email,
      password,
      fullName,
      role,
      companyName: role === 'RECRUITER' ? companyName : undefined,
    });

    setLoading(false);

    if (res.success) {
      navigate(role === 'RECRUITER' ? '/recruiter/dashboard' : '/candidate/profile');
    } else {
      setErrorMsg(res.error || 'Registration failed. Please check your credentials and try again.');
    }
  };

  return (
    <div className="main-content" style={{ maxWidth: '520px', marginTop: '2rem', marginBottom: '3rem' }}>
      <div className="card" style={{ border: '1px solid var(--border-accent)', padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div className="brand-icon" style={{ width: '48px', height: '48px', margin: '0 auto 1rem' }}>
            <ShieldCheck size={26} color="#fff" />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Create Your Account</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Join the verified skill-first evaluation platform
          </p>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: '0.85rem 1rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-md)',
              color: '#ef4444',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1.25rem',
            }}
          >
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Role Picker */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">I am joining as a:</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div
                onClick={() => setRole('JOB_SEEKER')}
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  border: role === 'JOB_SEEKER' ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                  background: role === 'JOB_SEEKER' ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-surface)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                <User size={22} color={role === 'JOB_SEEKER' ? 'var(--accent-primary)' : 'var(--text-muted)'} style={{ margin: '0 auto 0.4rem' }} />
                <div style={{ fontWeight: 700, fontSize: '0.925rem' }}>Candidate</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Prove & showcase skills</div>
              </div>

              <div
                onClick={() => setRole('RECRUITER')}
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  border: role === 'RECRUITER' ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                  background: role === 'RECRUITER' ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-surface)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                <Building2 size={22} color={role === 'RECRUITER' ? 'var(--accent-primary)' : 'var(--text-muted)'} style={{ margin: '0 auto 0.4rem' }} />
                <div style={{ fontWeight: 700, fontSize: '0.925rem' }}>Recruiter</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Hire on verified proof</div>
              </div>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">Full Name</label>
            <div style={{ position: 'relative' }}>
              <User
                size={16}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '12px',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="text"
                required
                placeholder="Alex Morgan"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '2.4rem' }}
              />
            </div>
          </div>

          {role === 'RECRUITER' && (
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Company Name</label>
              <div style={{ position: 'relative' }}>
                <Building2
                  size={16}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '12px',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                />
                <input
                  type="text"
                  required
                  placeholder="Acme Technologies"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '2.4rem' }}
                />
              </div>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail
                size={16}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '12px',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="email"
                required
                placeholder="developer@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '2.4rem' }}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Password (min 6 characters)</label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={16}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '12px',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="password"
                required
                minLength={6}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '2.4rem' }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-lg"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            {loading ? 'Creating Account in Supabase...' : 'Create Account'} <ArrowRight size={16} />
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>Sign In</Link>
        </div>
      </div>
    </div>
  );
};

