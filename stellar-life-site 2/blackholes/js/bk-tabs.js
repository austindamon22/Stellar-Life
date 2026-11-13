/* Stellar Life — Black holes: tab controller. Modules listen for 'bk:tab' (detail.id) and 'bk:theme'. */
(function () {
  'use strict';
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const tabs = $$('.tabs [role=tab]');
  const store = { get(k) { try { return localStorage.getItem('bk-' + k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem('bk-' + k, v); } catch (e) { /* unavailable */ } } };
  const smooth = () => !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let current = null;
  function show(id, focus) {
    tabs.forEach((t) => {
      const on = t.getAttribute('aria-controls') === id;
      t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      if (on && focus) t.focus();
    });
    current = id; store.set('tab', id);
    if (location.hash.slice(1) !== id) history.replaceState(null, '', '#' + id);
    document.dispatchEvent(new CustomEvent('bk:tab', { detail: { id } }));
    tabReveal();
  }
  // phone tab bar: fade + chevron on each side that hides tabs; keep the chosen tab fully in view
  const bar = document.querySelector('.tabs');
  function tabSync() {
    if (!bar) return;
    const max = bar.scrollWidth - bar.clientWidth, more = bar.clientWidth > 0 && max > 2;
    bar.classList.toggle('fade-l', more && bar.scrollLeft > 2);
    bar.classList.toggle('fade-r', more && bar.scrollLeft < max - 2);
  }
  function tabReveal() {
    if (!bar) return;
    const t = tabs.find((x) => x.getAttribute('aria-selected') === 'true');
    if (t && bar.scrollWidth > bar.clientWidth + 2) {
      const b = bar.getBoundingClientRect(), r = t.getBoundingClientRect(), m = 40;
      let to = bar.scrollLeft;
      if (r.left < b.left + m) to += r.left - b.left - m;
      else if (r.right > b.right - m) to += r.right - b.right + m;
      if (to !== bar.scrollLeft) bar.scrollTo({ left: to, behavior: smooth() ? 'smooth' : 'auto' });
    }
    tabSync();
  }
  if (bar) { bar.addEventListener('scroll', tabSync, { passive: true }); addEventListener('resize', tabReveal); }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => show(t.getAttribute('aria-controls')));
    t.addEventListener('keydown', (e) => {
      const n = tabs.length; let j = null;
      if (e.key === 'ArrowRight') j = (i + 1) % n;
      if (e.key === 'ArrowLeft') j = (i - 1 + n) % n;
      if (e.key === 'Home') j = 0;
      if (e.key === 'End') j = n - 1;
      if (j !== null) { e.preventDefault(); show(tabs[j].getAttribute('aria-controls'), true); }
    });
  });
  const valid = (id) => tabs.some((t) => t.getAttribute('aria-controls') === id);
  addEventListener('hashchange', () => { const h = location.hash.slice(1); if (valid(h) && h !== current) show(h); });
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => document.dispatchEvent(new CustomEvent('bk:theme', { detail: { id: current } })));
  window.BKTabs = { current: () => current, show };
  // in-page links to another tab
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a.tab-link'); if (!a) return;
    const id = (a.getAttribute('href') || '').slice(1); if (!valid(id)) return;
    e.preventDefault(); show(id);
    const to = document.getElementById(a.dataset.scroll || '') || document.getElementById(id);
    requestAnimationFrame(() => to.scrollIntoView({ behavior: smooth() ? 'smooth' : 'auto', block: 'start' }));
  });
  // wide figures that scroll sideways on phones: fade only the side that has more, plus a swipe hint
  function wideInit() {
    $$('.bk-wide').forEach((w) => {
      if (w.__fade) return; w.__fade = true;
      const hint = document.createElement('p'); hint.className = 'bk-swipe note'; hint.textContent = 'Swipe to see more →'; hint.hidden = true;
      hint.setAttribute('aria-hidden', 'true'); w.after(hint); w.__hint = hint;
      w.addEventListener('scroll', () => wideSync(w), { passive: true });
    });
  }
  function wideSync(w) {
    const max = w.scrollWidth - w.clientWidth, more = w.clientWidth > 0 && max > 2;
    w.classList.toggle('fade-l', more && w.scrollLeft > 2);
    w.classList.toggle('fade-r', more && w.scrollLeft < max - 2);
    if (w.__hint) { w.__hint.hidden = !more; w.__hint.style.visibility = w.scrollLeft < max - 2 ? '' : 'hidden'; }
  }
  const wideAll = () => $$('.bk-wide').forEach(wideSync);
  document.addEventListener('bk:tab', () => requestAnimationFrame(wideAll));
  addEventListener('resize', wideAll);
  // modules load after this script; start once the DOM and modules are ready
  addEventListener('DOMContentLoaded', () => { wideInit(); const h = location.hash.slice(1), s = store.get('tab'); show(valid(h) ? h : valid(s) ? s : 'basics'); });
})();
