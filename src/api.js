const BASE = '/api';

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  stats: () => req('GET', '/stats'),
  hotspots: (range = '', page = 1, limit = 20, q = '') =>
    req('GET', `/hotspots?range=${encodeURIComponent(range)}&page=${page}&limit=${limit}&q=${encodeURIComponent(q)}`),
  keywords: () => req('GET', '/keywords'),
  addKeyword: (keyword, scope = '') => req('POST', '/keywords', { keyword, scope }),
  updateKeyword: (id, patch) => req('PATCH', `/keywords/${id}`, patch),
  removeKeyword: (id) => req('DELETE', `/keywords/${id}`),
  alerts: (limit = 50) => req('GET', `/alerts?limit=${limit}`),
  clearAlerts: () => req('DELETE', '/alerts'),
  viewHotspot: (id) => req('POST', `/hotspots/${id}/view`),
  scan: () => req('POST', '/scan'),
  sources: () => req('GET', '/sources'),
  setSource: (name, enabled) => req('PATCH', `/sources/${encodeURIComponent(name)}`, { enabled }),
  vapidPublicKey: () => req('GET', '/push/vapid-public-key'),
  subscribe: (subscription) => req('POST', '/push/subscribe', { subscription }),
  unsubscribe: (endpoint) => req('POST', '/push/unsubscribe', { endpoint }),
  testEmail: () => req('POST', '/test-email'),
  testPush: () => req('POST', '/test-push'),
};

// base64url → Uint8Array（用于 applicationServerKey）
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
