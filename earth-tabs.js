/* Stellar Life — Earth: tab controller. Modules listen for 'earth:tab' (detail.id) and 'earth:theme'. */
(function () {
  'use strict';
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const tabs = $$('.tabs [role=tab]');
  const store = { get(k) { try { return localStorage.getItem('earth-' + k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem('earth-' + k, v); } catch (e) { /* unavailable */ } } };
  let current = null;
  function show(id, focus) {
    tabs.forEach((t) => { const on = t.getAttribute('aria-controls') === id; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; document.getElementById(t.getAttribute('aria-controls')).hidden = !on; if (on && focus) t.focus(); });
    current = id; store.set('tab', id);
    if (location.hash.slice(1) !== id) history.replaceState(null, '', '#' + id);
    document.dispatchEvent(new CustomEvent('earth:tab', { detail: { id } }));
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => show(t.getAttribute('aria-controls')));
    t.addEventListener('keydown', (e) => {
      const n = tabs.length; let j = null;
      if (e.key === 'ArrowRight') j = (i + 1) % n; if (e.key === 'ArrowLeft') j = (i - 1 + n) % n;
      if (e.key === 'Home') j = 0; if (e.key === 'End') j = n - 1;
      if (j !== null) { e.preventDefault(); show(tabs[j].getAttribute('aria-controls'), true); }
    });
  });
  const valid = (id) => tabs.some((t) => t.getAttribute('aria-controls') === id);
  addEventListener('hashchange', () => { const h = location.hash.slice(1); if (valid(h) && h !== current) show(h); });
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => document.dispatchEvent(new CustomEvent('earth:theme', { detail: { id: current } })));
  window.EarthTabs = { current: () => current, show };
  // modules load after this script; start once the DOM and modules are ready
  addEventListener('DOMContentLoaded', () => { const h = location.hash.slice(1), s = store.get('tab'); show(valid(h) ? h : valid(s) ? s : 'inside'); });
})();
