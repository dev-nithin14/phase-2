import { IntegrityEvent, IntegrityStatus, RiskLevel } from '../types';

export interface MultiSignalIntegrityInput {
  events?: IntegrityEvent[];
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
  phoneConnected?: boolean;
  phoneCameraDisconnected?: boolean;
  contextMenuAttempts?: number;
  devtoolsAttempts?: number;
  warningsCount?: number;
  assessmentDurationMinutes?: number;
}

export interface MultiSignalIntegrityResult {
  status: IntegrityStatus;
  riskScore: number; // 0 - 100
  risk_score: number;
  riskLevel: RiskLevel; // 'LOW RISK' | 'MEDIUM RISK' | 'HIGH RISK'
  risk_level: RiskLevel;
  totalFlags: number;
  summaryRationale: string;
  candidate_friendly_summary: string;
  summary: {
    tab_switches: number;
    fullscreen_exits: number;
    copy_attempts: number;
    paste_attempts: number;
    copy_paste_attempts: number;
    camera_dropouts: number;
    camera_interruptions: number;
    face_absence_count: number;
    face_absence_events: number;
    multiple_faces_count: number;
    multiple_faces_detected: boolean;
    phone_camera_connected: boolean;
    phone_camera_status: 'CONNECTED' | 'DISCONNECTED' | 'NOT_PAIRED';
    warnings_count: number;
    context_menu_attempts: number;
    devtools_attempts: number;
    total_flags: number;
    status: IntegrityStatus;
    risk_score: number;
    risk_level: RiskLevel;
    candidate_rationale: string;
    [key: string]: any;
  };
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
  // If events list was passed, tally metrics automatically from events
  const evts = input.events || [];
  let evtTabSwitches = 0;
  let evtFullscreenExits = 0;
  let evtCopyAttempts = 0;
  let evtPasteAttempts = 0;
  let evtCutAttempts = 0;
  let evtCameraDropouts = 0;
  let evtFaceAbsence = 0;
  let evtMultipleFaces = 0;
  let evtContextMenu = 0;
  let evtDevtools = 0;
  let evtPhoneDisconnected = false;
  let evtScreenShareStopped = 0;
  let evtScreenCaptures = 0;

  for (const e of evts) {
    if (e.event_type === 'TAB_SWITCH') evtTabSwitches++;
    else if (e.event_type === 'FULLSCREEN_EXIT') evtFullscreenExits++;
    else if (e.event_type === 'COPY_ATTEMPT') evtCopyAttempts++;
    else if (e.event_type === 'PASTE_ATTEMPT') evtPasteAttempts++;
    else if (e.event_type === 'CUT_ATTEMPT') evtCutAttempts++;
    else if (e.event_type === 'CAMERA_INTERRUPTED' || e.event_type === 'CAMERA_DISCONNECTED') evtCameraDropouts++;
    else if (e.event_type === 'FACE_ABSENT' || e.event_type === 'NO_FACE') evtFaceAbsence++;
    else if (e.event_type === 'MULTIPLE_FACES') evtMultipleFaces++;
    else if (e.event_type === 'CONTEXT_MENU_ATTEMPT') evtContextMenu++;
    else if (e.event_type === 'DEVTOOLS_SHORTCUT' || e.event_type === 'DEVTOOLS_SHORTCUT_ATTEMPT') evtDevtools++;
    else if (e.event_type === 'PHONE_CAMERA_DISCONNECTED') evtPhoneDisconnected = true;
    else if (e.event_type === 'SCREEN_SHARE_STOPPED') evtScreenShareStopped++;
    else if (e.event_type === 'SCREENSHOT_CAPTURED') evtScreenCaptures++;
  }

  const tabSwitches = input.tabSwitches ?? evtTabSwitches;
  const fullscreenExits = input.fullscreenExits ?? evtFullscreenExits;
  const copyAttempts = (input.copyAttempts ?? evtCopyAttempts) + (input.cutAttempts ?? evtCutAttempts);
  const pasteAttempts = input.pasteAttempts ?? evtPasteAttempts;
  const cameraDropouts = input.cameraDropouts ?? evtCameraDropouts;
  const faceAbsenceCount = input.faceAbsenceCount ?? evtFaceAbsence;
  const faceAbsenceTotalSeconds = input.faceAbsenceTotalSeconds ?? (faceAbsenceCount * 3.5);
  const multipleFacesCount = input.multipleFacesCount ?? evtMultipleFaces;
  const multipleFacesTotalSeconds = input.multipleFacesTotalSeconds ?? (multipleFacesCount * 4);
  const contextMenuAttempts = input.contextMenuAttempts ?? evtContextMenu;
  const devtoolsAttempts = input.devtoolsAttempts ?? evtDevtools;
  const phoneCameraDisconnected = input.phoneCameraDisconnected ?? (evtPhoneDisconnected || input.phoneCameraStatus === 'DISCONNECTED');
  const phoneConnected = input.phoneConnected ?? (input.phoneCameraStatus === 'CONNECTED');
  const warningsCount = input.warningsCount ?? (tabSwitches + fullscreenExits + multipleFacesCount);

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

  // 4b. Screen Sharing Interruption Signal
  if (evtScreenShareStopped > 0) {
    signals.push({
      category: 'Screen Monitoring',
      description: `Screen sharing permission was stopped or interrupted (${evtScreenShareStopped} event(s))`,
      points: Math.min(25, evtScreenShareStopped * 8),
      severity: evtScreenShareStopped >= 2 ? 'HIGH' : 'MEDIUM',
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
  const candidate_friendly_summary = 'Assessment monitored under multi-signal integrity verification standards.';

  const summary = {
    tab_switches: tabSwitches,
    fullscreen_exits: fullscreenExits,
    copy_attempts: copyAttempts,
    paste_attempts: pasteAttempts,
    copy_paste_attempts: copyAttempts + pasteAttempts,
    camera_dropouts: cameraDropouts,
    camera_interruptions: cameraDropouts,
    face_absence_count: faceAbsenceCount,
    face_absence_events: faceAbsenceCount,
    multiple_faces_count: multipleFacesCount,
    multiple_faces_detected: multipleFacesCount > 0,
    phone_camera_connected: phoneConnected,
    phone_camera_status: phoneConnected ? ('CONNECTED' as const) : ('NOT_PAIRED' as const),
    warnings_count: warningsCount,
    context_menu_attempts: contextMenuAttempts,
    devtools_attempts: devtoolsAttempts,
    total_flags: totalFlags,
    status,
    risk_score: riskScore,
    risk_level: riskLevel,
    candidate_rationale: summaryRationale,
  };

  return {
    status,
    riskScore,
    risk_score: riskScore,
    riskLevel,
    risk_level: riskLevel,
    totalFlags,
    summaryRationale,
    candidate_friendly_summary,
    summary,
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
  time: string;
  title: string;
  description: string;
  details?: string;
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
      case 'PHONE_CAMERA_RECONNECTED':
        title = 'Secondary Phone Camera Reconnected';
        description = 'Paired phone camera stream resumed active telemetry';
        break;
      case 'PHONE_CAMERA_DISCONNECTED':
        title = 'Secondary Phone Camera Disconnected';
        description = 'Paired phone camera stream lost connection';
        break;
      case 'SCREEN_SHARE_STARTED':
        title = 'Screen Monitoring Activated';
        description = 'Candidate granted legitimate browser screen-sharing permission';
        break;
      case 'SCREENSHOT_CAPTURED':
        title = `Screen Evidence Captured (Capture #${event.metadata?.capture_number || 1})`;
        description = event.metadata?.time_offset
          ? `Periodic 5-minute screen evidence frame captured at ${event.metadata.time_offset}`
          : 'Automated 5-minute periodic evidence frame captured';
        break;
      case 'SCREEN_SHARE_STOPPED':
        title = 'Screen Sharing Interrupted';
        description = 'Candidate stopped or revoked browser screen sharing';
        break;
      case 'SCREEN_SHARE_RESTORED':
        title = 'Screen Sharing Restored';
        description = 'Screen monitoring resumed after permission prompt';
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
      case 'ASSESSMENT_CONTEXT_LEFT':
        title = 'Assessment Context Left';
        description = `Assessment window lost focus or visibility (Trigger: ${event.metadata?.trigger || 'Window blur / tab switch'})`;
        break;
      case 'ASSESSMENT_CONTEXT_RESTORED':
        title = 'Assessment Context Restored';
        description = 'Candidate returned to active assessment window';
        break;
      case 'SCREEN_EVIDENCE_ON_CONTEXT_EXIT':
        title = 'Screen Evidence Captured on Context Exit';
        description = `Automatic screen frame captured when candidate left assessment context (${event.metadata?.trigger || 'Context Exit'})`;
        break;
      case 'FULLSCREEN_EXIT_DURING_ASSESSMENT':
        title = 'Exited Fullscreen During Assessment';
        description = 'Candidate left enforced fullscreen workspace';
        break;
      case 'WINDOW_BLUR':
        title = 'Window Focus Lost';
        description = 'Candidate interacted outside assessment window';
        break;
      case 'WINDOW_FOCUS':
        title = 'Window Focus Regained';
        description = 'Assessment window regained active focus';
        break;
    }

    return {
      id: event.id,
      timeFormatted: time,
      time,
      title,
      description,
      details: description,
      severity: event.severity,
      eventType: event.event_type,
    };
  });
}

