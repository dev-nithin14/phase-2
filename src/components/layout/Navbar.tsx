import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { appStore } from '../../services/store';
import { 
  ShieldCheck, Briefcase, FileCode2, Award, Bell,
  User, Building2, ChevronDown
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, role, logout, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const notifications = user ? appStore.getNotifications(user.id) : [];
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkAsRead = (id: string) => {
    appStore.markNotificationAsRead(id);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  if (isLoading || !user || (role !== 'JOB_SEEKER' && role !== 'RECRUITER')) return null;

  return (
    <>
      {/* Main Navbar */}
      <nav className="navbar">
        <div className="nav-inner">
          {/* Brand */}
          <Link to="/" className="brand-logo">
            <div className="brand-icon">
              <ShieldCheck size={20} color="#fff" />
            </div>
            <span>Beyond<span style={{ color: 'var(--accent-primary)' }}>TheResume</span></span>
          </Link>

          {/* Navigation Links */}
          <ul className="nav-links">
            {role === 'JOB_SEEKER' ? (
              <>
                <Link to="/candidate/dashboard" className={`nav-link ${location.pathname === '/candidate/dashboard' ? 'active' : ''}`}>
                  Dashboard
                </Link>
                <Link to="/candidate/passport" className={`nav-link ${location.pathname === '/candidate/passport' ? 'active' : ''}`}>
                  <Award size={16} style={{ color: 'var(--status-verified)' }} /> Skill Passport
                </Link>
                <Link to="/candidate/projects" className={`nav-link ${location.pathname === '/candidate/projects' ? 'active' : ''}`}>
                  Projects
                </Link>
                <Link to="/candidate/skills" className={`nav-link ${location.pathname === '/candidate/skills' ? 'active' : ''}`}>
                  Skills
                </Link>
                <Link to="/candidate/applications" className={`nav-link ${location.pathname === '/candidate/applications' ? 'active' : ''}`}>
                  Applications
                </Link>
                <Link to="/candidate/assessments" className={`nav-link ${location.pathname.startsWith('/candidate/assessments') ? 'active' : ''}`}>
                  Assessments
                </Link>
                <Link to="/jobs" className={`nav-link ${location.pathname.startsWith('/jobs') ? 'active' : ''}`}>
                  <Briefcase size={16} /> Explore Jobs
                </Link>
              </>
            ) : (
              <>
                <Link to="/recruiter/dashboard" className={`nav-link ${location.pathname === '/recruiter/dashboard' ? 'active' : ''}`}>
                  Recruiter Hub
                </Link>
                <Link to="/recruiter/jobs" className={`nav-link ${location.pathname.startsWith('/recruiter/jobs') ? 'active' : ''}`}>
                  Manage Jobs
                </Link>
                <Link to="/recruiter/assessments" className={`nav-link ${location.pathname.startsWith('/recruiter/assessments') ? 'active' : ''}`}>
                  <FileCode2 size={16} /> Assessments
                </Link>
                <Link to="/recruiter/company" className={`nav-link ${location.pathname === '/recruiter/company' ? 'active' : ''}`}>
                  <Building2 size={16} /> Company
                </Link>
              </>
            )}
          </ul>

          {/* Actions & Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative' }}>
            {/* Notification Bell */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="btn btn-secondary btn-sm"
                style={{ position: 'relative', padding: '0.5rem' }}
                aria-label="Notifications"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      background: 'var(--accent-primary)',
                      color: '#fff',
                      borderRadius: '50%',
                      width: '18px',
                      height: '18px',
                      fontSize: '0.7rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                    }}
                  >
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover */}
              {showNotifications && (
                <div
                  style={{
                    position: 'absolute',
                    top: '120%',
                    right: 0,
                    width: '360px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: '0 15px 35px rgba(0,0,0,0.5)',
                    zIndex: 60,
                    padding: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Notifications</h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{unreadCount} unread</span>
                  </div>

                  <div style={{ maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {notifications.length === 0 ? (
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
                        No notifications yet.
                      </p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => handleMarkAsRead(n.id)}
                          style={{
                            padding: '0.65rem',
                            borderRadius: 'var(--radius-md)',
                            background: n.is_read ? 'transparent' : 'rgba(99, 102, 241, 0.08)',
                            border: n.is_read ? '1px solid var(--border-subtle)' : '1px solid var(--border-accent)',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.2rem' }}>
                            <strong style={{ fontSize: '0.825rem', color: 'var(--text-primary)' }}>{n.title}</strong>
                            {!n.is_read && <span className="live-indicator" />}
                          </div>
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{n.message}</p>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Authenticated profile menu */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0.75rem' }}
              >
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.full_name}
                    style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <User size={18} />
                )}
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user?.full_name}</span>
                <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
              </button>

              {showUserMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: '120%',
                    right: 0,
                    width: '280px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: '0 15px 35px rgba(0,0,0,0.5)',
                    zIndex: 60,
                    padding: '0.85rem',
                  }}
                >
                  <div style={{ paddingBottom: '0.6rem', marginBottom: '0.6rem', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{user.full_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user.email}</div>
                    <div style={{ marginTop: '0.4rem' }}>
                      <span className={`badge ${role === 'JOB_SEEKER' ? 'badge-verified' : 'badge-accent'}`}>
                        {role === 'JOB_SEEKER' ? 'CANDIDATE' : role}
                      </span>
                    </div>
                  </div>

                  <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <Link
                      to={role === 'RECRUITER' ? '/recruiter/company' : '/candidate/profile'}
                      onClick={() => setShowUserMenu(false)}
                      style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0.3rem 0.5rem', borderRadius: 'var(--radius-sm)', textDecoration: 'none' }}
                    >
                      Profile
                    </Link>
                    <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>
    </>
  );
};
