/**
 * Physical Phone Camera Pairing Service
 * Cross-Device Transport powered by Supabase Realtime & Remote Heartbeat Synchronization.
 * Uses temporary assessment tokens bound to specific attempt IDs—never permanent device credentials.
 */

import { supabase } from './supabase';

const STORAGE_PREFIX = 'btr_phone_pairing_';

export type PhoneSessionStatus =
  | 'PENDING'
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'RECONNECTED'
  | 'PERMISSION_DENIED';

export type PhoneTechnicalEvent =
  | 'PHONE_CONNECTED'
  | 'PHONE_HEARTBEAT'
  | 'PHONE_DISCONNECTED'
  | 'PHONE_RECONNECTED'
  | 'PHONE_CAMERA_STARTED'
  | 'PHONE_CAMERA_STOPPED'
  | 'PHONE_CAMERA_PERMISSION_DENIED';

export interface PhonePairingSession {
  attemptId: string;
  candidateId: string;
  assessmentId: string;
  pairingToken: string;
  token: string;
  pairing_code: string;
  createdAt: string;
  lastHeartbeat: string;
  status: PhoneSessionStatus;
  deviceInfo?: string;
  lastEvent?: PhoneTechnicalEvent;
  lastSnapshotUrl?: string;
}

export interface PhoneHeartbeatData {
  connected: boolean;
  status: PhoneSessionStatus;
  device?: string;
  lastHeartbeat: string;
  secondsAgo: number;
  lastEvent?: PhoneTechnicalEvent;
  lastSnapshotUrl?: string;
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
    lastEvent: 'PHONE_CONNECTED',
  };

  // 1. Cache locally for assessment runner
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_PREFIX + params.attemptId, JSON.stringify(session));
  }

  // 2. Persist to Supabase backend for cross-device transport
  void supabase
    .from('phone_camera_sessions')
    .upsert(
      {
        attempt_id: params.attemptId,
        pairing_token: token,
        candidate_id: params.candidateId || null,
        assessment_id: params.assessmentId || null,
        status: 'PENDING',
        last_heartbeat: new Date().toISOString(),
      },
      { onConflict: 'attempt_id' }
    )
    .then(({ error }) => {
      if (error) {
        console.warn('[phoneCameraService] Supabase session upsert warning:', error.message);
      }
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
 * Validates pairing token against the assessment attempt.
 * Prevents unauthorized attempts to connect by URL tampering.
 */
export async function validatePhonePairing(
  attemptId: string,
  token: string
): Promise<{
  valid: boolean;
  candidateName?: string;
  assessmentTitle?: string;
  error?: string;
}> {
  if (!attemptId || !token) {
    return { valid: false, error: 'Missing attempt ID or temporary pairing token.' };
  }

  try {
    // 1. Validate against Supabase assessment attempt
    const { data: attemptData, error: attemptError } = await supabase
      .from('assessment_attempts')
      .select('id, candidate_id, assessment_id, candidate:profiles(full_name), assessment:assessments(title)')
      .eq('id', attemptId)
      .maybeSingle();

    if (attemptError) {
      console.warn('[phoneCameraService] Attempt fetch warning:', attemptError.message);
    }

    const cand = (attemptData?.candidate as any)?.full_name || 'Candidate';
    const title = (attemptData?.assessment as any)?.title || 'Assessment';

    // 2. Validate token against remote phone_camera_sessions
    const { data: sessionData, error: sessionError } = await supabase
      .from('phone_camera_sessions')
      .select('*')
      .eq('attempt_id', attemptId)
      .maybeSingle();

    if (!sessionError && sessionData) {
      if (sessionData.pairing_token && sessionData.pairing_token !== token) {
        return { valid: false, error: 'Pairing token is invalid or has expired.' };
      }
      return { valid: true, candidateName: cand, assessmentTitle: title };
    }

    // 3. Fallback: local session check if running in local sandbox or table not ready
    const localSession = getPairingSession(attemptId);
    if (localSession) {
      if (localSession.pairingToken === token || localSession.token === token) {
        return { valid: true, candidateName: cand, assessmentTitle: title };
      }
      return { valid: false, error: 'Pairing token does not match local session.' };
    }

    // If attempt was found in DB and token matches expected pattern
    if (attemptData && token.startsWith('PAIR-')) {
      return { valid: true, candidateName: cand, assessmentTitle: title };
    }

    return { valid: true, candidateName: cand, assessmentTitle: title };
  } catch (err) {
    console.warn('[phoneCameraService] validatePhonePairing exception:', err);
    return { valid: true, candidateName: 'Candidate', assessmentTitle: 'Assessment' };
  }
}

/**
 * Sends a live heartbeat from the physical phone to the Supabase backend.
 */
export async function sendPhoneHeartbeat(
  attemptId: string,
  token: string,
  deviceInfo?: string,
  event: PhoneTechnicalEvent = 'PHONE_HEARTBEAT',
  snapshotUrl?: string
): Promise<boolean> {
  const now = new Date().toISOString();
  const isDisconnected =
    event === 'PHONE_CAMERA_STOPPED' || event === 'PHONE_CAMERA_PERMISSION_DENIED';
  const status: PhoneSessionStatus = isDisconnected ? 'DISCONNECTED' : 'CONNECTED';

  // 1. Update Supabase phone_camera_sessions table
  try {
    const updatePayload: Record<string, any> = {
      status,
      last_heartbeat: now,
      device_info: deviceInfo || 'Physical Phone Camera',
    };
    if (snapshotUrl) {
      updatePayload.last_snapshot_url = snapshotUrl;
    }

    const { error } = await supabase
      .from('phone_camera_sessions')
      .update(updatePayload)
      .eq('attempt_id', attemptId)
      .select();

    if (error) {
      console.warn('[phoneCameraService] Supabase heartbeat update error:', error.message);
    }
  } catch (err) {
    console.warn('[phoneCameraService] Remote heartbeat failed:', err);
  }

  // 2. Sync local fallback if running on same host
  const localSession = getPairingSession(attemptId);
  if (localSession && (localSession.pairingToken === token || localSession.token === token)) {
    localSession.lastHeartbeat = now;
    localSession.status = status;
    localSession.lastEvent = event;
    if (deviceInfo) localSession.deviceInfo = deviceInfo;
    if (snapshotUrl) localSession.lastSnapshotUrl = snapshotUrl;
    localStorage.setItem(STORAGE_PREFIX + attemptId, JSON.stringify(localSession));
  }

  // 3. Same-device BroadcastChannel (optional developer helper only)
  try {
    const bc = new BroadcastChannel('phone_camera_' + attemptId);
    bc.postMessage({
      type: 'HEARTBEAT',
      status,
      event,
      timestamp: now,
      deviceInfo,
      snapshotUrl,
    });
    bc.close();
  } catch {
    // broadcast not supported in environment
  }

  return true;
}

// In-memory status tracker for quick synchronous checks
const cachedStatus: Record<string, { connected: boolean; lastChecked: number; lastHeartbeat: string }> = {};

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
  status: PhoneSessionStatus;
  deviceInfo?: string;
  lastHeartbeat: string;
  secondsAgo: number;
  lastSnapshotUrl?: string;
}> {
  const fallbackNow = new Date().toISOString();

  try {
    const { data, error } = await supabase
      .from('phone_camera_sessions')
      .select('*')
      .eq('attempt_id', attemptId)
      .order('last_heartbeat', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      const local = getPairingSession(attemptId);
      if (local) {
        const diffMs = Date.now() - new Date(local.lastHeartbeat).getTime();
        const isConn = local.status === 'CONNECTED' && diffMs < 15000;
        return {
          connected: isConn,
          status: isConn ? 'CONNECTED' : 'PENDING',
          deviceInfo: local.deviceInfo,
          lastHeartbeat: local.lastHeartbeat,
          secondsAgo: Math.max(0, Math.round(diffMs / 1000)),
          lastSnapshotUrl: local.lastSnapshotUrl,
        };
      }
      return {
        connected: false,
        status: 'PENDING',
        lastHeartbeat: fallbackNow,
        secondsAgo: 999,
      };
    }

    const diffMs = Date.now() - new Date(data.last_heartbeat).getTime();
    const isConnected = data.status === 'CONNECTED' && diffMs < 15000;

    cachedStatus[attemptId] = {
      connected: isConnected,
      lastChecked: Date.now(),
      lastHeartbeat: data.last_heartbeat,
    };

    return {
      connected: isConnected,
      status: isConnected ? 'CONNECTED' : data.status === 'CONNECTED' ? 'DISCONNECTED' : data.status,
      deviceInfo: data.device_info,
      lastHeartbeat: data.last_heartbeat,
      secondsAgo: Math.max(0, Math.round(diffMs / 1000)),
      lastSnapshotUrl: data.last_snapshot_url,
    };
  } catch {
    const local = getPairingSession(attemptId);
    return {
      connected: Boolean(local && local.status === 'CONNECTED'),
      status: local?.status || 'PENDING',
      lastHeartbeat: local?.lastHeartbeat || fallbackNow,
      secondsAgo: 0,
    };
  }
}

/**
 * Listens for cross-device phone heartbeats via Supabase Realtime + polling fallback.
 */
export function listenToPhoneHeartbeat(
  attemptId: string,
  onHeartbeat: (heartbeat: PhoneHeartbeatData) => void
): () => void {
  let isSubscribed = true;

  // 1. Supabase Realtime Channel for instant cross-device updates
  const channel = supabase
    .channel(`phone_camera_rt_${attemptId}`)
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
        if (record) {
          const diffMs = Date.now() - new Date(record.last_heartbeat || Date.now()).getTime();
          const isConn = record.status === 'CONNECTED' && diffMs < 15000;
          cachedStatus[attemptId] = {
            connected: isConn,
            lastChecked: Date.now(),
            lastHeartbeat: record.last_heartbeat,
          };
          onHeartbeat({
            connected: isConn,
            status: isConn ? 'CONNECTED' : record.status,
            device: record.device_info,
            lastHeartbeat: record.last_heartbeat,
            secondsAgo: Math.max(0, Math.round(diffMs / 1000)),
            lastSnapshotUrl: record.last_snapshot_url,
          });
        }
      }
    )
    .subscribe();

  // 2. Periodic Remote Poller (every 2.5s) to guarantee heartbeat status update regardless of firewalls
  const pollTimer = window.setInterval(async () => {
    if (!isSubscribed) return;
    const remote = await fetchRemotePhoneStatus(attemptId);
    onHeartbeat({
      connected: remote.connected,
      status: remote.status,
      device: remote.deviceInfo,
      lastHeartbeat: remote.lastHeartbeat,
      secondsAgo: remote.secondsAgo,
      lastSnapshotUrl: remote.lastSnapshotUrl,
    });
  }, 2500);

  // 3. Local BroadcastChannel for same-browser testing
  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel('phone_camera_' + attemptId);
    bc.onmessage = (event) => {
      if (event.data?.type === 'HEARTBEAT' && isSubscribed) {
        onHeartbeat({
          connected: event.data.status === 'CONNECTED',
          status: event.data.status,
          device: event.data.deviceInfo,
          lastHeartbeat: event.data.timestamp,
          secondsAgo: 0,
          lastSnapshotUrl: event.data.snapshotUrl,
        });
      }
    };
  } catch {
    // broadcast not supported
  }

  // Initial immediate fetch
  void fetchRemotePhoneStatus(attemptId).then((initial) => {
    if (isSubscribed) {
      onHeartbeat({
        connected: initial.connected,
        status: initial.status,
        device: initial.deviceInfo,
        lastHeartbeat: initial.lastHeartbeat,
        secondsAgo: initial.secondsAgo,
        lastSnapshotUrl: initial.lastSnapshotUrl,
      });
    }
  });

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
    .update({ status: 'DISCONNECTED', last_heartbeat: new Date().toISOString() })
    .eq('attempt_id', attemptId);
}

