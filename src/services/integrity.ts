import { IntegrityEvent, IntegrityStatus } from '../types';

export interface IntegrityTrackerState {
  tabSwitches: number;
  fullscreenExits: number;
  copyAttempts: number;
  pasteAttempts: number;
  cameraDropouts: number;
  events: IntegrityEvent[];
  cameraActive: boolean;
  micActive: boolean;
  status: IntegrityStatus;
}

/**
 * Evaluates raw integrity telemetry into a calibrated human-review status.
 * Adheres strictly to the requirement: Never automatically brand anyone a cheater.
 */
export function evaluateIntegrityStatus(state: {
  tabSwitches: number;
  fullscreenExits: number;
  copyAttempts: number;
  pasteAttempts: number;
  cameraDropouts: number;
}): {
  status: IntegrityStatus;
  totalFlags: number;
  summaryRationale: string;
} {
  const { tabSwitches, fullscreenExits, copyAttempts, pasteAttempts, cameraDropouts } = state;
  
  // Weighting suspicious interactions
  const totalFlags = 
    (tabSwitches * 2) + 
    (fullscreenExits * 2) + 
    (pasteAttempts * 1.5) + 
    (copyAttempts * 0.5) + 
    (cameraDropouts * 2.5);

  let status: IntegrityStatus = 'NORMAL';
  let summaryRationale = 'No irregular activity detected. Assessment integrity normal.';

  if (totalFlags >= 7 || tabSwitches >= 4 || cameraDropouts >= 3) {
    status = 'REVIEW_REQUIRED';
    summaryRationale = `Multiple focus shifts detected (${tabSwitches} tab switch(es), ${fullscreenExits} fullscreen exit(s)). Recommended for human review.`;
  } else if (totalFlags >= 2 || tabSwitches >= 1 || fullscreenExits >= 1 || pasteAttempts >= 1) {
    status = 'MINOR_FLAGS';
    summaryRationale = `Minor telemetry events recorded (${tabSwitches} focus change(s), ${copyAttempts + pasteAttempts} clipboard event(s)). Consistent with normal technical research or unintentional switch.`;
  }

  return {
    status,
    totalFlags: Math.round(totalFlags),
    summaryRationale,
  };
}

/**
 * Creates a timestamped integrity audit event
 */
export function createIntegrityEvent(
  attemptId: string,
  eventType: IntegrityEvent['event_type'],
  severity: 'LOW' | 'MEDIUM' | 'HIGH',
  metadata: Record<string, unknown> = {}
): IntegrityEvent {
  return {
    id: `ie_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    attempt_id: attemptId,
    event_type: eventType,
    severity,
    metadata,
    timestamp: new Date().toISOString(),
  };
}
