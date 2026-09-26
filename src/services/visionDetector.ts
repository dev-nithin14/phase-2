/**
 * Lightweight Client-Side Vision & Face Presence Detector
 * Runs locally in the browser with zero external heavy ML dependencies.
 * Uses native window.FaceDetector when available, with an optimized skin-cluster & centroid fallback.
 */

export interface VisionDetectionResult {
  faceCount: number;
  status: 'FACE_PRESENT' | 'FACE_ABSENT' | 'MULTIPLE_FACES';
  confidence: number;
  isObscured: boolean;
  snapshotDataUrl?: string;
}

let nativeDetector: any = null;
if (typeof window !== 'undefined' && 'FaceDetector' in window) {
  try {
    nativeDetector = new (window as any).FaceDetector({ fastMode: true, maxDetectedFaces: 4 });
  } catch {
    nativeDetector = null;
  }
}

export async function detectFacesInVideo(
  video: HTMLVideoElement,
  captureSnapshot: boolean = false
): Promise<VisionDetectionResult> {
  if (!video || video.readyState < 2 || video.videoWidth === 0) {
    return {
      faceCount: 0,
      status: 'FACE_ABSENT',
      confidence: 0,
      isObscured: true,
    };
  }

  // 1. Try Native Browser Hardware FaceDetector if exposed
  if (nativeDetector) {
    try {
      const detected = await nativeDetector.detect(video);
      const faceCount = detected.length;
      let status: 'FACE_PRESENT' | 'FACE_ABSENT' | 'MULTIPLE_FACES' = 'FACE_PRESENT';
      if (faceCount === 0) status = 'FACE_ABSENT';
      else if (faceCount >= 2) status = 'MULTIPLE_FACES';

      let snapshotDataUrl: string | undefined;
      if (captureSnapshot) {
        snapshotDataUrl = extractCanvasSnapshot(video, 320, 240);
      }

      return {
        faceCount,
        status,
        confidence: faceCount > 0 ? 0.95 : 0.9,
        isObscured: false,
        snapshotDataUrl,
      };
    } catch {
      // Fall through to algorithmic heuristic detector
    }
  }

  // 2. High-Performance Client Canvas Heuristic Analyzer
  return analyzeVideoFrameHeuristic(video, captureSnapshot);
}

function analyzeVideoFrameHeuristic(
  video: HTMLVideoElement,
  captureSnapshot: boolean
): VisionDetectionResult {
  const width = 160;
  const height = 120;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return { faceCount: 1, status: 'FACE_PRESENT', confidence: 0.5, isObscured: false };
  }

  ctx.drawImage(video, 0, 0, width, height);
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  let skinPixels = 0;
  let totalLuminance = 0;
  const colSkinCounts = new Array(width).fill(0);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    totalLuminance += lum;

    // Standard human skin chromaticity rule (RGB color space)
    const isSkin =
      r > 70 &&
      g > 35 &&
      b > 20 &&
      r > g &&
      r > b &&
      Math.abs(r - g) > 12 &&
      r - b > 12;

    if (isSkin) {
      skinPixels++;
      const pixelIdx = i / 4;
      const x = pixelIdx % width;
      colSkinCounts[x]++;
    }
  }

  const totalPixels = width * height;
  const avgLuminance = totalLuminance / totalPixels;
  const skinRatio = skinPixels / totalPixels;
  const isObscured = avgLuminance < 15 || avgLuminance > 245;

  let snapshotDataUrl: string | undefined;
  if (captureSnapshot) {
    snapshotDataUrl = canvas.toDataURL('image/jpeg', 0.6);
  }

  // Obscured or no skin pixels
  if (isObscured || skinRatio < 0.025) {
    return {
      faceCount: 0,
      status: 'FACE_ABSENT',
      confidence: 0.85,
      isObscured,
      snapshotDataUrl,
    };
  }

  // Find peaks along horizontal columns to detect multiple candidate faces
  // Smooth column counts
  const smoothed = new Array(width).fill(0);
  const windowSize = 5;
  for (let x = windowSize; x < width - windowSize; x++) {
    let sum = 0;
    for (let w = -windowSize; w <= windowSize; w++) {
      sum += colSkinCounts[x + w];
    }
    smoothed[x] = sum / (windowSize * 2 + 1);
  }

  // Detect separate face peaks
  const threshold = height * 0.15;
  const peaks: number[] = [];
  for (let x = 10; x < width - 10; x++) {
    if (
      smoothed[x] > threshold &&
      smoothed[x] > smoothed[x - 1] &&
      smoothed[x] >= smoothed[x + 1]
    ) {
      if (peaks.length === 0 || x - peaks[peaks.length - 1] > 30) {
        peaks.push(x);
      }
    }
  }

  if (peaks.length >= 2 && skinRatio > 0.08) {
    return {
      faceCount: peaks.length,
      status: 'MULTIPLE_FACES',
      confidence: 0.8,
      isObscured: false,
      snapshotDataUrl,
    };
  }

  return {
    faceCount: 1,
    status: 'FACE_PRESENT',
    confidence: 0.9,
    isObscured: false,
    snapshotDataUrl,
  };
}

export function extractCanvasSnapshot(
  video: HTMLVideoElement,
  targetWidth: number = 320,
  targetHeight: number = 240
): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
    return canvas.toDataURL('image/jpeg', 0.65);
  } catch {
    return '';
  }
}
