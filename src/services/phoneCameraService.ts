/**
 * Physical Phone Camera Pairing Service
 * Manages assessment-specific temporary pairing sessions, heartbeats, and status synchronization.
 * Uses temporary assessment tokens—never permanent device credentials.
 */

const STORAGE_PREFIX = 'btr_phone_pairing_';

export interface PhonePairingSession {
  attemptId: string;
  candidateId: string;
  assessmentId: string;
  pairingToken: string;
  createdAt: string;
  lastHeartbeat: string;
  status: 'PENDING' | 'CONNECTED' | 'DISCONNECTED';
  deviceInfo?: string;
}

export function generatePairingToken(attemptId: string): string {
  const shortId = attemptId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PAIR-${shortId}-${randomSuffix}`;
}

export function createPairingSession(params: {
  attemptId: string;
  candidateId: string;
  assessmentId: string;
}): PhonePairingSession {
  const token = generatePairingToken(params.attemptId);
  const session: PhonePairingSession = {
    attemptId: params.attemptId,
    candidateId: params.candidateId,
    assessmentId: params.assessmentId,
    pairingToken: token,
    createdAt: new Date().toISOString(),
    lastHeartbeat: new Date().toISOString(),
    status: 'PENDING',
  };

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_PREFIX + params.attemptId, JSON.stringify(session));
  }
  return session;
}

export function getPairingSession(attemptId: string): PhonePairingSession | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_PREFIX + attemptId);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PhonePairingSession;
  } catch {
    return null;
  }
}

export function sendPhoneHeartbeat(attemptId: string, token: string, deviceInfo?: string): boolean {
  const session = getPairingSession(attemptId);
  if (!session || session.pairingToken !== token) return false;

  session.lastHeartbeat = new Date().toISOString();
  session.status = 'CONNECTED';
  if (deviceInfo) session.deviceInfo = deviceInfo;

  localStorage.setItem(STORAGE_PREFIX + attemptId, JSON.stringify(session));

  // Also broadcast via BroadcastChannel if supported
  try {
    const bc = new BroadcastChannel('phone_camera_' + attemptId);
    bc.postMessage({ type: 'HEARTBEAT', timestamp: session.lastHeartbeat, deviceInfo });
    bc.close();
  } catch {
    // Fallback to localStorage events
  }

  return true;
}

export function checkPhoneStatus(attemptId: string): {
  status: 'CONNECTED' | 'DISCONNECTED' | 'PENDING';
  lastSeenSecondsAgo: number;
} {
  const session = getPairingSession(attemptId);
  if (!session) return { status: 'PENDING', lastSeenSecondsAgo: 999 };

  const diffMs = Date.now() - new Date(session.lastHeartbeat).getTime();
  const diffSec = Math.round(diffMs / 1000);

  if (session.status === 'CONNECTED' && diffSec > 14) {
    session.status = 'DISCONNECTED';
    localStorage.setItem(STORAGE_PREFIX + attemptId, JSON.stringify(session));
    return { status: 'DISCONNECTED', lastSeenSecondsAgo: diffSec };
  }

  return { status: session.status, lastSeenSecondsAgo: diffSec };
}

export function disconnectPhoneSession(attemptId: string): void {
  const session = getPairingSession(attemptId);
  if (session) {
    session.status = 'DISCONNECTED';
    localStorage.setItem(STORAGE_PREFIX + attemptId, JSON.stringify(session));
  }
}
