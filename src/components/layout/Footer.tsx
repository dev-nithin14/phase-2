import React from 'react';
import { ShieldCheck, Award, Terminal } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', padding: '3rem 1.5rem', marginTop: 'auto' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '2rem' }}>
        <div style={{ maxWidth: '380px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem', fontWeight: 800, fontSize: '1.2rem' }}>
            <div className="brand-icon" style={{ width: '28px', height: '28px' }}>
              <ShieldCheck size={16} color="#07111F" />
            </div>
            <span>Beyond<span style={{ color: 'var(--accent-primary)' }}>TheResume</span></span>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Evidence-backed technical hiring platform. Don't just claim your skills. Prove them through verified assessments, project evidence, and deterministic matching.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-gold-light)', fontWeight: 600 }}>
              <Terminal size={14} /> HACKMYSURU 1.0 · PRESENTED BY RANKBOOK
            </div>
            <div>MYSURU · KARNATAKA · SEPTEMBER 2026</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '4rem', flexWrap: 'wrap' }}>
          <div>
            <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
              Core Workflow
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
              <li><span style={{ color: 'var(--text-secondary)' }}>1. Discover & Match</span></li>
              <li><span style={{ color: 'var(--text-secondary)' }}>2. Transparent Candidate Ranking</span></li>
              <li><span style={{ color: 'var(--text-secondary)' }}>3. Secure Assessment Execution</span></li>
              <li><span style={{ color: 'var(--text-secondary)' }}>4. Integrity Event Telemetry</span></li>
              <li><span style={{ color: 'var(--text-secondary)' }}>5. Verified Skill Passport</span></li>
            </ul>
          </div>

          <div>
            <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
              Verification Standards
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--status-verified)' }}>
                <Award size={14} /> Assessment-Backed
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-cyan)' }}>
                <Award size={14} /> Repository-Connected
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--status-verified)' }}>
                <Award size={14} /> Fully-Verified Credentials
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1400px', margin: '2rem auto 0', paddingTop: '1.5rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        <div>© 2026 Beyond the Resume. All rights reserved.</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span className="hackmysuru-badge" style={{ padding: '0.2rem 0.6rem', fontSize: '0.68rem' }}>
            🏛️ Mysuru · Karnataka · Sept 2026 | HackMysuru 1.0 | RankBook
          </span>
        </div>
      </div>
    </footer>
  );
};
