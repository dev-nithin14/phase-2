import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldCheck, Smartphone, Video, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { sendPhoneHeartbeat, getPairingSession } from '../../services/phoneCameraService';

export const PhoneCameraPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const attemptId = searchParams.get('attemptId') || '';
  const token = searchParams.get('token') || '';

  const [streamActive, setStreamActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [error, setError] = useState('');
  const [lastPing, setLastPing] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const startCamera = async (mode: 'environment' | 'user') => {
    setError('');
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera streaming is not supported on this mobile browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setStreamActive(true);
    } catch (err: unknown) {
      console.warn('Phone camera access warning, trying fallback camera mode:', err);
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

  // Periodic heartbeat every 3 seconds to keep laptop synced
  useEffect(() => {
    if (!attemptId || !token || !streamActive) return;

    const ping = () => {
      const ok = sendPhoneHeartbeat(attemptId, token, navigator.userAgent);
      if (ok) {
        setLastPing(new Date().toLocaleTimeString());
      }
    };

    ping();
    const interval = window.setInterval(ping, 3000);
    return () => window.clearInterval(interval);
  }, [attemptId, token, streamActive]);

  const toggleFacingMode = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    void startCamera(next);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0b0f19', color: '#fff', padding: '1.25rem', fontFamily: 'Inter, sans-serif' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ width: '38px', height: '38px', background: 'linear-gradient(135deg, #6366f1, #06b6d4)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ShieldCheck size={22} color="#fff" />
        </div>
        <div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Secondary Phone Camera</h1>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>Build Beyond The Resume Assessment Proctor</p>
        </div>
      </header>

      {error ? (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', padding: '1rem', color: '#ef4444', fontSize: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontWeight: 600 }}>
            <AlertCircle size={18} /> Error Connecting Camera
          </div>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      ) : (
        <div>
          <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: '12px', padding: '0.85rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: streamActive ? '#10b981' : '#f59e0b', fontSize: '0.8rem', fontWeight: 700 }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: streamActive ? '#10b981' : '#f59e0b', display: 'inline-block' }} />
                {streamActive ? 'CONNECTED TO LAPTOP' : 'CONNECTING...'}
              </span>
              {lastPing && <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Synced: {lastPing}</span>}
            </div>
            <p style={{ fontSize: '0.78rem', color: '#cbd5e1', margin: 0 }}>
              Session Token: <strong>{token}</strong>
            </p>
          </div>

          <div style={{ position: 'relative', width: '100%', borderRadius: '14px', overflow: 'hidden', background: '#000', border: '2px solid rgba(99, 102, 241, 0.4)', marginBottom: '1rem' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: 'auto', display: 'block', aspectRatio: '4/3', objectFit: 'cover' }}
            />
            <div style={{ position: 'absolute', bottom: '10px', left: '10px', right: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                onClick={toggleFacingMode}
                style={{
                  background: 'rgba(0,0,0,0.6)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.2)',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  backdropFilter: 'blur(6px)',
                }}
              >
                <RefreshCw size={12} /> Switch Camera ({facingMode === 'environment' ? 'Back' : 'Front'})
              </button>
            </div>
          </div>

          <div style={{ background: '#1e293b', borderRadius: '12px', padding: '1rem', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#38bdf8' }}>
              <Smartphone size={16} /> Recommended Placement
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
              Prop your phone up beside or slightly behind you so that your hands, keyboard, and laptop screen are in clear view. Keep this window open until your assessment is submitted.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
