/**
 * Physical Phone Camera Pairing Service
 * Cross-Device Transport powered by Supabase Realtime & Heartbeat Synchronization.
 * Uses temporary assessment tokens—never permanent device credentials.
 */

import { supabase } from './supabase';

const STORAGE_PREFIX = 'btr_phone_pairing_';

export interface PhonePairingSession {
  attemptId: string;
  candidateId: string;
  assessmentId: string;
  pairingToken: string;
  token: string;
  pairing_code: string;
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
  candidateId?: string;
  assessmentId?: string;
}): PhonePairingSession {
  const token = generatePairingToken(params.attemptId);
  const session: PhonePairingSession = {
    attemptId: params.attemptId,
    candidateId: params.candidateId || '',
    assessmentId: params.assessmentId || '',
    pairingToken: token,
    token,
    pairing_code: token,
    createdAt: new Date().toISOString(),
    lastHeartbeat: new Date().toISOString(),
    status: 'PENDING',
  };

  // 1. Cache locally
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_PREFIX + params.attemptId, JSON.stringify(session));
  }

  // 2. Persist to Supabase backend for cross-device transport
  void supabase
    .from('phone_camera_sessions')
    .upsert({
      attempt_id: params.attemptId,
      pairing_token: token,
      candidate_id: params.candidateId || null,
      assessment_id: params.assessmentId || null,
      status: 'PENDING',
      last_heartbeat: new Date().toISOString(),
    })
    .then(({ error }) => {
      if (error) console.warn('[phoneCameraService] Supabase session upsert warning:', error.message);
    });

  return session;
}

export function generatePhonePairingSession(
  attemptId: string,
  candidateId = '',
  assessmentId = ''
): PhonePairingSession {
  return createPairingSession({ attemptId, candidateId, assessmentId });
}

export function getPairingSession(attemptId: string): PhonePairingSession | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_PREFIX + attemptId);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PhonePairingSession;
    if (!parsed.token) parsed.token = parsed.pairingToken;
    if (!parsed.pairing_code) parsed.pairing_code = parsed.pairingToken;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Sends a live heartbeat from the physical phone to the Supabase backend.
 */
export async function sendPhoneHeartbeat(
  attemptId: string,
  token: string,
  deviceInfo?: string
): Promise<boolean> {
  const now = new Date().toISOString();

  // 1. Update Supabase backend row
  try {
    const { data, error } = await supabase
      .from('phone_camera_sessions')
      .update({
        status: 'CONNECTED',
        last_heartbeat: now,
        device_info: deviceInfo || 'Physical Phone Camera',
      })
      .eq('attempt_id', attemptId)
      .eq('pairing_token', token)
      .select();

    if (error) {
      console.warn('[phoneCameraService] Supabase heartbeat update error:', error.message);
    } else if (data && data.length > 0) {
      // Successfully updated remote Supabase session
    }
  } catch (err) {
    console.warn('[phoneCameraService] Remote heartbeat failed:', err);
  }

  // 2. Sync local fallback if running on same client
  const localSession = getPairingSession(attemptId);
  if (localSession && (localSession.pairingToken === token || localSession.token === token)) {
    localSession.lastHeartbeat = now;
    localSession.status = 'CONNECTED';
    if (deviceInfo) localSession.deviceInfo = deviceInfo;
    localStorage.setItem(STORAGE_PREFIX + attemptId, JSON.stringify(localSession));
  }

  // 3. BroadcastChannel fallback
  try {
    const bc = new BroadcastChannel('phone_camera_' + attemptId);
    bc.postMessage({ type: 'HEARTBEAT', timestamp: now, deviceInfo });
    bc.close();
  } catch {
    // broadcast not supported
  }

  return true;
}

// In-memory latest status tracker for synchronous runner loops
const cachedStatus: Record<string, { connected: boolean; lastChecked: number }> = {};

/**
 * Checks phone status using cached or local timestamp.
 */
export function checkPhoneStatus(attemptId: string): boolean {
  const cached = cachedStatus[attemptId];
  if (cached && Date.now() - cached.lastChecked < 2500) {
    return cached.connected;
  }

  const session = getPairingSession(attemptId);
  if (!session) return false;

  const diffMs = Date.now() - new Date(session.lastHeartbeat).getTime();
  const isOnline = session.status === 'CONNECTED' && diffMs < 15000;
  if (!isOnline && session.status === 'CONNECTED' && diffMs >= 15000) {
    session.status = 'DISCONNECTED';
    localStorage.setItem(STORAGE_PREFIX + attemptId, JSON.stringify(session));
  }
  return isOnline;
}

/**
 * Actively queries Supabase backend for real cross-device phone connection status.
 */
export async function fetchRemotePhoneStatus(attemptId: string): Promise<{
  connected: boolean;
  status: 'PENDING' | 'CONNECTED' | 'DISCONNECTED';
  deviceInfo?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('phone_camera_sessions')
      .select('*')
      .eq('attempt_id', attemptId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      const local = checkPhoneStatus(attemptId);
      return { connected: local, status: local ? 'CONNECTED' : 'PENDING' };
    }

    const diffMs = Date.now() - new Date(data.last_heartbeat).getTime();
    const isConnected = data.status === 'CONNECTED' && diffMs < 15000;

    cachedStatus[attemptId] = {
      connected: isConnected,
      lastChecked: Date.now(),
    };

    return {
      connected: isConnected,
      status: isConnected ? 'CONNECTED' : data.status === 'CONNECTED' ? 'DISCONNECTED' : data.status,
      deviceInfo: data.device_info,
    };
  } catch {
    const local = checkPhoneStatus(attemptId);
    return { connected: local, status: local ? 'CONNECTED' : 'PENDING' };
  }
}

/**
 * Listens for cross-device phone heartbeats via Supabase Realtime + polling fallback.
 */
export function listenToPhoneHeartbeat(
  attemptId: string,
  onHeartbeat: (heartbeat: { connected: boolean; device?: string; fps?: number }) => void
): () => void {
  let isSubscribed = true;

  // 1. Supabase Realtime Channel
  const channel = supabase
    .channel(`phone_camera_${attemptId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'phone_camera_sessions',
        filter: `attempt_id=eq.${attemptId}`,
      },
      (payload) => {
        if (!isSubscribed) return;
        const record = payload.new as any;
        if (record && record.status === 'CONNECTED') {
          cachedStatus[attemptId] = { connected: true, lastChecked: Date.now() };
          onHeartbeat({
            connected: true,
            device: record.device_info,
            fps: 15,
          });
        }
      }
    )
    .subscribe();

  // 2. Periodic Remote Poller (every 2.5s) to guarantee updates regardless of network firewall
  const pollTimer = window.setInterval(async () => {
    if (!isSubscribed) return;
    const remote = await fetchRemotePhoneStatus(attemptId);
    if (remote.connected) {
      onHeartbeat({
        connected: true,
        device: remote.deviceInfo,
        fps: 15,
      });
    }
  }, 2500);

  // 3. Local BroadcastChannel listener
  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel('phone_camera_' + attemptId);
    bc.onmessage = (event) => {
      if (event.data?.type === 'HEARTBEAT' && isSubscribed) {
        onHeartbeat({
          connected: true,
          device: event.data.deviceInfo,
          fps: 15,
        });
      }
    };
  } catch {
    // broadcast not supported
  }

  return () => {
    isSubscribed = false;
    window.clearInterval(pollTimer);
    bc?.close();
    void supabase.removeChannel(channel);
  };
}

export async function disconnectPhoneSession(attemptId: string): Promise<void> {
  const session = getPairingSession(attemptId);
  if (session) {
    session.status = 'DISCONNECTED';
    localStorage.setItem(STORAGE_PREFIX + attemptId, JSON.stringify(session));
  }
  await supabase
    .from('phone_camera_sessions')
    .update({ status: 'DISCONNECTED' })
    .eq('attempt_id', attemptId);
}
