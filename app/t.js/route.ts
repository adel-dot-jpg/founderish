// The tracking snippet a founder adds to their own site:
//   <script defer src="https://<founderish>/t.js" data-project="<project slug>"></script>
// Then, after their own signup succeeds: window.founderish?.track("signup")
// Sends text/plain beacons (no CORS preflight), keeps an anonymous per-browser id, follows SPA navigations.
const SCRIPT = `(function () {
  var s = document.currentScript;
  if (!s) return;
  var project = s.getAttribute("data-project");
  var api = new URL(s.src).origin + "/api/track";
  var vid;
  try {
    vid = localStorage.getItem("fi_vid");
    if (!vid) { vid = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem("fi_vid", vid); }
  } catch (e) { vid = "anon"; }
  function track(type, props) {
    var body = JSON.stringify({ project: project, type: type || "pageview", path: location.pathname, referrer: document.referrer || null, visitor: vid, props: props || {} });
    if (navigator.sendBeacon) navigator.sendBeacon(api, new Blob([body], { type: "text/plain" }));
    else fetch(api, { method: "POST", body: body, keepalive: true, headers: { "Content-Type": "text/plain" } });
  }
  window.founderish = { track: track };
  var last = location.pathname;
  function onNav() { if (location.pathname !== last) { last = location.pathname; track("pageview"); } }
  var push = history.pushState;
  history.pushState = function () { push.apply(this, arguments); onNav(); };
  window.addEventListener("popstate", onNav);
  track("pageview");
})();
`;

export function GET() {
  return new Response(SCRIPT, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
