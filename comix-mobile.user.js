// ==UserScript==
// @name         Comix Mobile Feed
// @namespace    comix-android-ui
// @version      0.3.0
// @description  Sticky tab bar with configurable home sections, 3-column grid, endless Latest Updates, titles open in new tabs.
// @match        https://comix.to/*
// @run-at       document-start
// @grant        none
// @noframes
// @homepageURL  https://github.com/polo2005x/comix-android-ui
// @updateURL    https://raw.githubusercontent.com/polo2005x/comix-android-ui/main/comix-mobile.user.js
// @downloadURL  https://raw.githubusercontent.com/polo2005x/comix-android-ui/main/comix-mobile.user.js
// ==/UserScript==

(() => {
  'use strict';

  const VIEW_KEY = 'cx-mobile-tab';
  const TABS_KEY = 'cx-mobile-tabs';
  const COLS = 3;

  // Tabs in bar order. `title` finds the home section by its heading.
  const TABS = [
    { key: 'announce', label: 'News', name: 'Announcements' },
    { key: 'popular', label: 'Popular', name: 'Most Recent Popular', title: 'Most Recent Popular' },
    { key: 'follows', label: 'Follows', name: 'Most Follows · New Comics', title: 'Most Follows' },
    { key: 'hot', label: 'Hot', name: 'Latest Updates · Hot' },
    { key: 'new', label: 'New', name: 'Latest Updates · New' },
    { key: 'collections', label: 'Lists', name: 'User Collections', title: 'User Collections' },
    { key: 'browse', label: 'Browse', name: 'Browse (opens the site’s browse page)' },
  ];
  const DEFAULT_TABS = ['hot', 'new', 'popular'];
  const isLatest = (v) => v === 'hot' || v === 'new';

  const page = () => (location.pathname === '/' ? 'home' : location.pathname === '/browse' ? 'browse' : null);
  if (!page()) return;

  const load = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch (_) { return fallback; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };

  let enabled = load(TABS_KEY, DEFAULT_TABS).filter((k) => TABS.some((t) => t.key === k));
  if (!enabled.length) enabled = DEFAULT_TABS.slice();
  const homeTabs = () => enabled.filter((k) => k !== 'browse');

  // Always start Latest Updates from page 1; the site keeps ?page=N in the URL.
  if (page() === 'home') {
    const u = new URL(location.href);
    if (u.searchParams.has('page')) {
      u.searchParams.delete('page');
      history.replaceState(history.state, '', u);
    }
  }

  const root = document.documentElement;
  root.classList.add('cx-on');
  root.dataset.cxPage = page();

  // ---------- styles ----------
  const css = `
  html.cx-on { --cx-bar: 48px; scroll-behavior: auto !important; }
  html.cx-on body { padding-top: var(--cx-bar) !important; }
  html.cx-on header.topnav,
  html.cx-on footer.footer { display: none !important; }

  /* home: show only the active section */
  html.cx-on[data-cx-page="home"] main.layout .side-col,
  html.cx-on[data-cx-page="home"] main.layout .main-col > :not(.cx-active):not(.cx-keep) { display: none !important; }
  html.cx-on[data-cx-page="home"] main.layout { display: block !important; padding: 0 8px !important; margin: 0 !important; max-width: none !important; }
  html.cx-on[data-cx-page="home"] main.layout .main-col { width: auto !important; max-width: none !important; }
  html.cx-on .cx-active .card__menu { display: none !important; }

  /* active section header: keep only the site's ⋮ menu (type / timeframe / options) */
  html.cx-on .cx-active .section__header { justify-content: flex-end !important; margin: 4px 0 !important; min-height: 0 !important; }
  html.cx-on .cx-active .section__title-wrap,
  html.cx-on .cx-active .filter-group,
  html.cx-on .cx-active .nav-btns > .nav-btn { display: none !important; }

  /* swiper rails (Popular, Follows, Collections) become grids */
  html.cx-on .cx-active .swiper { overflow: visible !important; }
  html.cx-on .cx-active .swiper-wrapper {
    display: grid !important; grid-template-columns: repeat(${COLS}, minmax(0, 1fr)) !important;
    gap: 10px 8px !important; transform: none !important; height: auto !important;
  }
  html.cx-on .cx-active .hcoll-swiper .swiper-wrapper { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  html.cx-on .cx-active .swiper-slide { width: auto !important; margin: 0 !important; height: auto !important; }

  /* Latest: hide the site's paged grid, show our endless feed instead */
  html.cx-on .cx-active .grid-updates,
  html.cx-on .cx-active .pager { display: none !important; }
  html.cx-on:not([data-cx-view="latest"]) .cx-keep { display: none !important; }
  #cx-feed { display: grid; grid-template-columns: repeat(${COLS}, minmax(0, 1fr)); gap: 10px 8px; }

  /* compact cards for 3 columns */
  html.cx-on .cx-active a.card, #cx-feed a.card { min-width: 0; }
  html.cx-on .cx-active .card__title, #cx-feed .card__title { font-size: 12px !important; line-height: 1.25 !important; }
  html.cx-on .cx-active .card__meta, #cx-feed .card__meta { font-size: 10.5px !important; gap: 4px !important; }

  #cx-status { text-align: center; padding: 18px 0 28px; font: 13px system-ui, sans-serif; opacity: .65; }

  /* top bar */
  #cx-bar {
    position: fixed; top: 0; left: 0; right: 0; z-index: 2147483000; height: var(--cx-bar);
    display: flex; align-items: stretch; gap: 4px; padding: 6px 8px; box-sizing: border-box;
    background: rgba(14, 14, 18, .94); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    border-bottom: 1px solid rgba(255, 255, 255, .08);
  }
  #cx-tabs { flex: 1; display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; }
  #cx-tabs::-webkit-scrollbar { display: none; }
  #cx-bar button {
    border: 0; border-radius: 8px; background: transparent; color: #cfcfd6;
    font: 600 14px system-ui, sans-serif; cursor: pointer; white-space: nowrap;
  }
  #cx-tabs button { flex: 1 0 auto; padding: 0 10px; }
  #cx-bar button.is-on { background: rgba(255, 255, 255, .12); color: #fff; }
  #cx-cog { flex: 0 0 36px; display: grid; place-items: center; padding: 0; }
  #cx-cog svg { width: 20px; height: 20px; }

  /* settings panel */
  #cx-settings {
    position: fixed; top: calc(var(--cx-bar) + 6px); right: 8px; z-index: 2147483001;
    width: min(300px, calc(100vw - 16px)); box-sizing: border-box; padding: 12px 14px;
    background: #1b1b22; color: #e6e6ec; border: 1px solid rgba(255, 255, 255, .12); border-radius: 12px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, .5); font: 14px system-ui, sans-serif;
  }
  #cx-settings[hidden] { display: none; }
  #cx-settings h3 { margin: 0 0 8px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; opacity: .7; }
  #cx-settings label { display: flex; align-items: center; gap: 10px; padding: 8px 0; cursor: pointer; }
  #cx-settings input { width: 18px; height: 18px; margin: 0; accent-color: #8b7cff; }
  #cx-settings p { margin: 8px 0 0; font-size: 12px; opacity: .6; }
  `;
  const style = document.createElement('style');
  style.id = 'cx-style';
  style.textContent = css;
  (document.head || root).appendChild(style);

  // ---------- page lookups (re-queried each time; React may replace nodes) ----------
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const mainCol = () => $('main.layout .main-col');
  const sectionTitled = (text) => $$('section.section').find((s) => $('h2', s)?.textContent.trim().startsWith(text));
  const latestSec = () => $('.grid-updates')?.closest('section') || sectionTitled('Latest Updates');
  const latestGrid = () => $('.grid-updates', latestSec() || document);
  const nextBtn = () => $$('.pager__btn', latestSec() || document).find((b) => /next/i.test(b.textContent + b.getAttribute('aria-label')));
  const viewEl = (v) => {
    if (isLatest(v)) return latestSec();
    if (v === 'announce') return $('.main-col > .announce') || $('aside.announce');
    const t = TABS.find((x) => x.key === v);
    return t?.title ? sectionTitled(t.title) : null;
  };

  // ---------- state ----------
  let view = page() === 'browse' ? 'browse' : load(VIEW_KEY, null);
  if (page() === 'home' && !homeTabs().includes(view)) view = homeTabs()[0] || 'hot';
  const seen = new Set();
  let loading = false;
  let pendingSig = null;
  let loadTimer = null;
  let feed, status, sentinel, bar, tabsEl, panel;

  const gridSig = () => $$('a.card', latestGrid() || document.createElement('div')).slice(0, 4).map((a) => a.getAttribute('href')).join('|');

  // ---------- top bar + settings ----------
  function buildBar() {
    bar = document.createElement('nav');
    bar.id = 'cx-bar';
    tabsEl = document.createElement('div');
    tabsEl.id = 'cx-tabs';
    const cog = document.createElement('button');
    cog.id = 'cx-cog';
    cog.type = 'button';
    cog.setAttribute('aria-label', 'Tab settings');
    cog.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
    cog.addEventListener('click', (e) => { e.stopPropagation(); panel.hidden = !panel.hidden; });
    bar.append(tabsEl, cog);
    document.body.appendChild(bar);
    renderTabs();

    panel = document.createElement('div');
    panel.id = 'cx-settings';
    panel.hidden = true;
    panel.innerHTML = '<h3>Tabs</h3>';
    for (const t of TABS) {
      const row = document.createElement('label');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = enabled.includes(t.key);
      box.addEventListener('change', () => {
        const next = TABS.map((x) => x.key).filter((k) => (k === t.key ? box.checked : enabled.includes(k)));
        if (!next.length) { box.checked = true; return; } // keep at least one tab
        enabled = next;
        save(TABS_KEY, enabled);
        renderTabs();
        if (page() === 'home' && !homeTabs().includes(view) && homeTabs().length) setView(homeTabs()[0]);
      });
      row.append(box, document.createTextNode(t.name));
      panel.appendChild(row);
    }
    const note = document.createElement('p');
    note.textContent = 'Each tab keeps the site’s own ⋮ menu (timeframe, type) at the top right.';
    panel.appendChild(note);
    panel.addEventListener('click', (e) => e.stopPropagation());
    document.body.appendChild(panel);
    document.addEventListener('click', () => { panel.hidden = true; });
  }

  function renderTabs() {
    tabsEl.textContent = '';
    for (const t of TABS) {
      if (!enabled.includes(t.key)) continue;
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.view = t.key;
      b.textContent = t.label;
      b.classList.toggle('is-on', t.key === view);
      b.addEventListener('click', () => onTab(t.key));
      tabsEl.appendChild(b);
    }
    $('button.is-on', tabsEl)?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }

  function onTab(key) {
    if (key === view) return window.scrollTo({ top: 0, behavior: 'smooth' });
    if (key === 'browse') { location.href = '/browse'; return; }
    if (page() !== 'home') { save(VIEW_KEY, key); location.href = '/'; return; }
    setView(key);
  }

  // ---------- home views ----------
  function buildFeed() {
    const wrap = document.createElement('div');
    wrap.className = 'cx-keep';
    feed = document.createElement('div');
    feed.id = 'cx-feed';
    status = document.createElement('div');
    status.id = 'cx-status';
    sentinel = document.createElement('div');
    sentinel.id = 'cx-sentinel';
    sentinel.style.height = '1px';
    wrap.append(feed, status, sentinel);
    mainCol().appendChild(wrap);

    new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) loadMore();
    }, { rootMargin: '1500px 0px' }).observe(sentinel);
  }

  function markActive() {
    const want = viewEl(view);
    for (const el of $$('.main-col > *')) {
      if (!el.classList.contains('cx-keep')) el.classList.toggle('cx-active', el === want);
    }
    for (const b of $$('button', tabsEl)) b.classList.toggle('is-on', b.dataset.view === view);
    root.dataset.cxView = isLatest(view) ? 'latest' : view;
  }

  function setView(v) {
    view = v;
    save(VIEW_KEY, v);
    markActive();
    window.scrollTo(0, 0);
    if (isLatest(v)) selectLatestTab(v);
  }

  // Click the site's own Hot/New tab if it isn't already selected.
  function selectLatestTab(v) {
    const sec = latestSec();
    if (!sec) return;
    const btn = $$('.filter-btn', sec).find((b) => b.textContent.trim().toLowerCase() === v);
    if (btn && !btn.classList.contains('is-active')) {
      resetFeed();
      btn.click();
    }
  }

  // ---------- endless feed ----------
  function resetFeed() {
    seen.clear();
    feed.textContent = '';
    status.textContent = '';
    loading = false;
    pendingSig = null;
    clearTimeout(loadTimer);
    holdY = null;
  }

  function harvest() {
    const grid = latestGrid();
    if (!grid) return 0;
    let added = 0;
    for (const a of $$('a.card', grid)) {
      const href = a.getAttribute('href');
      if (!href || seen.has(href)) continue;
      seen.add(href);
      const c = a.cloneNode(true);
      c.querySelector('.card__menu')?.remove(); // its "add to library" handler doesn't survive cloning
      c.target = '_blank';
      c.rel = 'noopener';
      feed.appendChild(c);
      added++;
    }
    return added;
  }

  function sentinelNear() {
    return sentinel.getBoundingClientRect().top < innerHeight + 1500;
  }

  function loadMore() {
    if (!isLatest(view) || loading) return;
    const btn = nextBtn();
    if (!btn || btn.disabled || btn.getAttribute('aria-disabled') === 'true') {
      status.textContent = seen.size ? 'No more updates' : '';
      return;
    }
    loading = true;
    pendingSig = gridSig();
    status.textContent = 'Loading…';
    holdScroll();
    btn.click();
    clearTimeout(loadTimer);
    loadTimer = setTimeout(() => { // give up on this attempt; the next scroll retries
      loading = false;
      releaseScroll(0);
      status.textContent = 'Couldn’t load more. Scroll to retry.';
    }, 12000);
  }

  // After Next, the site scrolls back up to its section (the top of our page).
  // While a page loads, undo any big upward jump; normal scrolling down is allowed.
  let holdY = null;
  let releaseTimer;
  function holdScroll() {
    clearTimeout(releaseTimer);
    holdY = scrollY;
  }
  function releaseScroll(delay) {
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(() => { holdY = null; }, delay);
  }
  window.addEventListener('scroll', () => {
    if (holdY === null) return;
    if (scrollY > holdY) holdY = scrollY;
    else if (holdY - scrollY > 150) window.scrollTo(0, holdY);
  }, { passive: true });

  // React re-renders the site's grid after Next, Hot/New or the type filter.
  let debounce;
  function onSiteChange() {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      markActive();
      const sig = gridSig();
      if (!sig) return; // still loading / skeleton
      if (loading) {
        if (sig === pendingSig) return;
        loading = false;
        clearTimeout(loadTimer);
        status.textContent = '';
        harvest();
        if (holdY !== null) window.scrollTo(0, holdY);
        releaseScroll(800); // the site may scroll a moment after rendering
        if (sentinelNear()) loadMore();
      } else if (!seen.has(sig.split('|')[0])) {
        // A grid we didn't ask for (type filter or Hot/New change): start over.
        resetFeed();
        harvest();
        if (sentinelNear()) loadMore();
      }
    }, 120);
  }

  // ---------- open titles and collections in a new tab ----------
  // Let the browser follow the link natively as target=_blank (window.open() gets
  // popup-blocked on Firefox Android); just keep the site's router and the swiper
  // from seeing the click. Buttons inside cards (add to library) are left alone.
  document.addEventListener('click', (e) => {
    if (!root.classList.contains('cx-on')) return;
    const a = e.target.closest?.('main a[href^="/title/"], main a[href^="/collections/"]');
    if (!a || e.target.closest('button')) return;
    a.target = '_blank';
    a.rel = 'noopener';
    e.stopPropagation();
  }, true);

  // ---------- boot ----------
  function ready() {
    if (!document.body) return false;
    return page() === 'browse' || (mainCol() && latestGrid() && viewEl('popular'));
  }

  function start() {
    buildBar();
    if (page() === 'home') {
      buildFeed();
      markActive();
      new MutationObserver(onSiteChange).observe(mainCol(), { childList: true, subtree: true });
      if (isLatest(view)) selectLatestTab(view);
      harvest();
      if (sentinelNear()) loadMore();
    }
    // If the SPA leaves home/browse, get out of the way.
    const here = page();
    setInterval(() => root.classList.toggle('cx-on', page() === here), 1000);
  }

  const boot = new MutationObserver(() => {
    if (ready()) { boot.disconnect(); start(); }
  });
  const begin = () => {
    if (ready()) start();
    else boot.observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', begin);
  else begin();
})();
