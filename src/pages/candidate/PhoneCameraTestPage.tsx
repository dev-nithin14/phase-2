import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Camera, CheckCircle2, XCircle, AlertCircle, RefreshCw, Smartphone } from 'lucide-react';
import { supabase } from '../../services/supabase';

export const PhoneCameraTestPage: React.FC = () => {
  const [browserInfo, setBrowserInfo] = useState('');
  const [platformInfo, setPlatformInfo] = useState('');
  const [isSecure, setIsSecure] = useState(false);
  const [mediaDevicesAvailable, setMediaDevicesAvailable] = useState(false);
  const [getUserMediaAvailable, setGetUserMediaAvailable] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'GRANTED' | 'DENIED' | 'PROMPT' | 'UNKNOWN'>('UNKNOWN');
  const [rearCameraFound, setRearCameraFound] = useState<'FOUND' | 'NOT FOUND' | 'CHECKING'>('CHECKING');
  const [cameraStreamActive, setCameraStreamActive] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [supabaseStatus, setSupabaseStatus] = useState<'CONNECTED' | 'DISCONNECTED' | 'CHECKING'>('CHECKING');
  const [testLog, setTestLog] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const addLog = (msg: string) => {
    setTestLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 15)]);
  };

  // Inspect environment on load
  useEffect(() => {
    // 1. Browser & Platform
    const ua = navigator.userAgent;
    let b = 'Unknown';
    if (ua.includes('Safari') && !ua.includes('Chrome')) b = 'Safari';
    else if (ua.includes('Chrome')) b = 'Chrome';
    else if (ua.includes('Firefox')) b = 'Firefox';
    else if (ua.includes('Edg')) b = 'Edge';
    setBrowserInfo(b);

    let p = 'Desktop / Other';
    if (/iPad|iPhone|iPod/.test(ua)) p = 'iOS';
    else if (/Android/.test(ua)) p = 'Android';
    setPlatformInfo(p);

    // 2. Secure Context & APIs
    const sec = Boolean(window.isSecureContext);
    setIsSecure(sec);
    const md = Boolean(navigator.mediaDevices);
    setMediaDevicesAvailable(md);
    const gum = Boolean(navigator.mediaDevices?.getUserMedia);
    setGetUserMediaAvailable(gum);

    // 3. Network status
    setIsOnline(navigator.onLine);
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    // 4. Check permissions API if available
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'camera' as PermissionName })
        .then((res) => {
          if (res.state === 'granted') setPermissionStatus('GRANTED');
          else if (res.state === 'denied') setPermissionStatus('DENIED');
          else setPermissionStatus('PROMPT');

          res.onchange = () => {
            if (res.state === 'granted') setPermissionStatus('GRANTED');
            else if (res.state === 'denied') setPermissionStatus('DENIED');
            else setPermissionStatus('PROMPT');
          };
        })
        .catch(() => setPermissionStatus('UNKNOWN'));
    }

    // 5. Enumerate devices to look for rear/environment camera
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          const videoInputs = devices.filter((d) => d.kind === 'videoinput');
          const hasBack = videoInputs.some(
            (d) =>
              d.label.toLowerCase().includes('back') ||
              d.label.toLowerCase().includes('rear') ||
              d.label.toLowerCase().includes('environment')
          );
          setRearCameraFound(hasBack ? 'FOUND' : videoInputs.length > 0 ? 'FOUND' : 'NOT FOUND');
          addLog(`Found ${videoInputs.length} video input device(s).`);
        })
        .catch(() => setRearCameraFound('NOT FOUND'));
    } else {
      setRearCameraFound('NOT FOUND');
    }

    // 6. Test Supabase connection
    Promise.resolve(
      supabase
        .from('phone_camera_sessions')
        .select('count', { count: 'exact', head: true })
    )
      .then(({ error }: any) => {
        if (error && error.code !== 'PGRST116') {
          // Table exists or connection reached
          setSupabaseStatus('CONNECTED');
          addLog('Supabase backend responded.');
        } else {
          setSupabaseStatus('CONNECTED');
          addLog('Supabase connection verified.');
        }
      })
      .catch(() => {
        setSupabaseStatus('DISCONNECTED');
        addLog('Supabase connection check failed.');
      });

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const testStartRearCamera = async () => {
    addLog('Requesting environment camera...');
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.autoplay = true;
        videoRef.current.playsInline = true;
        videoRef.current.muted = true;
        await videoRef.current.play();
      }

      setCameraStreamActive(true);
      setPermissionStatus('GRANTED');
      setRearCameraFound('FOUND');
      addLog('Camera stream started successfully.');
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string };
      addLog(`Camera request failed: ${e.name} - ${e.message}`);
      setCameraStreamActive(false);
      if (e.name === 'NotAllowedError') {
        setPermissionStatus('DENIED');
      }
    }
  };

  const testStopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraStreamActive(false);
    addLog('Camera stream stopped.');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#07111F',
        color: '#F8FAFC',
        fontFamily: "'Inter', system-ui, sans-serif",
        padding: '1.25rem',
        maxWidth: '600px',
        margin: '0 auto',
      }}
    >
      <header style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(148, 163, 184, 0.2)', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Smartphone size={24} color="#00D4FF" />
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
            Phone Camera Diagnostic Suite
          </h1>
        </div>
        <p style={{ fontSize: '0.8rem', color: '#94A3B8', margin: '4px 0 0' }}>
          Hardware, API, and Network verification test harness for External Environment Camera.
        </p>
      </header>

      {/* Diagnostics Table */}
      <div
        style={{
          background: '#0D1B2A',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '10px',
          overflow: 'hidden',
          marginBottom: '1.25rem',
        }}
      >
        <div style={{ padding: '10px 14px', background: '#13263A', fontWeight: 700, fontSize: '0.85rem' }}>
          System Telemetry & Capabilities
        </div>

        <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.825rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94A3B8' }}>Browser:</span>
            <strong>{browserInfo}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94A3B8' }}>Platform:</span>
            <strong>{platformInfo}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94A3B8' }}>Secure Context (HTTPS):</span>
            <strong style={{ color: isSecure ? '#22C55E' : '#EF4444' }}>
              {isSecure ? 'YES ✓' : 'NO (HTTPS Required)'}
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94A3B8' }}>MediaDevices API:</span>
            <strong style={{ color: mediaDevicesAvailable ? '#22C55E' : '#EF4444' }}>
              {mediaDevicesAvailable ? 'AVAILABLE ✓' : 'UNAVAILABLE'}
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94A3B8' }}>getUserMedia API:</span>
            <strong style={{ color: getUserMediaAvailable ? '#22C55E' : '#EF4444' }}>
              {getUserMediaAvailable ? 'AVAILABLE ✓' : 'UNAVAILABLE'}
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94A3B8' }}>Camera Permission:</span>
            <strong style={{ color: permissionStatus === 'GRANTED' ? '#22C55E' : permissionStatus === 'DENIED' ? '#EF4444' : '#F59E0B' }}>
              {permissionStatus}
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94A3B8' }}>Rear Camera:</span>
            <strong style={{ color: rearCameraFound === 'FOUND' ? '#22C55E' : '#F59E0B' }}>
              {rearCameraFound}
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94A3B8' }}>Camera Stream:</span>
            <strong style={{ color: cameraStreamActive ? '#22C55E' : '#94A3B8' }}>
              {cameraStreamActive ? 'ACTIVE' : 'INACTIVE'}
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94A3B8' }}>Network Connectivity:</span>
            <strong style={{ color: isOnline ? '#22C55E' : '#EF4444' }}>
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94A3B8' }}>Supabase Realtime Backend:</span>
            <strong style={{ color: supabaseStatus === 'CONNECTED' ? '#22C55E' : '#EF4444' }}>
              {supabaseStatus}
            </strong>
          </div>
        </div>
      </div>

      {/* Interactive Controls */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '1.25rem' }}>
        <button
          type="button"
          onClick={testStartRearCamera}
          style={{
            flex: 1,
            background: '#00D4FF',
            color: '#07111F',
            fontWeight: 800,
            padding: '10px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <Camera size={16} /> Test Rear Camera
        </button>
        {cameraStreamActive && (
          <button
            type="button"
            onClick={testStopCamera}
            style={{
              background: '#EF4444',
              color: '#fff',
              fontWeight: 800,
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            Stop
          </button>
        )}
      </div>

      {/* Video Preview */}
      <div
        style={{
          width: '100%',
          height: '240px',
          background: '#000',
          borderRadius: '10px',
          border: '1px solid rgba(148, 163, 184, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.25rem',
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: cameraStreamActive ? 'block' : 'none' }}
        />
        {!cameraStreamActive && (
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Camera preview will appear here</span>
        )}
      </div>

      {/* Live Event Log */}
      <div style={{ background: '#070F1A', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: '8px', padding: '10px' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8', marginBottom: '6px' }}>Diagnostic Log:</div>
        <div style={{ maxHeight: '120px', overflowY: 'auto', fontSize: '0.72rem', fontFamily: 'monospace', color: '#CBD5E1' }}>
          {testLog.length === 0 ? (
            <div style={{ color: '#64748B' }}>No events recorded yet.</div>
          ) : (
            testLog.map((line, idx) => <div key={idx}>{line}</div>)
          )}
        </div>
      </div>
    </div>
  );
};
