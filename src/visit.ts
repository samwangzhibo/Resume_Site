/** 页面访问统计：sendBeacon 上报 /api/visit */

let sessionId = localStorage.getItem("dt_session_id") || "";
if (!sessionId) {
  sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  localStorage.setItem("dt_session_id", sessionId);
}

function fingerprint(): string {
  const parts = [
    navigator.userAgent,
    screen.width + "x" + screen.height,
    navigator.language,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.platform,
    new Date().getTimezoneOffset(),
  ];
  let hash = 0;
  const str = parts.join("|");
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = (hash << 5) - hash + ch;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export function trackVisit() {
  const payload = {
    ua: navigator.userAgent,
    path: window.location.pathname + window.location.search,
    referrer: document.referrer || undefined,
    fingerprint: fingerprint(),
    sessionId,
  };
  const body = JSON.stringify(payload);
  try {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/visit", blob);
  } catch {
    fetch("/api/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  }
}
