// Microsoft Clarity for docs.hotloop.io, read by astro.config.mjs and put in every page head, in every
// language. Same consent behavior as hotloop.io, embernet.ai and fireballindustries.com: Clarity loads only
// after the visitor presses Accept on the cookie banner (src/components/CookieBanner.astro). Until a choice is
// made, and after Decline, nothing from Clarity is requested and no Clarity cookie is set. Accept is passed to
// Clarity through its consent API, which since 31 October 2025 it needs before it will use cookies for
// visitors in the EEA, the UK and Switzerland. We run no ads, so ad storage is always denied. The loader waits
// for the page to be interactive so it never holds up the first paint.
(function () {
  var CLARITY_ID = 'zjwibbr2ia';
  var KEY = 'hl-cookie-consent';
  function choice() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function grant() { window.clarity('consentv2', { ad_Storage: 'denied', analytics_Storage: 'granted' }); }
  function load() {
    if (window.__hlAnalytics || choice() !== 'accepted') return;
    window.__hlAnalytics = true;
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', CLARITY_ID);
    grant();
  }
  // Clarity's own first-party cookies, removed on Decline in case Clarity ran earlier on this browser.
  function eraseCookies() {
    ['_clck', '_clsk'].forEach(function (n) {
      document.cookie = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
      document.cookie = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=' + location.hostname;
      document.cookie = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.' + location.hostname.replace(/^www\./, '');
    });
  }
  // Called by the banner once the visitor picks.
  window.__hlConsent = function (v) {
    if (v === 'accepted') { if (window.__hlAnalytics) grant(); else load(); }
    if (v !== 'accepted') eraseCookies();
    // Clarity's own erase: it deletes its cookies and stops tracking on this page. Nothing loads from the next
    // page on, because load() checks KEY.
    if (v === 'declined' && window.__hlAnalytics) window.clarity('consent', false);
  };
  window.__hlClarityNow = load;
  // A returning visitor who accepted gets Clarity at idle; everyone else gets nothing.
  if (choice() !== 'accepted') return;
  var start = function () { ('requestIdleCallback' in window) ? requestIdleCallback(load, { timeout: 4000 }) : setTimeout(load, 2500); };
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start, { once: true });
})();
