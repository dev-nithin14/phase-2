/**
 * Network Origin Helper
 * Determines the reachable network origin for external phone camera QR code pairing.
 * In production/HTTPS deployments, uses the deployed domain (VITE_PUBLIC_APP_URL).
 * Never hardcodes development ports or machine-specific IP addresses.
 */

export function getReachableNetworkOrigin(): string {
  if (typeof window === 'undefined') {
    const envUrl = import.meta.env.VITE_PUBLIC_APP_URL || import.meta.env.VITE_APP_URL;
    return envUrl ? String(envUrl).trim().replace(/\/+$/, '') : 'https://build-beyond-the-resume.vercel.app';
  }

  // 1. Production / Deployed environment variable (highest priority for real physical devices)
  const envUrl = import.meta.env.VITE_PUBLIC_APP_URL || import.meta.env.VITE_APP_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // 2. Explicit manual override saved in localStorage for developer LAN testing
  const customOverride = localStorage.getItem('btr_lan_override');
  if (customOverride && customOverride.trim().length > 0) {
    const cleaned = customOverride.trim().replace(/\/+$/, '');
    return cleaned.startsWith('http') ? cleaned : `https://${cleaned}`;
  }

  // 3. Dynamic browser origin (preserves current protocol, host, and port dynamically)
  return window.location.origin;
}

export function setCustomLanOrigin(origin: string): void {
  if (typeof window === 'undefined') return;
  if (!origin || origin.trim().length === 0) {
    localStorage.removeItem('btr_lan_override');
  } else {
    localStorage.setItem('btr_lan_override', origin.trim());
  }
}

export function getCustomLanOrigin(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('btr_lan_override') || '';
}

