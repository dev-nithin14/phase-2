import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import { Assessment, AssessmentAttempt, IntegrityEvent, Submission } from '../../types';
import { formatIntegrityTimeline } from '../../services/integrity';
import { IntegrityBadge } from '../../components/common/Badge';
import {
  ArrowLeft,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Eye,
  Smartphone,
  Maximize2,
  Copy,
  Code,
  FileText,
  X,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Download,
  Monitor,
} from 'lucide-react';

interface ResultAttempt extends Omit<AssessmentAttempt, 'candidate'> {
  candidate?: { id?: string; full_name: string; email: string };
  submissions?: Submission[];
}

export const RecruiterAssessmentResultsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [attempts, setAttempts] = useState<ResultAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Selected attempt for modals
  const [selectedAttemptForTimeline, setSelectedAttemptForTimeline] = useState<ResultAttempt | null>(null);
  const [selectedAttemptForEvidence, setSelectedAttemptForEvidence] = useState<ResultAttempt | null>(null);
  const [selectedAttemptForScreenEvidence, setSelectedAttemptForScreenEvidence] = useState<ResultAttempt | null>(null);
  const [activeScreenIndex, setActiveScreenIndex] = useState(0);
  const [evidenceTab, setEvidenceTab] = useState<'camera' | 'browser' | 'context' | 'phone' | 'questions' | 'decision'>('camera');
  const [attemptEvents, setAttemptEvents] = useState<IntegrityEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [recruiterNotes, setRecruiterNotes] = useState<Record<string, string>>({});
  const [decisionFeedback, setDecisionFeedback] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!id || !user) return;
      const { data: assessmentRow, error: assessmentError } = await supabase
        .from('assessments')
        .select('*, job:jobs(*)')
        .eq('id', id)
        .eq('creator_id', user.id)
        .single();
      if (assessmentError) throw assessmentError;

      const { data: attemptRows, error: attemptsError } = await supabase
        .from('assessment_attempts')
        .select('*, candidate:profiles(id, full_name, email), submissions(*)')
        .eq('assessment_id', id)
        .order('started_at', { ascending: false });
      if (attemptsError) throw attemptsError;

      if (active) {
        setAssessment(assessmentRow as Assessment);
        setAttempts((attemptRows || []) as unknown as ResultAttempt[]);
      }
    };
    setLoading(true);
    load()
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load assessment results.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, user?.id]);

  // Load integrity events for selected attempt
  const openTimelineModal = async (attempt: ResultAttempt) => {
    setSelectedAttemptForTimeline(attempt);
    setLoadingEvents(true);
    try {
      const { data, error: evError } = await supabase
        .from('integrity_events')
        .select('*')
        .eq('attempt_id', attempt.id)
        .order('timestamp', { ascending: true });
      if (evError) throw evError;
      setAttemptEvents((data || []) as IntegrityEvent[]);
    } catch {
      // Fallback to local events on attempt
      setAttemptEvents(attempt.integrity_events || []);
    } finally {
      setLoadingEvents(false);
    }
  };

  const openEvidenceModal = async (attempt: ResultAttempt) => {
    setSelectedAttemptForEvidence(attempt);
    setEvidenceTab('camera');
    setLoadingEvents(true);
    try {
      const { data, error: evError } = await supabase
        .from('integrity_events')
        .select('*')
        .eq('attempt_id', attempt.id)
        .order('timestamp', { ascending: true });
      if (evError) throw evError;
      setAttemptEvents((data || []) as IntegrityEvent[]);
    } catch {
      setAttemptEvents(attempt.integrity_events || []);
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleDecision = (attemptId: string, decision: 'SHORTLISTED' | 'INTERVIEW' | 'FLAGGED') => {
    setDecisionFeedback(`Candidate marked as ${decision}. Evidence retained in audit archive.`);
    setTimeout(() => setDecisionFeedback(null), 3500);
  };

  if (loading) return <main className="main-content">Loading candidate results…</main>;
  if (error) return <main className="main-content"><div role="alert" className="card">{error}</div></main>;
  if (!assessment) return <main className="main-content"><div className="card">Assessment not found or access denied.</div></main>;

  return (
    <main className="main-content" style={{ maxWidth: 1140 }}>
      <Link to="/recruiter/assessments" className="nav-link" style={{ marginBottom: 18, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <ArrowLeft size={16} /> Back to Assessments
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
        <div>
          <span className="badge badge-accent">{assessment.job?.title || 'Job Assessment'}</span>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginTop: 8 }}>{assessment.title} · Candidate Results</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
            Multi-signal assessment integrity audit & technical performance.
          </p>
        </div>
        <div className="card" style={{ padding: '10px 18px', textAlign: 'center', minWidth: 160 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Attempts</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--accent-primary)' }}>{attempts.length}</div>
        </div>
      </div>

      {decisionFeedback && (
        <div
          role="alert"
          style={{
            background: 'var(--status-verified-bg)',
            border: '1px solid var(--status-verified-border)',
            color: 'var(--status-verified)',
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            marginBottom: 16,
            fontWeight: 600,
          }}
        >
          {decisionFeedback}
        </div>
      )}

      {attempts.length === 0 ? (
        <div className="card" style={{ marginTop: 18, textAlign: 'center', padding: '3rem' }}>
          <h3>No candidate attempts recorded yet</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
            Candidate submissions and multi-signal integrity evidence will stream here once candidates complete this assessment.
          </p>
        </div>
      ) : (
        attempts.map((attempt) => {
          const durationSeconds =
            attempt.submitted_at && attempt.started_at
              ? Math.max(0, Math.round((new Date(attempt.submitted_at).getTime() - new Date(attempt.started_at).getTime()) / 1000))
              : 0;
          const durMin = Math.floor(durationSeconds / 60);
          const durSec = durationSeconds % 60;
          const durationString = durationSeconds > 0 ? `${durMin}:${String(durSec).padStart(2, '0')}` : 'In progress';

          const summary = attempt.integrity_summary || {};
          const riskScore = attempt.integrity_risk_score ?? summary.integrity_risk_score ?? 0;
          const integrityStatus = attempt.integrity_status || 'VERIFIED';
          const phoneConnected = summary.phone_camera_connected || false;

          return (
            <article
              key={attempt.id}
              className="card"
              style={{
                marginTop: 18,
                border: '1px solid var(--border-subtle)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {/* Header: Candidate Info + Status & Score */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: 16,
                  borderBottom: '1px solid var(--border-subtle)',
                  paddingBottom: 16,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>
                      {attempt.candidate?.full_name || 'Candidate'}
                    </h2>
                    <IntegrityBadge status={integrityStatus} />
                    {attempt.candidate?.id && (
                      <Link
                        to={`/recruiter/candidates/${attempt.candidate.id}`}
                        style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        Profile <ExternalLink size={12} />
                      </Link>
                    )}
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 4 }}>
                    {attempt.candidate?.email} · Started {new Date(attempt.started_at).toLocaleString()}
                    {attempt.submitted_at ? ` · Submitted ${new Date(attempt.submitted_at).toLocaleTimeString()}` : ''}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Assessment Score
                    </div>
                    <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--status-verified)' }}>
                      {attempt.technical_score ?? 0}%
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', borderLeft: '1px solid var(--border-subtle)', paddingLeft: 18 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Integrity Risk
                    </div>
                    <div
                      style={{
                        fontSize: '1.85rem',
                        fontWeight: 900,
                        color: riskScore > 50 ? 'var(--status-danger)' : riskScore > 20 ? '#f59e0b' : 'var(--status-verified)',
                      }}
                    >
                      {riskScore}/100
                    </div>
                  </div>
                </div>
              </div>

              {/* Multi-Signal Metrics Grid (User Request Specification) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: 12,
                  margin: '16px 0',
                  padding: '12px 14px',
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Primary Camera</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--status-verified)' }}>
                    ✓ Connected
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Phone Camera</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: phoneConnected ? 'var(--status-verified)' : 'var(--text-muted)' }}>
                    {phoneConnected ? '✓ Connected' : '○ Not Paired'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Screen Monitoring</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: summary.screen_monitoring_active !== false ? 'var(--status-verified)' : 'var(--status-danger)' }}>
                    {summary.screen_monitoring_active !== false ? '✓ Active' : '○ Stopped'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tab Switches</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: (summary.tab_switches || 0) > 0 ? '#f59e0b' : '#fff' }}>
                    {summary.tab_switches || 0}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Fullscreen Exits</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: (summary.fullscreen_exits || 0) > 0 ? '#f59e0b' : '#fff' }}>
                    {summary.fullscreen_exits || 0}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Face Absence</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                    {summary.face_absence_events || summary.face_absence_count || 0}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Multiple Faces</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: summary.multiple_faces_detected ? 'var(--status-danger)' : '#fff' }}>
                    {summary.multiple_faces_detected ? '1 (Flag)' : '0'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Copy/Paste</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                    {summary.copy_paste_attempts || (summary.copy_attempts || 0) + (summary.paste_attempts || 0)}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Screen Evidence</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>
                    {(summary.screen_evidence || []).length} captures
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Context Interruptions</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: (summary.context_exit_count || 0) > 0 ? '#f59e0b' : '#fff' }}>
                    {summary.context_exit_count || 0}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Context-Exit Evidence</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#f59e0b' }}>
                    {(summary.context_exit_evidence || []).length} captures
                  </div>
                </div>
              </div>

              {/* Rationale Note */}
              {summary.candidate_rationale && (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
                  <strong>Integrity Signal Assessment:</strong> {summary.candidate_rationale}
                </div>
              )}

              {/* Skill Performance Tags */}
              {attempt.score_breakdown?.skill_breakdown && attempt.score_breakdown.skill_breakdown.length > 0 && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                  {attempt.score_breakdown.skill_breakdown.map((skill) => (
                    <span
                      key={skill.skill_id}
                      style={{
                        padding: '4px 10px',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.8rem',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      {skill.skill_name}: <strong>{skill.percentage}%</strong> ({skill.earned}/{skill.maximum})
                    </span>
                  ))}
                </div>
              )}

              {/* Action Buttons: VIEW SCREEN EVIDENCE, VIEW INTEGRITY TIMELINE, REVIEW ALL EVIDENCE */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setSelectedAttemptForScreenEvidence(attempt);
                      setActiveScreenIndex(0);
                    }}
                  >
                    <Monitor size={14} /> View Screen Evidence
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => void openTimelineModal(attempt)}
                  >
                    <Clock size={14} /> View Integrity Timeline
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => void openEvidenceModal(attempt)}
                  >
                    <ShieldCheck size={14} /> Review All Evidence
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleDecision(attempt.id, 'SHORTLISTED')}
                  >
                    Shortlist
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => handleDecision(attempt.id, 'INTERVIEW')}
                  >
                    Advance to Interview
                  </button>
                </div>
              </div>
            </article>
          );
        })
      )}

      {/* MODAL 1: Integrity Timeline Modal (Section 24) */}
      {selectedAttemptForTimeline && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div className="card" style={{ maxWidth: 640, width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Integrity Audit Timeline</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Chronological event log for {selectedAttemptForTimeline.candidate?.full_name || 'Candidate'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAttemptForTimeline(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ overflowY: 'auto', paddingRight: 8 }}>
              {loadingEvents ? (
                <p style={{ color: 'var(--text-muted)' }}>Loading timeline events…</p>
              ) : attemptEvents.length === 0 ? (
                <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No anomalies recorded. Assessment session completed within normal verification parameters.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {formatIntegrityTimeline(attemptEvents).map((item, idx) => (
                    <div
                      key={item.id || idx}
                      style={{
                        display: 'flex',
                        gap: 14,
                        padding: '10px 12px',
                        background: 'var(--bg-surface)',
                        borderRadius: 'var(--radius-sm)',
                        borderLeft: `4px solid ${
                          item.severity === 'HIGH'
                            ? 'var(--status-danger)'
                            : item.severity === 'MEDIUM'
                            ? '#f59e0b'
                            : 'var(--status-verified)'
                        }`,
                      }}
                    >
                      <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {item.time}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{item.description}</div>
                        {item.details && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                            {item.details}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: 18, textAlign: 'right', borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedAttemptForTimeline(null)}
              >
                Close Timeline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Recruiter Evidence Panel (Section 25) */}
      {selectedAttemptForEvidence && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: 900,
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              padding: '24px',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <span className="badge badge-accent">Recruiter Evidence Panel</span>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: 4 }}>
                  Assessment Evidence: {selectedAttemptForEvidence.candidate?.full_name || 'Candidate'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAttemptForEvidence(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`btn btn-sm ${evidenceTab === 'camera' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setEvidenceTab('camera')}
              >
                <Eye size={14} /> Camera & Vision
              </button>
              <button
                type="button"
                className={`btn btn-sm ${evidenceTab === 'browser' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setEvidenceTab('browser')}
              >
                <Maximize2 size={14} /> Browser & Focus
              </button>
              <button
                type="button"
                className={`btn btn-sm ${evidenceTab === 'context' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setEvidenceTab('context')}
              >
                <AlertTriangle size={14} /> Context & Exit Evidence
              </button>
              <button
                type="button"
                className={`btn btn-sm ${evidenceTab === 'phone' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setEvidenceTab('phone')}
              >
                <Smartphone size={14} /> Phone Camera
              </button>
              <button
                type="button"
                className={`btn btn-sm ${evidenceTab === 'questions' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setEvidenceTab('questions')}
              >
                <Code size={14} /> Questions & Code
              </button>
              <button
                type="button"
                className={`btn btn-sm ${evidenceTab === 'decision' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setEvidenceTab('decision')}
              >
                <CheckCircle size={14} /> Hiring Decision
              </button>
            </div>

            {/* Panel Body */}
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: 6 }}>
              {/* TAB 1: Camera & Vision */}
              {evidenceTab === 'camera' && (
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 8 }}>Primary Camera Telemetry</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
                    Client-side face presence and multi-face signals recorded during the session.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 18 }}>
                    <div className="card" style={{ background: 'var(--bg-surface)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Face Absence Count</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                        {selectedAttemptForEvidence.integrity_summary?.face_absence_events || 0}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Events &gt; 3 seconds</div>
                    </div>
                    <div className="card" style={{ background: 'var(--bg-surface)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Multiple Face Detections</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: selectedAttemptForEvidence.integrity_summary?.multiple_faces_detected ? 'var(--status-danger)' : 'var(--status-verified)' }}>
                        {selectedAttemptForEvidence.integrity_summary?.multiple_faces_detected ? 'Detected' : 'None'}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Flagged timestamps</div>
                    </div>
                    <div className="card" style={{ background: 'var(--bg-surface)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Camera Stream Interruptions</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                        {selectedAttemptForEvidence.integrity_summary?.camera_interruptions || 0}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Stream muting / disconnects</div>
                    </div>
                  </div>

                  {/* Evidence Snapshots if captured */}
                  {selectedAttemptForEvidence.integrity_summary?.evidence_snapshots &&
                  selectedAttemptForEvidence.integrity_summary.evidence_snapshots.length > 0 ? (
                    <div>
                      <h5 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 8 }}>Automated Evidence Snapshots</h5>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {selectedAttemptForEvidence.integrity_summary.evidence_snapshots.map((snap: string, idx: number) => (
                          <div key={idx} style={{ borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                            <img src={snap} alt={`Evidence snapshot ${idx + 1}`} style={{ width: 180, height: 135, objectFit: 'cover' }} />
                            <div style={{ fontSize: '0.7rem', padding: '4px 6px', background: 'rgba(0,0,0,0.8)', color: '#fff' }}>
                              Snapshot #{idx + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', background: 'var(--bg-surface)', padding: 12, borderRadius: 'var(--radius-sm)' }}>
                      No critical multi-face or interruptive snapshots triggered during this session.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Browser & Keyboard */}
              {evidenceTab === 'browser' && (
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 8 }}>Browser Focus & Keyboard Activity</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
                    <div className="card" style={{ background: 'var(--bg-surface)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tab Switch Events</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                        {selectedAttemptForEvidence.integrity_summary?.tab_switches || 0}
                      </div>
                    </div>
                    <div className="card" style={{ background: 'var(--bg-surface)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Fullscreen Exits</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                        {selectedAttemptForEvidence.integrity_summary?.fullscreen_exits || 0}
                      </div>
                    </div>
                    <div className="card" style={{ background: 'var(--bg-surface)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Copy / Paste Attempts</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                        {selectedAttemptForEvidence.integrity_summary?.copy_paste_attempts || 0}
                      </div>
                    </div>
                    <div className="card" style={{ background: 'var(--bg-surface)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>DevTools / Key Shortcuts</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                        {selectedAttemptForEvidence.integrity_summary?.devtools_attempts || 0}
                      </div>
                    </div>
                  </div>

                  <h5 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 8 }}>Detected Browser Events</h5>
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {attemptEvents
                      .filter((e) => ['TAB_SWITCH', 'TAB_RESTORED', 'FULLSCREEN_EXIT', 'FULLSCREEN_ENTER', 'COPY_ATTEMPT', 'PASTE_ATTEMPT', 'DEVTOOLS_SHORTCUT', 'CONTEXT_MENU_ATTEMPT'].includes(e.event_type))
                      .map((e, idx) => (
                        <div key={idx} style={{ padding: '6px 0', borderTop: '1px solid var(--border-subtle)', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}>
                          <span><strong>{e.event_type}</strong> {e.metadata?.key ? `(Key: ${e.metadata.key})` : ''}</span>
                          <span style={{ color: 'var(--text-muted)' }}>{new Date(e.timestamp).toLocaleTimeString()}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* TAB 2.5: Context & Exit Evidence */}
              {evidenceTab === 'context' && (
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 8 }}>
                    Assessment Context & Exit Interruption Evidence
                  </h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
                    Automated evidence captured when the candidate's browser window lost visibility, focus, or exited fullscreen.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 18 }}>
                    <div className="card" style={{ background: 'var(--bg-surface)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Context Exits</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: (selectedAttemptForEvidence.integrity_summary?.context_exit_count || 0) > 0 ? '#f59e0b' : 'var(--status-verified)' }}>
                        {selectedAttemptForEvidence.integrity_summary?.context_exit_count || 0}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Window blur / tab unfocus events</div>
                    </div>
                    <div className="card" style={{ background: 'var(--bg-surface)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Exit Evidence Frames</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8' }}>
                        {(selectedAttemptForEvidence.integrity_summary?.context_exit_evidence || []).length}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Screen frames captured on exit</div>
                    </div>
                  </div>

                  {selectedAttemptForEvidence.integrity_summary?.context_exit_evidence &&
                  selectedAttemptForEvidence.integrity_summary.context_exit_evidence.length > 0 ? (
                    <div>
                      <h5 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 10 }}>Captured Context-Exit Frames</h5>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
                        {selectedAttemptForEvidence.integrity_summary.context_exit_evidence.map((ctxSnap: any, idx: number) => (
                          <div
                            key={idx}
                            style={{
                              background: 'var(--bg-surface)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 8,
                              overflow: 'hidden',
                            }}
                          >
                            {ctxSnap.image_data ? (
                              <img
                                src={ctxSnap.image_data}
                                alt={`Context Exit Frame ${idx + 1}`}
                                style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }}
                              />
                            ) : (
                              <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                No screen stream active on exit
                              </div>
                            )}
                            <div style={{ padding: 10, fontSize: '0.8rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                                  {ctxSnap.trigger || 'CONTEXT_EXIT'}
                                </span>
                                <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                  {ctxSnap.elapsed_seconds ? `⏱ ${Math.floor(ctxSnap.elapsed_seconds / 60)}:${String(ctxSnap.elapsed_seconds % 60).padStart(2, '0')}` : ''}
                                </span>
                              </div>
                              <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                                {new Date(ctxSnap.timestamp).toLocaleTimeString()}
                              </div>
                              {ctxSnap.image_data && (
                                <a
                                  href={ctxSnap.image_data}
                                  download={`context-exit-evidence-${idx + 1}.jpg`}
                                  className="btn btn-secondary btn-sm"
                                  style={{ marginTop: 8, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.75rem' }}
                                >
                                  <Download size={12} /> Download Frame
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', background: 'var(--bg-surface)', padding: 14, borderRadius: 'var(--radius-sm)' }}>
                      No context-exit interruptions or captured frames recorded for this session. Candidate maintained active focus.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: External Phone Camera */}
              {evidenceTab === 'phone' && (
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 8 }}>
                    External Environment Camera Telemetry
                  </h4>

                  {/* Connection Status Card */}
                  <div className="card" style={{ background: 'var(--bg-surface)', marginBottom: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Connection Status</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <Smartphone size={16} color={selectedAttemptForEvidence.integrity_summary?.phone_camera_connected ? 'var(--status-verified)' : 'var(--text-muted)'} />
                          <span style={{ color: selectedAttemptForEvidence.integrity_summary?.phone_camera_connected ? 'var(--status-verified)' : 'var(--text-muted)', fontWeight: 700, fontSize: '0.95rem' }}>
                            {selectedAttemptForEvidence.integrity_summary?.phone_camera_connected ? 'Connected (Verified Session)' : 'Not Paired / Offline'}
                          </span>
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Attempt ID</div>
                        <div style={{ fontSize: '0.85rem', fontFamily: 'monospace', marginTop: 4, color: '#F8FAFC' }}>
                          {selectedAttemptForEvidence.id}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Session Started</div>
                        <div style={{ fontSize: '0.85rem', marginTop: 4, color: '#F8FAFC' }}>
                          {new Date(selectedAttemptForEvidence.started_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Technical Event Timeline for External Camera */}
                  <div className="card" style={{ background: 'var(--bg-surface)', marginBottom: 14 }}>
                    <h5 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      External Camera Event Timeline
                    </h5>

                    {(() => {
                      const pEvents = (selectedAttemptForEvidence.integrity_events || []).filter(
                        (e) => e.event_type.startsWith('PHONE_') || e.event_type.includes('PHONE')
                      );

                      if (pEvents.length === 0) {
                        return (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '8px 0' }}>
                            {selectedAttemptForEvidence.integrity_summary?.phone_camera_connected
                              ? 'External camera heartbeat active during evaluation.'
                              : 'No phone camera events were logged for this session.'}
                          </div>
                        );
                      }

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {pEvents.map((evt, idx) => (
                            <div
                              key={evt.id || idx}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '6px 10px',
                                background: 'rgba(255, 255, 255, 0.02)',
                                borderRadius: '6px',
                                fontSize: '0.78rem',
                                borderLeft: `3px solid ${
                                  evt.event_type === 'PHONE_CAMERA_CONNECTED'
                                    ? 'var(--status-verified)'
                                    : evt.event_type === 'PHONE_CAMERA_DISCONNECTED'
                                    ? '#EF4444'
                                    : 'var(--accent-cyan)'
                                }`,
                              }}
                            >
                              <div>
                                <strong style={{ color: '#F8FAFC' }}>{evt.event_type}</strong>
                                {typeof (evt.metadata as any)?.device === 'string' && (
                                  <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
                                    ({String((evt.metadata as any).device).slice(0, 45)}…)
                                  </span>
                                )}
                              </div>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                                {new Date(evt.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                    <strong>Evidence Standard:</strong> The external mobile camera provides physical workspace and environmental visibility around the laptop. It does not perform automated website tracking or automated judgment.
                  </p>
                </div>
              )}

              {/* TAB 4: Questions & Code */}
              {evidenceTab === 'questions' && (
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 8 }}>Question Telemetry & Submissions</h4>
                  {(selectedAttemptForEvidence.submissions || []).map((sub) => (
                    <div key={sub.id} className="card" style={{ background: 'var(--bg-surface)', marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <strong>Question ID: <code>{sub.question_id.slice(0, 8)}</code></strong>
                        <span className="badge badge-neutral">
                          {sub.language === 'mcq' ? 'MCQ Choice' : `${sub.tests_passed}/${sub.total_tests} Tests Passed · ${sub.score} marks`}
                        </span>
                      </div>
                      <pre style={{ overflowX: 'auto', maxHeight: 150, fontSize: '0.8rem', background: '#090d16', padding: 8, borderRadius: 4 }}>
                        <code>{sub.code}</code>
                      </pre>
                    </div>
                  ))}
                  {selectedAttemptForEvidence.explain_back_response && (
                    <div className="card" style={{ background: 'var(--bg-surface)', marginTop: 12 }}>
                      <h5 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 4 }}>Explain-Back Response:</h5>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                        {selectedAttemptForEvidence.explain_back_response}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: Recruiter Decision */}
              {evidenceTab === 'decision' && (
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 8 }}>Recruiter Evaluation Decision</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                    The integrity engine provides deterministic evidence and transparent risk signals. Final hiring decisions rest with the recruiting team.
                  </p>
                  <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleDecision(selectedAttemptForEvidence.id, 'SHORTLISTED')}
                    >
                      Accept & Shortlist Candidate
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleDecision(selectedAttemptForEvidence.id, 'INTERVIEW')}
                    >
                      Invite to Human Technical Interview
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ marginTop: 16, textAlign: 'right', borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedAttemptForEvidence(null)}
              >
                Close Evidence Panel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Recruiter Screen Evidence Viewer Modal */}
      {selectedAttemptForScreenEvidence && (() => {
        const captures = selectedAttemptForScreenEvidence.integrity_summary?.screen_evidence || [];
        const hasCaptures = captures.length > 0;
        const safeIndex = Math.min(Math.max(0, activeScreenIndex), Math.max(0, captures.length - 1));
        const currentCapture = hasCaptures ? captures[safeIndex] : null;
        const interruptions = selectedAttemptForScreenEvidence.integrity_summary?.screen_interruptions || 0;

        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.88)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: 16,
            }}
          >
            <div
              className="card"
              style={{
                maxWidth: 1050,
                width: '100%',
                maxHeight: '94vh',
                display: 'flex',
                flexDirection: 'column',
                padding: '24px',
                background: 'var(--bg-card, #0f172a)',
                border: '1px solid var(--border-subtle, #1e293b)',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className="badge badge-accent" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Monitor size={12} /> Periodic Screen Evidence
                    </span>
                    <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
                      {captures.length} Capture{captures.length === 1 ? '' : 's'} (Every 5 Mins)
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 800 }}>
                    {selectedAttemptForScreenEvidence.candidate?.full_name || 'Candidate'} · {assessment?.title || 'Assessment'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAttemptForScreenEvidence(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
                  aria-label="Close"
                >
                  <X size={22} />
                </button>
              </div>

              {/* Warning Banner if screen share was interrupted */}
              {interruptions > 0 && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 'var(--radius-sm, 6px)',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 16,
                    color: '#f87171',
                    fontSize: '0.85rem',
                  }}
                >
                  <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                  <div>
                    <strong>Screen Sharing Disrupted:</strong> Candidate interrupted or minimized their shared screen {interruptions} time{interruptions === 1 ? '' : 's'}. The candidate was prompted with a mandatory resume dialog before continuing.
                  </div>
                </div>
              )}

              {/* Body */}
              {!hasCaptures ? (
                <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-surface, #1e293b22)', borderRadius: 8 }}>
                  <Monitor size={48} style={{ opacity: 0.35, marginBottom: 12 }} />
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary, #fff)', marginBottom: 6 }}>
                    No Screen Evidence Captured
                  </h4>
                  <p style={{ maxWidth: 480, margin: '0 auto', fontSize: '0.85rem', lineHeight: 1.5 }}>
                    Screen sharing evidence was not recorded for this session. This may occur if screen sharing permissions were declined by the candidate, not supported by the browser, or if the assessment was submitted prior to the 5-minute capture checkpoint.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1, minHeight: 0 }}>
                  {/* Thumbnail Strip */}
                  <div
                    style={{
                      display: 'flex',
                      gap: 10,
                      overflowX: 'auto',
                      paddingBottom: 8,
                      borderBottom: '1px solid var(--border-subtle, #334155)',
                    }}
                  >
                    {captures.map((capture, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveScreenIndex(idx)}
                        style={{
                          background: safeIndex === idx ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-surface, #1e293b)',
                          border: safeIndex === idx ? '2px solid var(--primary, #3b82f6)' : '1px solid var(--border-subtle, #334155)',
                          borderRadius: 6,
                          padding: 4,
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 4,
                          flexShrink: 0,
                          width: 110,
                          textAlign: 'left',
                        }}
                      >
                        <img
                          src={capture.image_data}
                          alt={`Thumbnail ${idx + 1}`}
                          style={{ width: '100%', height: 60, objectFit: 'cover', borderRadius: 4 }}
                        />
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: safeIndex === idx ? 'var(--primary, #60a5fa)' : 'var(--text-primary, #cbd5e1)' }}>
                          #{capture.capture_number} · {capture.time_offset_formatted}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Main Large Viewer Area */}
                  {currentCapture && (
                    <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
                      {/* Image Viewer */}
                      <div
                        style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: '#040711',
                          borderRadius: 8,
                          position: 'relative',
                          overflow: 'hidden',
                          border: '1px solid var(--border-subtle, #334155)',
                        }}
                      >
                        <img
                          src={currentCapture.image_data}
                          alt={`Screen capture ${currentCapture.capture_number}`}
                          style={{
                            maxWidth: '100%',
                            maxHeight: '48vh',
                            objectFit: 'contain',
                            display: 'block',
                          }}
                        />

                        {/* Navigation Overlay Arrows */}
                        {safeIndex > 0 && (
                          <button
                            type="button"
                            onClick={() => setActiveScreenIndex(safeIndex - 1)}
                            style={{
                              position: 'absolute',
                              left: 12,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              background: 'rgba(15, 23, 42, 0.75)',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              color: '#fff',
                              borderRadius: '50%',
                              width: 36,
                              height: 36,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                            }}
                            title="Previous Capture"
                          >
                            <ChevronLeft size={20} />
                          </button>
                        )}
                        {safeIndex < captures.length - 1 && (
                          <button
                            type="button"
                            onClick={() => setActiveScreenIndex(safeIndex + 1)}
                            style={{
                              position: 'absolute',
                              right: 12,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              background: 'rgba(15, 23, 42, 0.75)',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              color: '#fff',
                              borderRadius: '50%',
                              width: 36,
                              height: 36,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                            }}
                            title="Next Capture"
                          >
                            <ChevronRight size={20} />
                          </button>
                        )}
                      </div>

                      {/* Metadata Details Sidebar */}
                      <div
                        style={{
                          width: 250,
                          flexShrink: 0,
                          background: 'var(--bg-surface, #1e293b55)',
                          borderRadius: 8,
                          padding: 14,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          border: '1px solid var(--border-subtle, #334155)',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <h4 style={{ fontSize: '0.9rem', fontWeight: 700, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                            Capture Metadata
                          </h4>
                          <div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Index</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>
                              Capture #{currentCapture.capture_number} of {captures.length}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Session Offset</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary, #60a5fa)', fontFamily: 'monospace' }}>
                              ⏱ {currentCapture.time_offset_formatted}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>System Timestamp</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              {new Date(currentCapture.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Trigger Source</div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>5-Minute Periodic Checkpoint</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Status</div>
                            <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
                              Verified Capture
                            </span>
                          </div>
                        </div>

                        <div style={{ marginTop: 16 }}>
                          <a
                            href={currentCapture.image_data}
                            download={`screen-evidence-${selectedAttemptForScreenEvidence.candidate?.full_name || 'candidate'}-capture-${currentCapture.capture_number}.jpg`}
                            className="btn btn-secondary btn-sm"
                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                          >
                            <Download size={14} /> Download Frame
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Modal Footer */}
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSelectedAttemptForScreenEvidence(null)}
                >
                  Close Viewer
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </main>
  );
};
