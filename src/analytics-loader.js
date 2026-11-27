// Microsoft Clarity for docs.hotloop.io, read by astro.config.mjs and put in every page head, in every
// language. Same consent behavior as hotloop.io, embernet.ai and fireballindustries.com: Clarity loads only
// after the visitor presses Accept on the cookie banner (src/components/CookieBanner.astro). Until a choice is
// made, and after Decline, nothing from Clarity is requested and no Clarity cookie is set. Accept is passed to
// Clarity through its consent API, which since 31 October 2025 it needs before it will use cookies for
// visitors in the EEA, the UK and Switzerland. We run no ads, so ad storage is always denied. The loader waits
// for the page to be interactive so it never holds up the first paint.
(function () {
  // Google Analytics 4 measurement id. Put the G- id here and Google Analytics turns on: it loads after the same
  // Accept as Clarity, under Consent Mode. Empty means the property does not exist yet and nothing from Google is
  // requested.
  var GA_ID = 'G-SSMX2FKNJE';
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
    loadGa();
  }
  // Google Analytics under Consent Mode. This only runs after Accept, so the default already is the visitor's choice:
    // analytics granted, ad storage and the ad signals denied, set before the config. A denied default with an update in the
    // same tick sends the page_view as gcs=G100, which GA does not report (Google's consent guide: gtag commands are queued
    // and may not be processed before the next event). A later Decline sends the update to denied.
  function loadGa() {
    if (!GA_ID || window.__hlGa) return;
    window.__hlGa = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    window.gtag('js', new Date());
    var g = document.createElement('script');
    g.async = true;
    g.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(g);
    window.gtag('config', GA_ID, { anonymize_ip: true });
  }
  // Clarity's own first-party cookies, removed on Decline in case Clarity ran earlier on this browser.
  function eraseCookies() {
    var names = ['_clck', '_clsk', '_ga', '_gid', '_gat'];
      document.cookie.split(';').forEach(function (c) { var n = c.split('=')[0].trim(); if (/^_ga_/.test(n)) names.push(n); });
      names.forEach(function (n) {
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
      if (v === 'declined' && window.__hlGa) window.gtag('consent', 'update', { analytics_storage: 'denied' });
  };
  window.__hlClarityNow = load;
  // docs.hotloop.io has no form; its contact path is the footer mail link. A click on any mailto link is told to
  // Google Analytics and Clarity as contact_click. Both exist only after Accept, so a visitor who declined sends nothing.
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href^="mailto:"]') : null;
    if (!a) return;
    try {
      if (typeof window.gtag !== 'function') load();
      if (typeof window.gtag === 'function') window.gtag('event', 'contact_click', { link_url: a.getAttribute('href') });
      if (typeof window.clarity === 'function') window.clarity('event', 'contact_click');
    } catch (err) { /* analytics must never break the page */ }
  });
  // A returning visitor who accepted gets Clarity at idle; everyone else gets nothing.
  if (choice() !== 'accepted') return;
  var start = function () { ('requestIdleCallback' in window) ? requestIdleCallback(load, { timeout: 4000 }) : setTimeout(load, 2500); };
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start, { once: true });
})();
