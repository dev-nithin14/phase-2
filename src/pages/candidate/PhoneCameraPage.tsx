import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldCheck, Video, AlertCircle, RefreshCw } from 'lucide-react';
import { sendPhoneHeartbeat } from '../../services/phoneCameraService';
import { supabase } from '../../services/supabase';

export const PhoneCameraPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const attemptId = searchParams.get('attempt') || searchParams.get('attemptId') || '';
  const token = searchParams.get('token') || '';

  const [streamActive, setStreamActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [error, setError] = useState('');
  const [lastPing, setLastPing] = useState<string>('');
  const [assessmentTitle, setAssessmentTitle] = useState('Assessment');
  const [candidateName, setCandidateName] = useState('Candidate');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Fetch attempt details for header info
  useEffect(() => {
    if (!attemptId) return;
    void supabase
      .from('assessment_attempts')
      .select('candidate:profiles(full_name), assessment:assessments(title)')
      .eq('id', attemptId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const cand = data.candidate as any;
          const asm = data.assessment as any;
          if (cand?.full_name) setCandidateName(cand.full_name);
          if (asm?.title) setAssessmentTitle(asm.title);
        }
      });
  }, [attemptId]);

  const startCamera = async (mode: 'environment' | 'user') => {
    setError('');
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access is not supported on this mobile browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setStreamActive(true);
    } catch {
      // Fallback without constraints
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        mediaStreamRef.current = fallbackStream;
        if (videoRef.current) videoRef.current.srcObject = fallbackStream;
        setStreamActive(true);
      } catch (fallbackErr: unknown) {
        setError(fallbackErr instanceof Error ? fallbackErr.message : 'Camera permission denied or camera unavailable.');
      }
    }
  };

  useEffect(() => {
    if (attemptId && token) {
      void startCamera(facingMode);
    } else {
      setError('Invalid pairing URL. Missing assessment attempt ID or security token.');
    }

    return () => {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [attemptId, token]);

  // Periodic heartbeat every 3 seconds to keep laptop synced via Supabase
  useEffect(() => {
    if (!attemptId || !token || !streamActive) return;

    const ping = async () => {
      const ok = await sendPhoneHeartbeat(attemptId, token, navigator.userAgent);
      if (ok) {
        setLastPing(new Date().toLocaleTimeString());
      }
    };

    void ping();
    const interval = window.setInterval(() => {
      void ping();
    }, 3000);

    return () => window.clearInterval(interval);
  }, [attemptId, token, streamActive]);

  const toggleFacingMode = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    void startCamera(next);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#070b14',
        color: '#f8fafc',
        padding: '1rem',
        fontFamily: 'Inter, system-ui, sans-serif',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          marginBottom: '1rem',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <ShieldCheck size={20} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
            BUILD BEYOND THE RESUME
          </div>
          <h1 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#fff' }}>
            SECONDARY ASSESSMENT CAMERA
          </h1>
        </div>
      </header>

      {/* Info Bar */}
      <div
        style={{
          background: 'rgba(255,255,255,0.04)',
          borderRadius: '8px',
          padding: '10px 14px',
          marginBottom: '1rem',
          border: '1px solid rgba(255,255,255,0.06)',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          fontSize: '0.85rem',
        }}
      >
        <div>
          <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Assessment:</span>
          <div style={{ fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {assessmentTitle}
          </div>
        </div>
        <div>
          <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Candidate:</span>
          <div style={{ fontWeight: 700, color: '#f8fafc' }}>{candidateName}</div>
        </div>
        <div>
          <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Pairing:</span>
          <div style={{ color: '#22c55e', fontWeight: 700 }}>CONNECTED</div>
        </div>
        <div>
          <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Camera:</span>
          <div style={{ color: streamActive ? '#22c55e' : '#eab308', fontWeight: 700 }}>
            {streamActive ? '● ACTIVE' : '○ INITIALIZING'}
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #ef4444',
            color: '#fca5a5',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.85rem',
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Large Camera Preview */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          minHeight: '340px',
          background: '#000',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: streamActive ? 'block' : 'none',
          }}
        />

        {!streamActive && !error && (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
            <Video size={48} style={{ opacity: 0.4, marginBottom: '1rem' }} />
            <div>Requesting phone camera permission…</div>
          </div>
        )}

        {/* Live Overlay Badge */}
        {streamActive && (
          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              background: 'rgba(0,0,0,0.75)',
              backdropFilter: 'blur(6px)',
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#22c55e',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
            SECONDARY CAMERA STREAMING
          </div>
        )}

        {/* Flip camera button */}
        {streamActive && (
          <button
            type="button"
            onClick={toggleFacingMode}
            style={{
              position: 'absolute',
              bottom: '14px',
              right: '14px',
              background: 'rgba(0,0,0,0.75)',
              backdropFilter: 'blur(6px)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff',
              padding: '8px 12px',
              borderRadius: '20px',
              fontSize: '0.75rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RefreshCw size={14} />
            {facingMode === 'environment' ? 'Desk View' : 'Front View'}
          </button>
        )}
      </div>

      {/* Footer Status */}
      <footer
        style={{
          marginTop: '1rem',
          padding: '12px',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.06)',
          textAlign: 'center',
        }}
      >
        <div style={{ color: '#22c55e', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
          Status: Connected to assessment
        </div>
        <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '6px 0 0' }}>
          Position your phone beside or behind your workspace so your desk and laptop screen remain in view.
          {lastPing ? ` (Synced: ${lastPing})` : ''}
        </p>
      </footer>
    </div>
  );
};
