// ==UserScript==
// @name         Comix Mobile Feed
// @namespace    comix-android-ui
// @version      0.2.0
// @description  Home page only: sticky Hot / New / Popular tab bar, 3-column grid, endless scroll, titles open in new tabs.
// @match        https://comix.to/*
// @run-at       document-start
// @grant        none
// @homepageURL  https://github.com/polo2005x/comix-android-ui
// @updateURL    https://raw.githubusercontent.com/polo2005x/comix-android-ui/main/comix-mobile.user.js
// @downloadURL  https://raw.githubusercontent.com/polo2005x/comix-android-ui/main/comix-mobile.user.js
// ==/UserScript==

(() => {
  'use strict';

  const STORE_KEY = 'cx-mobile-tab';
  const COLS = 3;
  const isHome = () => location.pathname === '/';
  if (!isHome()) return;

  // Always start Latest Updates from page 1; the site keeps ?page=N in the URL.
  {
    const u = new URL(location.href);
    if (u.searchParams.has('page')) {
      u.searchParams.delete('page');
      history.replaceState(history.state, '', u);
    }
  }

  const root = document.documentElement;
  root.classList.add('cx-on');

  // ---------- styles ----------
  const css = `
  html.cx-on { --cx-bar: 48px; }
  html.cx-on { scroll-behavior: auto !important; }
  html.cx-on body { padding-top: var(--cx-bar) !important; }
  html.cx-on .cx-active .card__menu { display: none !important; }
  html.cx-on header.topnav,
  html.cx-on footer.footer,
  html.cx-on main.layout .side-col,
  html.cx-on main.layout .main-col > :not(.cx-active):not(.cx-keep) { display: none !important; }
  html.cx-on main.layout { display: block !important; padding: 0 8px !important; margin: 0 !important; max-width: none !important; }
  html.cx-on main.layout .main-col { width: auto !important; max-width: none !important; }

  /* active section header: keep only the site's filter menu (type / timeframe) */
  html.cx-on .cx-active .section__header { justify-content: flex-end !important; margin: 4px 0 !important; min-height: 0 !important; }
  html.cx-on .cx-active .section__title-wrap,
  html.cx-on .cx-active .filter-group,
  html.cx-on .cx-active .nav-btns > .nav-btn { display: none !important; }

  /* Popular: turn the swiper rail into a grid */
  html.cx-on .cx-active .swiper { overflow: visible !important; }
  html.cx-on .cx-active .swiper-wrapper {
    display: grid !important; grid-template-columns: repeat(${COLS}, minmax(0, 1fr)) !important;
    gap: 10px 8px !important; transform: none !important; height: auto !important;
  }
  html.cx-on .cx-active .swiper-slide { width: auto !important; margin: 0 !important; height: auto !important; }

  /* Latest: hide the site's paged grid, show our endless feed instead */
  html.cx-on .cx-active .grid-updates,
  html.cx-on .cx-active .pager { display: none !important; }
  html.cx-on:not([data-cx-view="latest"]) .cx-keep { display: none !important; }
  #cx-feed { display: grid; grid-template-columns: repeat(${COLS}, minmax(0, 1fr)); gap: 10px 8px; }
  #cx-feed > a.card { min-width: 0; }

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
  #cx-bar button {
    flex: 1; border: 0; border-radius: 8px; background: transparent; color: #cfcfd6;
    font: 600 14px system-ui, sans-serif; cursor: pointer;
  }
  #cx-bar button.is-on { background: rgba(255, 255, 255, .12); color: #fff; }
  `;
  const style = document.createElement('style');
  style.id = 'cx-style';
  style.textContent = css;
  (document.head || root).appendChild(style);

  // ---------- page lookups (re-queried each time; React may replace nodes) ----------
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const mainCol = () => $('main.layout .main-col');
  const sectionTitled = (text) => $$('section.section').find((s) => $('h2', s)?.textContent.trim() === text);
  const latestSec = () => $('.grid-updates')?.closest('section') || sectionTitled('Latest Updates');
  const popularSec = () => sectionTitled('Most Recent Popular') || $$('section.section').find((s) => $('.swiper a.card', s));
  const latestGrid = () => $('.grid-updates', latestSec() || document);
  const nextBtn = () => $$('.pager__btn', latestSec() || document).find((b) => /next/i.test(b.textContent + b.getAttribute('aria-label')));

  // ---------- state ----------
  let view = localStorage.getItem(STORE_KEY) || 'hot'; // hot | new | popular
  if (!['hot', 'new', 'popular'].includes(view)) view = 'hot';
  const seen = new Set();
  let loading = false;
  let pendingSig = null;
  let loadTimer = null;
  let feed, status, sentinel, bar;

  const gridSig = () => $$('a.card', latestGrid() || document.createElement('div')).slice(0, 4).map((a) => a.getAttribute('href')).join('|');

  // ---------- UI ----------
  function buildUI() {
    bar = document.createElement('nav');
    bar.id = 'cx-bar';
    for (const [key, label] of [['hot', 'Hot'], ['new', 'New'], ['popular', 'Popular']]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.view = key;
      b.textContent = label;
      b.addEventListener('click', () => (key === view ? window.scrollTo({ top: 0, behavior: 'smooth' }) : setView(key)));
      bar.appendChild(b);
    }
    document.body.appendChild(bar);

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
    const want = view === 'popular' ? popularSec() : latestSec();
    for (const s of $$('section.section')) s.classList.toggle('cx-active', s === want);
    for (const b of $$('button', bar)) b.classList.toggle('is-on', b.dataset.view === view);
    root.dataset.cxView = view === 'popular' ? 'popular' : 'latest';
  }

  function setView(v) {
    view = v;
    try { localStorage.setItem(STORE_KEY, v); } catch (_) {}
    markActive();
    window.scrollTo(0, 0);
    if (v !== 'popular') selectLatestTab(v);
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
    if (view === 'popular' || loading) return;
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

  // ---------- open titles in a new tab ----------
  // Let the browser follow the link natively as target=_blank (window.open() gets
  // popup-blocked on Firefox Android); just keep the site's router and the swiper
  // from seeing the click.
  document.addEventListener('click', (e) => {
    if (!root.classList.contains('cx-on')) return;
    const a = e.target.closest?.('a.card');
    if (!a) return;
    a.target = '_blank';
    a.rel = 'noopener';
    e.stopPropagation();
  }, true);

  // ---------- boot ----------
  function ready() {
    return mainCol() && latestGrid() && popularSec();
  }

  function start() {
    buildUI();
    markActive();
    new MutationObserver(onSiteChange).observe(mainCol(), { childList: true, subtree: true });
    if (view !== 'popular') selectLatestTab(view);
    harvest();
    if (sentinelNear()) loadMore();
    // If the SPA ever leaves the home page, get out of the way.
    setInterval(() => root.classList.toggle('cx-on', isHome()), 1000);
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
