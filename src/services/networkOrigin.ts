/**
 * Reusable Network Origin Helper
 * Determines the reachable network origin for physical phone QR code scanning.
 * In development, ensures physical phones on the same LAN reach the host machine instead of 'localhost'.
 */

// Detected LAN IP of the development host machine
export const DETECTED_LAN_IP = '10.41.67.112';

export function getReachableNetworkOrigin(): string {
  if (typeof window === 'undefined') return 'http://10.41.67.112:5173';

  // 1. Check for manual override saved in localStorage
  const customOverride = localStorage.getItem('btr_lan_override');
  if (customOverride && customOverride.trim().length > 0) {
    const cleaned = customOverride.trim().replace(/\/+$/, '');
    return cleaned.startsWith('http') ? cleaned : `http://${cleaned}`;
  }

  // 2. Check for Vite environment variable if configured
  const envUrl = import.meta.env.VITE_APP_URL || import.meta.env.VITE_LAN_HOST;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  const { protocol, hostname, port } = window.location;

  // 3. If running on a public domain, HTTPS, or already accessed via a LAN IP / non-loopback host (e.g. 10.41.67.112:5175)
  const isLoopback =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1';

  if (protocol === 'https:' || !isLoopback) {
    return window.location.origin;
  }

  // 4. In local development on localhost/127.0.0.1 loopback:
  // Dynamically map to the host's reachable LAN IP while preserving the current active browser port (no hardcoded port)
  const activePort = port ? `:${port}` : '';
  return `${protocol}//${DETECTED_LAN_IP}${activePort}`;
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
