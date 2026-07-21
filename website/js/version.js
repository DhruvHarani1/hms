const API_BASE = 'https://hms-api-47qf.onrender.com/api/v1';

export async function fetchVersion() {
  try {
    const res = await fetch(`${API_BASE}/download/version`);
    if (!res.ok) return;

    const data = await res.json();
    const badge = document.getElementById('version-badge');
    if (badge && data.latestVersion) {
      badge.textContent = `v${data.latestVersion}`;
    }
  } catch {
    // Silently fail — use fallback value from HTML
  }
}
