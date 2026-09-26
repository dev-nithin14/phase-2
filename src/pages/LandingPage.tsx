import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldCheck, Award, FileCode2, ArrowRight, CheckCircle2, 
  Terminal, Search, Cpu, Users, Layers, Zap 
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { role } = useAuth();

  return (
    <div>
      {/* Hero Section */}
      <section
        style={{
          padding: '5rem 1.5rem 6rem',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
          background: 'radial-gradient(ellipse at 50% 10%, rgba(99, 102, 241, 0.15) 0%, rgba(7, 9, 14, 1) 75%)',
        }}
      >
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.4rem 1rem',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              color: '#A5B4FC',
              fontSize: '0.85rem',
              fontWeight: 600,
              marginBottom: '1.75rem',
            }}
          >
            <ShieldCheck size={16} />
            <span>The Evidence-Based Technical Hiring Platform</span>
          </div>

          <h1
            style={{
              fontSize: '3.5rem',
              fontWeight: 900,
              lineHeight: 1.15,
              marginBottom: '1.5rem',
              letterSpacing: '-0.03em',
            }}
          >
            Don't just claim your skills. <br />
            <span style={{ background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Prove them.
            </span>
          </h1>

          <p
            style={{
              fontSize: '1.25rem',
              color: 'var(--text-secondary)',
              maxWidth: '720px',
              margin: '0 auto 2.5rem',
              lineHeight: 1.6,
            }}
          >
            Prove what you can build. Verify what you know. Connect with top tech teams through verified coding assessments, code evidence, and deterministic ranking.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <Link to="/jobs" className="btn btn-primary btn-lg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Find Opportunities <ArrowRight size={18} />
            </Link>
            <Link to="/recruiter/dashboard" className="btn btn-secondary btn-lg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Hire Verified Talent
            </Link>
          </div>
        </div>
      </section>

      {/* The Central Differentiator (Not LinkedIn / Indeed) */}
      <section style={{ maxWidth: '1280px', margin: '0 auto', padding: '4rem 1.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '0.75rem' }}>
            The Central Differentiator
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '650px', margin: '0 auto' }}>
            Traditional platforms rely on subjective text resumes and keyword matching. Beyond the Resume grounds hiring in verifiable technical evidence.
          </p>
        </div>

        <div className="grid-3">
          <div className="card card-interactive">
            <div className="brand-icon" style={{ marginBottom: '1.25rem' }}>
              <Award size={20} color="#fff" />
            </div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Verified Skill Passport</h3>
            <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>
              A dynamic digital credential aggregating sandboxed assessment scores and validated GitHub project evidence. Automatically updates as you prove abilities.
            </p>
          </div>

          <div className="card card-interactive">
            <div className="brand-icon" style={{ marginBottom: '1.25rem' }}>
              <Cpu size={20} color="#fff" />
            </div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Deterministic Matching</h3>
            <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>
              Job-specific candidate matching based on transparent skill weights, assessment outcomes, and repository proofs. Never a black-box AI ranking.
            </p>
          </div>

          <div className="card card-interactive">
            <div className="brand-icon" style={{ marginBottom: '1.25rem' }}>
              <Terminal size={20} color="#fff" />
            </div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Secure Code Sandbox</h3>
            <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>
              In-browser Monaco Editor running isolated test suites with timeouts, memory tracking, and fair proctoring telemetry for recruiter review.
            </p>
          </div>
        </div>
      </section>

      {/* The 6-Step Workflow */}
      <section style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', padding: '5rem 1.5rem' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <span className="badge badge-accent" style={{ marginBottom: '0.5rem' }}>End-to-End Pipeline</span>
            <h2 style={{ fontSize: '2.25rem', fontWeight: 800 }}>
              DISCOVER → MATCH → CONNECT → ASSESS → VERIFY → PROVE → HIRE
            </h2>
          </div>

          <div className="grid-3">
            {[
              { num: '01', title: 'Build Profile', desc: 'Declare your skills and link live GitHub repositories.' },
              { num: '02', title: 'Get Matched', desc: 'Our engine computes transparent weighted match scores for open opportunities.' },
              { num: '03', title: 'Take Coding Challenge', desc: 'Solve real-world challenges in Monaco Editor with proctored telemetry.' },
              { num: '04', title: 'Deterministic Evaluation', desc: 'Scores calculated on Correctness, Efficiency, Code Quality, and Coverage.' },
              { num: '05', title: 'Skill Passport Updated', desc: 'Verified badges and score receipts attach directly to your credential.' },
              { num: '06', title: 'Direct Hiring', desc: 'Recruiters review verified evidence and move qualified engineers straight to interview.' },
            ].map((step, idx) => (
              <div key={idx} className="card" style={{ background: 'var(--bg-surface)' }}>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--accent-primary)', marginBottom: '0.5rem' }}>
                  {step.num}
                </div>
                <h4 style={{ fontSize: '1.15rem', marginBottom: '0.4rem' }}>{step.title}</h4>
                <p style={{ fontSize: '0.875rem' }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ready to Prove Section */}
      <section style={{ maxWidth: '960px', margin: '5rem auto', padding: '0 1.5rem', textAlign: 'center' }}>
        <div className="card" style={{ border: '1px solid var(--border-accent)', padding: '3.5rem 2rem' }}>
          <h2 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '1rem' }}>
            Ready to prove what you can build?
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto 2rem' }}>
            Join software developers and forward-thinking engineering companies hiring on proven technical evidence.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <Link to="/candidate/dashboard" className="btn btn-primary btn-lg">
              Open Candidate Portal
            </Link>
            <Link to="/recruiter/dashboard" className="btn btn-secondary btn-lg">
              Launch Recruiter Hub
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
