import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  ShieldCheck, Video, AlertCircle, RefreshCw, 
  Camera, CheckCircle2, ChevronDown, ChevronUp, 
  Wifi, Lock, Sparkles, Smartphone, Eye
} from 'lucide-react';
import { 
  sendPhoneHeartbeat, 
  validatePhonePairing,
  PhoneTechnicalEvent,
  PhoneSessionStatus
} from '../../services/phoneCameraService';

export const PhoneCameraPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const attemptId = searchParams.get('attempt') || searchParams.get('attemptId') || '';
  const token = searchParams.get('token') || '';

  // Core Connection & Camera State
  const [sessionStatus, setSessionStatus] = useState<PhoneSessionStatus>('PENDING');
  const [statusText, setStatusText] = useState('CONNECTING...');
  const [candidateName, setCandidateName] = useState('Candidate');
  const [assessmentTitle, setAssessmentTitle] = useState('Assessment');
  const [isTokenValid, setIsTokenValid] = useState<boolean | null>(null);

  // Camera State
  const [hasRequestedPermission, setHasRequestedPermission] = useState(false);
  const [streamActive, setStreamActive] = useState(false);
  const [cameraMode, setCameraMode] = useState<'environment' | 'fallback'>('environment');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [lastHeartbeatTime, setLastHeartbeatTime] = useState<string>('');
  const [heartbeatCount, setHeartbeatCount] = useState(0);

  // Element Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Diagnostics Flags
  const isSecure = typeof window !== 'undefined' && Boolean(window.isSecureContext);
  const hasMediaDevices = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices);
  const hasGetUserMedia = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);

  // 1. Initial Validation of Token & Attempt
  useEffect(() => {
    if (!attemptId || !token) {
      setIsTokenValid(false);
      setSessionStatus('DISCONNECTED');
      setStatusText('INVALID PAIRING LINK');
      setErrorMessage('Missing assessment attempt ID or security token. Please scan the QR code displayed on your laptop.');
      return;
    }

    let active = true;
    validatePhonePairing(attemptId, token)
      .then((res) => {
        if (!active) return;
        if (res.valid) {
          setIsTokenValid(true);
          if (res.candidateName) setCandidateName(res.candidateName);
          if (res.assessmentTitle) setAssessmentTitle(res.assessmentTitle);
          setSessionStatus('PENDING');
          setStatusText('READY TO CONNECT');
        } else {
          setIsTokenValid(false);
          setSessionStatus('DISCONNECTED');
          setStatusText('PAIRING FAILED');
          setErrorMessage(res.error || 'Pairing token is invalid or has expired.');
        }
      })
      .catch(() => {
        if (!active) return;
        setIsTokenValid(true);
        setSessionStatus('PENDING');
        setStatusText('READY TO CONNECT');
      });

    return () => {
      active = false;
    };
  }, [attemptId, token]);

  // Capture low-resolution snapshot for external environment proof
  const captureSnapshot = useCallback((): string | undefined => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return undefined;
    try {
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }
      const canvas = canvasRef.current;
      const width = Math.min(640, video.videoWidth || 640);
      const height = Math.round(width * ((video.videoHeight || 480) / (video.videoWidth || 640)));
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return undefined;
      ctx.drawImage(video, 0, 0, width, height);
      return canvas.toDataURL('image/jpeg', 0.6);
    } catch {
      return undefined;
    }
  }, []);

  // 2. Start Camera via User Gesture
  const startExternalCamera = async () => {
    setHasRequestedPermission(true);
    setErrorMessage(null);
    setPermissionDenied(false);
    setStatusText('REQUESTING PERMISSION...');

    if (!hasMediaDevices || !hasGetUserMedia) {
      const msg = 'Camera access is not supported on this browser. Please open in Chrome or Safari over HTTPS.';
      setErrorMessage(msg);
      setStatusText('CAMERA ERROR');
      void sendPhoneHeartbeat(attemptId, token, navigator.userAgent, 'PHONE_CAMERA_PERMISSION_DENIED');
      return;
    }

    // Stop any existing tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    let stream: MediaStream | null = null;
    let selectedMode: 'environment' | 'fallback' = 'environment';

    // Step A: Prefer REAR/ENVIRONMENT camera using ideal constraint (never exact)
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
        },
        audio: false,
      });
      selectedMode = 'environment';
    } catch (err: unknown) {
      const errorObj = err as { name?: string; message?: string };
      console.warn('[PhoneCamera] Environment constraint failed, trying fallback:', errorObj);

      if (errorObj.name === 'NotAllowedError' || errorObj.name === 'PermissionDeniedError') {
        setPermissionDenied(true);
        setErrorMessage('Camera permission was denied. Open browser settings and allow camera access, then return to this page.');
        setStatusText('CAMERA PERMISSION REQUIRED');
        void sendPhoneHeartbeat(attemptId, token, navigator.userAgent, 'PHONE_CAMERA_PERMISSION_DENIED');
        return;
      }

      // Step B: Graceful fallback to any video source
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        selectedMode = 'fallback';
      } catch (fallbackErr: unknown) {
        const fbObj = fallbackErr as { name?: string; message?: string };
        handleCameraError(fbObj);
        return;
      }
    }

    if (!stream) {
      setErrorMessage('Could not initialize camera stream.');
      setStatusText('CAMERA ERROR');
      return;
    }

    // Attach stream to video element
    mediaStreamRef.current = stream;
    setCameraMode(selectedMode);
    setStreamActive(true);
    setSessionStatus('CONNECTED');
    setStatusText('CONNECTED ✓');

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.autoplay = true;
      videoRef.current.playsInline = true;
      videoRef.current.muted = true;
      try {
        await videoRef.current.play();
      } catch {
        // play interrupted or muted autoplay handled
      }
    }

    // Send immediate initial connection heartbeat
    const snapshot = captureSnapshot();
    void sendPhoneHeartbeat(
      attemptId,
      token,
      `${navigator.userAgent} (${selectedMode === 'environment' ? 'Rear' : 'Fallback'} Camera)`,
      'PHONE_CAMERA_STARTED',
      snapshot
    );
  };

  const handleCameraError = (error: { name?: string; message?: string }) => {
    let msg = 'Failed to access camera.';
    let status = 'CAMERA ERROR';

    switch (error.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        msg = 'Camera permission was denied. Open your mobile browser settings, allow camera access for this site, and tap Try Again.';
        status = 'CAMERA PERMISSION REQUIRED';
        setPermissionDenied(true);
        void sendPhoneHeartbeat(attemptId, token, navigator.userAgent, 'PHONE_CAMERA_PERMISSION_DENIED');
        break;
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        msg = 'No camera device found on this phone.';
        break;
      case 'NotReadableError':
      case 'TrackStartError':
        msg = 'Camera is currently in use by another app. Please close other camera apps and try again.';
        break;
      case 'OverconstrainedError':
        msg = 'Requested camera resolution is not supported by your device hardware.';
        break;
      case 'SecurityError':
        msg = 'Camera access was blocked due to an insecure context. HTTPS is required.';
        break;
      case 'AbortError':
        msg = 'Camera initialization was aborted.';
        break;
      default:
        msg = error.message || 'Unknown camera error occurred.';
    }

    setErrorMessage(msg);
    setStatusText(status);
    setSessionStatus('DISCONNECTED');
  };

  // 3. Periodic Heartbeat Loop (every 3 seconds)
  useEffect(() => {
    if (!attemptId || !token || !streamActive) return;

    let snapshotCounter = 0;
    const sendPulse = async () => {
      snapshotCounter += 1;
      // Send a snapshot every 6 heartbeats (~18s) to avoid excessive bandwidth
      const snapshot = snapshotCounter % 6 === 0 ? captureSnapshot() : undefined;

      const ok = await sendPhoneHeartbeat(
        attemptId,
        token,
        `Mobile (${cameraMode === 'environment' ? 'Rear Camera' : 'Default Camera'})`,
        'PHONE_HEARTBEAT',
        snapshot
      );
      if (ok) {
        const timeStr = new Date().toLocaleTimeString();
        setLastHeartbeatTime(timeStr);
        setHeartbeatCount((c) => c + 1);
        setSessionStatus('CONNECTED');
        setStatusText('CONNECTED ✓');
      }
    };

    void sendPulse();
    const interval = window.setInterval(() => {
      void sendPulse();
    }, 3000);

    return () => window.clearInterval(interval);
  }, [attemptId, token, streamActive, cameraMode, captureSnapshot]);

  // 4. Stream Lifecycle (visibilitychange, pagehide, pageshow)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        // App backgrounded
        setStatusText('BACKGROUNDED');
        void sendPhoneHeartbeat(attemptId, token, navigator.userAgent, 'PHONE_CAMERA_STOPPED');
      } else {
        // App returned to foreground
        if (streamActive) {
          setStatusText('CONNECTED ✓');
          setSessionStatus('CONNECTED');
          void sendPhoneHeartbeat(attemptId, token, navigator.userAgent, 'PHONE_RECONNECTED');
        }
      }
    };

    const handlePageHide = () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      void sendPhoneHeartbeat(attemptId, token, navigator.userAgent, 'PHONE_DISCONNECTED');
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [attemptId, token, streamActive]);

  // Clean teardown on unmount
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#07111F',
        color: '#F8FAFC',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        display: 'flex',
        flexDirection: 'column',
        padding: '0.85rem',
        boxSizing: 'border-box',
        maxWidth: '520px',
        margin: '0 auto',
      }}
    >
      {/* Top HackMysuru Branding Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(13, 27, 42, 0.9)',
          border: '1px solid rgba(148, 163, 184, 0.18)',
          borderRadius: '10px',
          padding: '8px 12px',
          marginBottom: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #00D4FF 0%, #7C5CFF 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldCheck size={16} color="#07111F" />
          </div>
          <div>
            <div style={{ fontSize: '0.65rem', color: '#FBBF24', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              HackMysuru 1.0 · RankBook
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#F8FAFC' }}>
              External Camera Mode
            </div>
          </div>
        </div>

        {/* Live Status Pill */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background:
              sessionStatus === 'CONNECTED'
                ? 'rgba(34, 197, 94, 0.15)'
                : sessionStatus === 'DISCONNECTED'
                ? 'rgba(239, 68, 68, 0.15)'
                : 'rgba(245, 158, 11, 0.15)',
            border: `1px solid ${
              sessionStatus === 'CONNECTED'
                ? 'rgba(34, 197, 94, 0.4)'
                : sessionStatus === 'DISCONNECTED'
                ? 'rgba(239, 68, 68, 0.4)'
                : 'rgba(245, 158, 11, 0.4)'
            }`,
            padding: '4px 10px',
            borderRadius: '999px',
            fontSize: '0.72rem',
            fontWeight: 800,
            color:
              sessionStatus === 'CONNECTED'
                ? '#22C55E'
                : sessionStatus === 'DISCONNECTED'
                ? '#EF4444'
                : '#F59E0B',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background:
                sessionStatus === 'CONNECTED'
                  ? '#22C55E'
                  : sessionStatus === 'DISCONNECTED'
                  ? '#EF4444'
                  : '#F59E0B',
            }}
          />
          {statusText}
        </div>
      </div>

      {/* Assessment Context Card */}
      <div
        style={{
          background: '#0D1B2A',
          border: '1px solid rgba(148, 163, 184, 0.18)',
          borderRadius: '10px',
          padding: '10px 14px',
          marginBottom: '10px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          fontSize: '0.8rem',
        }}
      >
        <div>
          <span style={{ color: '#94A3B8', fontSize: '0.7rem' }}>Assessment:</span>
          <div style={{ fontWeight: 700, color: '#F8FAFC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {assessmentTitle}
          </div>
        </div>
        <div>
          <span style={{ color: '#94A3B8', fontSize: '0.7rem' }}>Candidate:</span>
          <div style={{ fontWeight: 700, color: '#F8FAFC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {candidateName}
          </div>
        </div>
      </div>

      {/* Error / Alert Display */}
      {errorMessage && (
        <div
          role="alert"
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#FCA5A5',
            padding: '12px 14px',
            borderRadius: '10px',
            marginBottom: '10px',
            fontSize: '0.825rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#EF4444' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: '#EF4444', marginBottom: '2px' }}>
              {permissionDenied ? 'Permission Blocked' : 'Camera Alert'}
            </div>
            <div>{errorMessage}</div>
            {permissionDenied && (
              <button
                type="button"
                onClick={startExternalCamera}
                style={{
                  marginTop: '8px',
                  background: '#EF4444',
                  color: '#fff',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      )}

      {/* Warning if fallback camera had to be used */}
      {streamActive && cameraMode === 'fallback' && (
        <div
          style={{
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            color: '#FDE68A',
            padding: '8px 12px',
            borderRadius: '8px',
            marginBottom: '10px',
            fontSize: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertCircle size={14} color="#F59E0B" />
          <span>Note: Environment camera could not be selected; using default camera.</span>
        </div>
      )}

      {/* Main View Area: Either Permission Prompt OR Large Live Video Preview */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          minHeight: '380px',
          background: '#000000',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid rgba(148, 163, 184, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Step 1: User Gesture Button (Crucial for mobile browsers) */}
        {!streamActive && isTokenValid !== false && (
          <div
            style={{
              padding: '2rem 1.5rem',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '14px',
              maxWidth: '340px',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(0, 212, 255, 0.12)',
                border: '1px solid rgba(0, 212, 255, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#00D4FF',
              }}
            >
              <Camera size={32} />
            </div>

            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
              Start External Camera
            </h2>

            <p style={{ fontSize: '0.825rem', color: '#94A3B8', lineHeight: 1.5, margin: 0 }}>
              This phone is being used as the <strong>external environment camera</strong> to observe the physical area around your laptop.
            </p>

            <button
              type="button"
              onClick={startExternalCamera}
              style={{
                width: '100%',
                padding: '12px 20px',
                background: '#00D4FF',
                color: '#07111F',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 800,
                fontSize: '0.95rem',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0, 212, 255, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '6px',
              }}
            >
              <Camera size={18} />
              Enable Rear Camera
            </button>

            <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
              Your browser will prompt you for camera access. Tap "Allow".
            </div>
          </div>
        )}

        {/* Step 2: Live Video Element */}
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

        {/* Live Overlay Badge on Active Stream */}
        {streamActive && (
          <>
            <div
              style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
                background: 'rgba(7, 17, 31, 0.85)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(34, 197, 94, 0.4)',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '0.72rem',
                fontWeight: 800,
                color: '#22C55E',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                zIndex: 10,
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22C55E' }} />
              LIVE ENVIRONMENT VIEW
            </div>

            <div
              style={{
                position: 'absolute',
                bottom: '12px',
                left: '12px',
                right: '12px',
                background: 'rgba(7, 17, 31, 0.85)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                color: '#F8FAFC',
                textAlign: 'center',
                zIndex: 10,
              }}
            >
              Position your phone beside or behind the laptop so the rear camera covers the surrounding area.
            </div>
          </>
        )}
      </div>

      {/* Bottom Placement & Heartbeat Indicator */}
      <div
        style={{
          marginTop: '10px',
          background: '#0D1B2A',
          border: '1px solid rgba(148, 163, 184, 0.18)',
          borderRadius: '10px',
          padding: '10px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.75rem',
          color: '#94A3B8',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Wifi size={14} color={streamActive ? '#22C55E' : '#94A3B8'} />
          <span>
            {streamActive ? `Telemetry Active (Pulses: ${heartbeatCount})` : 'Waiting for camera initialization'}
          </span>
        </div>
        {lastHeartbeatTime && (
          <span style={{ color: '#00D4FF', fontWeight: 600 }}>
            Synced: {lastHeartbeatTime}
          </span>
        )}
      </div>

      {/* Collapsible Camera Diagnostics Drawer */}
      <div style={{ marginTop: '10px' }}>
        <button
          type="button"
          onClick={() => setShowDiagnostics(!showDiagnostics)}
          style={{
            width: '100%',
            background: 'none',
            border: 'none',
            color: '#64748B',
            fontSize: '0.72rem',
            padding: '6px 0',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          <span>Camera Diagnostics</span>
          {showDiagnostics ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {showDiagnostics && (
          <div
            style={{
              background: '#070F1A',
              border: '1px solid rgba(148, 163, 184, 0.15)',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '0.72rem',
              color: '#94A3B8',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              marginTop: '4px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>SECURE CONNECTION (HTTPS):</span>
              <strong style={{ color: isSecure ? '#22C55E' : '#EF4444' }}>
                {isSecure ? 'YES ✓' : 'NO (HTTPS Required)'}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>CAMERA API (MediaDevices):</span>
              <strong style={{ color: hasMediaDevices ? '#22C55E' : '#EF4444' }}>
                {hasMediaDevices ? 'AVAILABLE ✓' : 'UNAVAILABLE'}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>getUserMedia SUPPORT:</span>
              <strong style={{ color: hasGetUserMedia ? '#22C55E' : '#EF4444' }}>
                {hasGetUserMedia ? 'AVAILABLE ✓' : 'UNAVAILABLE'}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>REAR CAMERA REQUEST:</span>
              <strong style={{ color: '#00D4FF' }}>
                {cameraMode === 'environment' ? 'ENVIRONMENT (IDEAL)' : 'DEFAULT FALLBACK'}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>STREAM STATUS:</span>
              <strong style={{ color: streamActive ? '#22C55E' : '#EAB308' }}>
                {streamActive ? 'ACTIVE' : 'INACTIVE'}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>ATTEMPT ID:</span>
              <code>{attemptId ? attemptId.slice(0, 10) + '…' : 'None'}</code>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
