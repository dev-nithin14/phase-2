import { IntegrityEvent, IntegrityStatus, RiskLevel } from '../types';

export interface MultiSignalIntegrityInput {
  tabSwitches?: number;
  fullscreenExits?: number;
  copyAttempts?: number;
  pasteAttempts?: number;
  cutAttempts?: number;
  cameraDropouts?: number;
  faceAbsenceCount?: number;
  faceAbsenceTotalSeconds?: number;
  multipleFacesCount?: number;
  multipleFacesTotalSeconds?: number;
  phoneCameraStatus?: 'CONNECTED' | 'DISCONNECTED' | 'NOT_PAIRED';
  phoneCameraDisconnected?: boolean;
  contextMenuAttempts?: number;
  devtoolsAttempts?: number;
  warningsCount?: number;
}

export interface MultiSignalIntegrityResult {
  status: IntegrityStatus;
  riskScore: number; // 0 - 100
  riskLevel: RiskLevel; // 'LOW RISK' | 'MEDIUM RISK' | 'HIGH RISK'
  totalFlags: number;
  summaryRationale: string;
  signalsBreakdown: Array<{
    category: string;
    description: string;
    points: number;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
  }>;
}

/**
 * Multi-Signal Assessment Integrity Engine
 * Combines camera, browser, screen, keyboard, and phone telemetry into an objective evidence-backed risk profile.
 * Non-accusatory standard: Never brands candidates as cheaters; provides transparent evidence for recruiter review.
 */
export function evaluateIntegrityStatus(input: MultiSignalIntegrityInput): MultiSignalIntegrityResult {
  const tabSwitches = input.tabSwitches || 0;
  const fullscreenExits = input.fullscreenExits || 0;
  const copyAttempts = (input.copyAttempts || 0) + (input.cutAttempts || 0);
  const pasteAttempts = input.pasteAttempts || 0;
  const cameraDropouts = input.cameraDropouts || 0;
  const faceAbsenceCount = input.faceAbsenceCount || 0;
  const faceAbsenceTotalSeconds = input.faceAbsenceTotalSeconds || 0;
  const multipleFacesCount = input.multipleFacesCount || 0;
  const multipleFacesTotalSeconds = input.multipleFacesTotalSeconds || 0;
  const contextMenuAttempts = input.contextMenuAttempts || 0;
  const devtoolsAttempts = input.devtoolsAttempts || 0;
  const phoneCameraDisconnected = Boolean(input.phoneCameraDisconnected || input.phoneCameraStatus === 'DISCONNECTED');

  const signals: Array<{
    category: string;
    description: string;
    points: number;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
  }> = [];

  // 1. Multiple Faces Detection (Strong signal)
  if (multipleFacesCount > 0) {
    const pts = Math.min(35, 20 + multipleFacesCount * 5 + Math.min(10, Math.round(multipleFacesTotalSeconds)));
    signals.push({
      category: 'Primary Camera',
      description: `Multiple faces detected in frame (${multipleFacesCount} event(s), ~${Math.round(multipleFacesTotalSeconds)}s total)`,
      points: pts,
      severity: 'HIGH',
    });
  }

  // 2. Prolonged / Repeated Face Absence
  if (faceAbsenceTotalSeconds >= 10 || faceAbsenceCount >= 3) {
    const pts = Math.min(25, 10 + Math.round(faceAbsenceTotalSeconds * 0.5) + faceAbsenceCount * 2);
    signals.push({
      category: 'Primary Camera',
      description: `Candidate face was out of camera view (${faceAbsenceCount} time(s), ~${Math.round(faceAbsenceTotalSeconds)}s total)`,
      points: pts,
      severity: faceAbsenceTotalSeconds >= 25 ? 'HIGH' : 'MEDIUM',
    });
  } else if (faceAbsenceCount > 0) {
    signals.push({
      category: 'Primary Camera',
      description: `Brief face absence logged (${faceAbsenceCount} time(s), ~${Math.round(faceAbsenceTotalSeconds)}s total). Likely minor head movement.`,
      points: 2,
      severity: 'LOW',
    });
  }

  // 3. Camera Interruptions / Disconnections
  if (cameraDropouts > 0) {
    const pts = Math.min(25, cameraDropouts * 8);
    signals.push({
      category: 'Primary Camera',
      description: `Primary camera feed was interrupted or stream stopped (${cameraDropouts} event(s))`,
      points: pts,
      severity: cameraDropouts >= 2 ? 'HIGH' : 'MEDIUM',
    });
  }

  // 4. Secondary Phone Camera Signal
  if (phoneCameraDisconnected) {
    signals.push({
      category: 'Secondary Camera',
      description: 'Paired secondary phone camera disconnected during active assessment session',
      points: 12,
      severity: 'MEDIUM',
    });
  }

  // 5. Window / Tab Switch
  if (tabSwitches > 0) {
    const pts = Math.min(30, tabSwitches * 6);
    signals.push({
      category: 'Browser Activity',
      description: `Assessment tab lost focus or browser was minimized (${tabSwitches} time(s))`,
      points: pts,
      severity: tabSwitches >= 3 ? 'HIGH' : 'MEDIUM',
    });
  }

  // 6. Fullscreen Exits
  if (fullscreenExits > 0) {
    const pts = Math.min(25, fullscreenExits * 7);
    signals.push({
      category: 'Fullscreen',
      description: `Candidate exited enforced fullscreen workspace (${fullscreenExits} time(s))`,
      points: pts,
      severity: fullscreenExits >= 2 ? 'HIGH' : 'MEDIUM',
    });
  }

  // 7. Clipboard & Editor Protection
  if (pasteAttempts > 0) {
    const pts = Math.min(20, pasteAttempts * 6);
    signals.push({
      category: 'Editor Security',
      description: `External paste attempt into assessment code editor (${pasteAttempts} time(s))`,
      points: pts,
      severity: 'MEDIUM',
    });
  }
  if (copyAttempts > 0) {
    signals.push({
      category: 'Editor Security',
      description: `Copy attempt of assessment question content (${copyAttempts} time(s))`,
      points: Math.min(10, copyAttempts * 2),
      severity: 'LOW',
    });
  }

  // 8. Context Menu & DevTools
  if (contextMenuAttempts > 0) {
    signals.push({
      category: 'Browser Security',
      description: `Right-click context menu attempt intercepted (${contextMenuAttempts} time(s))`,
      points: Math.min(10, contextMenuAttempts * 3),
      severity: 'LOW',
    });
  }
  if (devtoolsAttempts > 0) {
    signals.push({
      category: 'Browser Security',
      description: `Browser inspection or developer shortcut detected (${devtoolsAttempts} event(s))`,
      points: Math.min(25, devtoolsAttempts * 12),
      severity: 'HIGH',
    });
  }

  // Calculate Cumulative Risk Score (0-100)
  const rawScore = signals.reduce((sum, s) => sum + s.points, 0);
  const riskScore = Math.min(100, Math.round(rawScore));

  let riskLevel: RiskLevel = 'LOW RISK';
  let status: IntegrityStatus = 'VERIFIED';
  let summaryRationale = 'Assessment integrity appears consistent based on collected signals. No significant anomalies detected across camera, browser, or environment monitoring.';

  if (riskScore >= 55 || multipleFacesCount >= 2 || tabSwitches >= 4 || devtoolsAttempts >= 2) {
    riskLevel = 'HIGH RISK';
    status = 'HIGH_RISK';
    summaryRationale = `Assessment requires detailed recruiter review: multiple elevated integrity signals detected (${signals.map(s => s.category).join(', ')}). Review evidence timeline before making hiring decisions.`;
  } else if (riskScore >= 20 || tabSwitches >= 1 || fullscreenExits >= 1 || multipleFacesCount >= 1 || faceAbsenceTotalSeconds >= 12 || pasteAttempts >= 1) {
    riskLevel = 'MEDIUM RISK';
    status = 'REVIEW_REQUIRED';
    summaryRationale = `Assessment requires recruiter review: minor telemetry events recorded (${signals.map(s => s.description).slice(0, 2).join('; ')}). Consistent with ambient distraction or dual-screen setup.`;
  }

  const totalFlags = signals.length;

  return {
    status,
    riskScore,
    riskLevel,
    totalFlags,
    summaryRationale,
    signalsBreakdown: signals,
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

export interface FormattedTimelineItem {
  id: string;
  timeFormatted: string;
  title: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  eventType: IntegrityEvent['event_type'];
}

/**
 * Formats a list of integrity events into a chronological recruiter-friendly timeline
 */
export function formatIntegrityTimeline(events: IntegrityEvent[] = []): FormattedTimelineItem[] {
  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return sorted.map((event) => {
    const time = new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const duration = event.metadata?.duration_sec ? ` (${event.metadata.duration_sec}s)` : '';

    let title = event.event_type.replace(/_/g, ' ');
    let description = (event.metadata?.note as string) || (event.metadata?.source as string) || '';

    switch (event.event_type) {
      case 'ASSESSMENT_STARTED':
        title = 'Assessment Started';
        description = 'Candidate launched assessment workspace with active monitoring';
        break;
      case 'ASSESSMENT_SUBMITTED':
        title = 'Assessment Submitted';
        description = 'Candidate submitted final answers for evaluation';
        break;
      case 'TAB_SWITCH':
        title = `Tab / Window Switched${duration}`;
        description = event.metadata?.duration_sec 
          ? `Browser tab unfocused for ${event.metadata.duration_sec} seconds`
          : 'Assessment window lost focus or browser was minimized';
        break;
      case 'FULLSCREEN_EXIT':
        title = 'Exited Fullscreen';
        description = 'Candidate exited enforced fullscreen workspace';
        break;
      case 'FACE_PRESENT':
        title = 'Face Verified in Frame';
        description = 'Single candidate face confirmed in camera view';
        break;
      case 'FACE_ABSENT':
        title = `Face Absent from Camera${duration}`;
        description = event.metadata?.duration_sec
          ? `Candidate face was not visible for ${event.metadata.duration_sec} seconds`
          : 'Candidate face was out of camera view';
        break;
      case 'MULTIPLE_FACES':
        title = `Multiple Faces Detected${duration}`;
        description = `Two or more faces identified in camera frame (detected count: ${event.metadata?.face_count || 2})`;
        break;
      case 'CAMERA_INTERRUPTED':
      case 'CAMERA_DISABLED':
        title = 'Camera Feed Interrupted';
        description = 'Primary camera track was disabled or stopped delivering frames';
        break;
      case 'PHONE_CAMERA_CONNECTED':
        title = 'Secondary Phone Camera Paired';
        description = 'Candidate phone connected successfully as external angle stream';
        break;
      case 'PHONE_CAMERA_DISCONNECTED':
        title = 'Secondary Phone Camera Disconnected';
        description = 'Paired phone camera stream lost connection';
        break;
      case 'PASTE_ATTEMPT':
        title = 'Paste Attempt';
        description = 'Clipboard paste action intercepted in coding workspace';
        break;
      case 'COPY_ATTEMPT':
        title = 'Copy Attempt';
        description = 'Clipboard copy action detected';
        break;
      case 'CONTEXT_MENU_ATTEMPT':
        title = 'Context Menu Attempt';
        description = 'Right-click context menu interaction intercepted';
        break;
      case 'DEVTOOLS_SHORTCUT_ATTEMPT':
        title = 'Developer Tools Shortcut';
        description = `Browser inspect shortcut pressed (${event.metadata?.key || 'F12 / Ctrl+Shift+I'})`;
        break;
      case 'QUESTION_OPENED':
        title = `Navigated to Question #${Number(event.metadata?.order_index ?? 0) + 1}`;
        description = (event.metadata?.question_title as string) || 'Question opened';
        break;
      case 'QUESTION_ANSWERED':
      case 'ANSWER_CHANGED':
        title = `Answer Updated (Q#${Number(event.metadata?.order_index ?? 0) + 1})`;
        description = 'Candidate updated answer for question';
        break;
      case 'CODE_RUN':
        title = `Executed Test Runner (Q#${Number(event.metadata?.order_index ?? 0) + 1})`;
        description = `Ran visible tests: ${event.metadata?.tests_passed ?? 0}/${event.metadata?.total_tests ?? 0} passed`;
        break;
      case 'SCREEN_SNAPSHOT_CAPTURED':
        title = 'Periodic Evidence Snapshot';
        description = 'Lightweight integrity evidence frame captured';
        break;
    }

    return {
      id: event.id,
      timeFormatted: time,
      title,
      description,
      severity: event.severity,
      eventType: event.event_type,
    };
  });
}

