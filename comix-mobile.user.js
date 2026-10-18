// ==UserScript==
// @name         Comix Mobile Feed
// @namespace    comix-android-ui
// @version      0.5.1
// @description  Sticky tab bar with configurable, reorderable home sections, 3-column grid, endless Latest Updates and Browse, page jump, browse presets.
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
  const TABS_KEY = 'cx-mobile-tabs'; // shown tab keys, in bar order
  const HEADER_KEY = 'cx-mobile-header'; // show the site's own header
  const PRESETS_KEY = 'cx-browse-presets';
  const COLS = 3;

  // `title` finds the home section by the start of its heading.
  const TABS = [
    { key: 'announce', label: 'News', name: 'Announcements' },
    { key: 'followed', label: 'Followed', name: 'New Chapters from Followed Comics', title: 'New Chapters' },
    { key: 'history', label: 'History', name: 'Reading History', title: 'Reading History' },
    { key: 'recommended', label: 'For you', name: 'Recommended for you', title: 'Recommended' },
    { key: 'popular', label: 'Popular', name: 'Most Recent Popular', title: 'Most Recent Popular' },
    { key: 'follows', label: 'Follows', name: 'Most Follows · New Comics', title: 'Most Follows' },
    { key: 'hot', label: 'Hot', name: 'Latest Updates · Hot' },
    { key: 'new', label: 'New', name: 'Latest Updates · New' },
    { key: 'collections', label: 'Lists', name: 'User Collections', title: 'User Collections' },
    { key: 'browse', label: 'Browse', name: 'Browse (the site’s browse page)' },
  ];
  const ALL_KEYS = TABS.map((t) => t.key);
  const tabOf = (k) => TABS.find((t) => t.key === k);
  const DEFAULT_TABS = ['hot', 'new', 'popular'];
  const isLatest = (v) => v === 'hot' || v === 'new';

  const page = () => (location.pathname === '/' ? 'home' : location.pathname === '/browse' ? 'browse' : null);
  if (!page()) return;

  const load = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch (_) { return fallback; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };

  let enabled = [...new Set(load(TABS_KEY, DEFAULT_TABS))].filter((k) => ALL_KEYS.includes(k));
  if (!enabled.length) enabled = DEFAULT_TABS.slice();
  const barTabs = () => enabled;
  const homeTabs = () => barTabs().filter((k) => k !== 'browse');

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
  root.classList.toggle('cx-showhdr', !!load(HEADER_KEY, false));
  root.dataset.cxPage = page();

  // ---------- styles ----------
  const css = `
  html.cx-on { --cx-bar: 48px; scroll-behavior: auto !important; }
  html.cx-on body { padding-top: var(--cx-bar) !important; }
  html.cx-on footer.footer { display: none !important; }
  html.cx-on:not(.cx-peek):not(.cx-showhdr) header.topnav { display: none !important; }
  /* site header, when shown, sits right under our bar */
  html.cx-on.cx-peek header.topnav,
  html.cx-on.cx-showhdr header.topnav { position: sticky !important; top: var(--cx-bar) !important; z-index: 2147482990 !important; }

  /* home: show only the active section */
  html.cx-on[data-cx-page="home"] main.layout .side-col,
  html.cx-on[data-cx-page="home"] main.layout .main-col > :not(.cx-active):not(.cx-keep) { display: none !important; }
  html.cx-on[data-cx-page="home"] main.layout { display: block !important; padding: 0 8px !important; margin: 0 !important; max-width: none !important; }
  html.cx-on[data-cx-page="home"] main.layout .main-col { width: auto !important; max-width: none !important; }
  html.cx-on .cx-active .card__menu { display: none !important; }

  /* active section header: keep only the site's ⋮ menu */
  html.cx-on .cx-active .section__header { justify-content: flex-end !important; margin: 4px 0 !important; min-height: 0 !important; }
  html.cx-on .cx-active .section__title-wrap,
  html.cx-on .cx-active .filter-group,
  html.cx-on .cx-active .nav-btns > .nav-btn { display: none !important; }

  /* swiper rails become grids */
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
  html.cx-on[data-cx-page="home"]:not([data-cx-view="latest"]) .cx-keep { display: none !important; }
  #cx-feed.cx-home { display: grid; grid-template-columns: repeat(${COLS}, minmax(0, 1fr)); gap: 10px 8px; }

  /* Browse: hide the site's paged results and pager once our feed has content */
  html.cx-on[data-cx-page="browse"].cx-bfeed-on .list-wrap > div:has(> [class*="list-grid"]),
  html.cx-on[data-cx-page="browse"].cx-bfeed-on .list-wrap > .npager { display: none !important; }
  html.cx-on[data-cx-page="browse"] .list-grid--cards,
  #cx-feed.list-grid--cards { display: grid !important; grid-template-columns: repeat(${COLS}, minmax(0, 1fr)) !important; gap: 10px 8px !important; }
  #cx-feed .card__menu { display: none !important; }

  /* compact cards for 3 columns */
  html.cx-on .cx-active a.card, #cx-feed a.card, .list-grid--cards a.card { min-width: 0; }
  html.cx-on .cx-active .card__title, #cx-feed .card__title, .list-grid--cards .card__title { font-size: 12px !important; line-height: 1.25 !important; }
  html.cx-on .cx-active .card__meta, #cx-feed .card__meta, .list-grid--cards .card__meta { font-size: 10.5px !important; gap: 4px !important; }

  #cx-status { text-align: center; padding: 18px 0 28px; font: 13px system-ui, sans-serif; opacity: .65; }

  /* page separators in the feed */
  .cx-pmark {
    grid-column: 1 / -1; display: flex; align-items: center; gap: 10px; margin: 14px 0 4px;
    scroll-margin-top: calc(var(--cx-bar) + 8px); font: 600 12px system-ui, sans-serif; letter-spacing: .04em; color: #9a9aa6;
  }
  .cx-pmark::before, .cx-pmark::after { content: ''; flex: 1; height: 1px; background: rgba(255, 255, 255, .14); }
  .cx-pmark.cx-first { margin: 0; height: 0; overflow: hidden; }

  /* top bar */
  #cx-bar {
    position: fixed; top: 0; left: 0; right: 0; z-index: 2147483000; height: var(--cx-bar);
    display: flex; align-items: stretch; gap: 4px; padding: 6px 8px; box-sizing: border-box;
    background: rgba(14, 14, 18, .94); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    border-bottom: 1px solid rgba(255, 255, 255, .08);
  }
  #cx-tabs { flex: 1 1 0; min-width: 0; display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; }
  #cx-tabs::-webkit-scrollbar { display: none; }
  #cx-bar button {
    border: 0; border-radius: 8px; background: transparent; color: #cfcfd6;
    font: 600 14px system-ui, sans-serif; cursor: pointer; white-space: nowrap;
  }
  #cx-tabs button { flex: 1 0 auto; padding: 0 10px; }
  #cx-bar button.is-on { background: rgba(255, 255, 255, .12); color: #fff; }
  #cx-bar .cx-icon {
    flex: 0 0 36px; width: 36px; min-width: 36px; max-width: 36px; box-sizing: border-box;
    display: flex; align-items: center; justify-content: center; padding: 0 !important; margin: 0;
  }
  #cx-bar .cx-icon svg { width: 20px; height: 20px; flex: none; }
  /* the site's own dialogs open at the top; let them cover our UI */
  html.cx-on body:has(.settings-dialog) #cx-bar,
  html.cx-on body:has(.settings-dialog) #cx-pagebox { z-index: 100; }

  /* popover panels (settings, presets) */
  .cx-panel {
    position: fixed; top: calc(var(--cx-bar) + 6px); right: 8px; z-index: 2147483001;
    width: min(320px, calc(100vw - 16px)); max-height: calc(100vh - var(--cx-bar) - 20px); overflow-y: auto;
    box-sizing: border-box; padding: 12px 14px;
    background: #1b1b22; color: #e6e6ec; border: 1px solid rgba(255, 255, 255, .12); border-radius: 12px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, .5); font: 14px system-ui, sans-serif;
  }
  .cx-panel[hidden] { display: none; }
  .cx-panel h3 { margin: 12px 0 6px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; opacity: .65; }
  .cx-panel h3:first-child { margin-top: 0; }
  .cx-panel p { margin: 6px 0 0; font-size: 12px; opacity: .6; }
  .cx-row { display: flex; align-items: center; gap: 8px; padding: 5px 0; }
  .cx-row label { flex: 1; display: flex; align-items: center; gap: 10px; min-width: 0; cursor: pointer; }
  .cx-row input[type=checkbox] { width: 18px; height: 18px; margin: 0; flex: none; accent-color: #8b7cff; }
  .cx-mini {
    flex: none; width: 30px; height: 30px; padding: 0; border: 1px solid rgba(255, 255, 255, .14); border-radius: 8px;
    background: rgba(255, 255, 255, .05); color: inherit; font: 14px system-ui, sans-serif;
  }
  .cx-mini:disabled { opacity: .3; }
  .cx-wide {
    display: block; width: 100%; margin-top: 6px; padding: 10px; box-sizing: border-box;
    border: 1px solid rgba(255, 255, 255, .14); border-radius: 8px;
    background: rgba(255, 255, 255, .06); color: inherit; font: inherit; text-align: left;
  }
  .cx-preset { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left;
    padding: 9px 10px; border: 1px solid rgba(255, 255, 255, .14); border-radius: 8px; background: rgba(255, 255, 255, .05); color: inherit; font: inherit; }
  .cx-preset.is-on { border-color: #8b7cff; }
  .cx-save { display: flex; gap: 6px; margin-top: 8px; }
  .cx-save input { flex: 1; min-width: 0; padding: 9px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, .18); background: #111116; color: #fff; font: inherit; }
  .cx-save button { padding: 9px 14px; border: 0; border-radius: 8px; background: #8b7cff; color: #fff; font: inherit; }

  /* page badge + go-to box, bottom left */
  #cx-pagebox { position: fixed; left: 10px; bottom: 12px; z-index: 2147483000; font: 600 13px system-ui, sans-serif; }
  #cx-pagebox[hidden] { display: none; }
  #cx-pagebtn {
    border: 1px solid rgba(255, 255, 255, .14); border-radius: 999px; padding: 8px 14px;
    background: rgba(20, 20, 26, .92); color: #e6e6ec; font: inherit; box-shadow: 0 4px 14px rgba(0, 0, 0, .4);
  }
  #cx-goto {
    position: absolute; left: 0; bottom: calc(100% + 8px); display: flex; gap: 6px; padding: 8px;
    background: #1b1b22; border: 1px solid rgba(255, 255, 255, .12); border-radius: 12px; box-shadow: 0 12px 32px rgba(0, 0, 0, .5);
  }
  #cx-goto[hidden] { display: none; }
  #cx-goto input { width: 72px; padding: 8px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, .18); background: #111116; color: #fff; font: inherit; }
  #cx-goto button { padding: 8px 14px; border: 0; border-radius: 8px; background: #8b7cff; color: #fff; font: inherit; }
  `;
  const style = document.createElement('style');
  style.id = 'cx-style';
  style.textContent = css;
  (document.head || root).appendChild(style);

  // ---------- helpers ----------
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
  const ICON_COG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
  const ICON_STAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 2.8l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.6l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z"/></svg>';

  // The page may scroll the window or (on some mobile layouts) an inner element.
  // Track whichever one is actually scrolling and use it everywhere.
  let scroller = null; // null = window
  const getY = () => (scroller ? scroller.scrollTop : window.scrollY);
  const setY = (y) => { if (scroller) scroller.scrollTop = y; else window.scrollTo(0, y); };

  // ---------- site lookups (re-queried each time; React may replace nodes) ----------
  const mainCol = () => $('main.layout .main-col');
  const sectionTitled = (text) => $$('section.section').find((s) => $('h2', s)?.textContent.trim().startsWith(text));
  const latestSec = () => $('.grid-updates')?.closest('section') || sectionTitled('Latest Updates');
  const viewEl = (v) => {
    if (isLatest(v)) return latestSec();
    if (v === 'announce') return $('.main-col > .announce') || $('aside.announce');
    const t = tabOf(v);
    return t?.title ? sectionTitled(t.title) : null;
  };
  const browsePage = () => +($('.npager__num.is-active')?.textContent || new URL(location.href).searchParams.get('page') || 1);

  // Where the endless feed reads its pages from.
  const SOURCES = {
    home: {
      grid: () => $('.grid-updates', latestSec() || document),
      items: (g) => $$('a.card', g),
      next: () => $$('.pager__btn', latestSec() || document).find((b) => /next/i.test(b.textContent + b.getAttribute('aria-label'))),
      active: () => isLatest(view),
      watch: () => mainCol(),
    },
    browse: {
      // our feed copies the site's grid class, so skip it
      grid: () => $$('.list-wrap [class*="list-grid"]').find((g) => !g.closest('#cx-feed')),
      items: (g) => [...g.children],
      next: () => $('.list-wrap .npager__nav[aria-label="Next page"]'),
      active: () => true,
      watch: () => $('main') || document.body,
    },
  };
  const src = SOURCES[page()];
  const itemKey = (it) => (it.matches('a[href]') ? it : $('a[href^="/title/"]', it))?.getAttribute('href') || null;

  // ---------- state ----------
  let view = page() === 'browse' ? 'browse' : load(VIEW_KEY, null);
  if (page() === 'home' && !homeTabs().includes(view)) view = homeTabs()[0] || 'hot';
  const seen = new Set();
  let loading = false;
  let pendingSig = null;
  let loadTimer = null;
  let pageNo = 0; // last page number added to the feed
  let targetPage = null; // go-to-page in progress (home)
  let feedClass = '';
  let feedWrap, feed, status, sentinel, bar, tabsEl, settings, presetsPanel, pageBox, pageBtn, gotoBox, gotoInput;

  const gridSig = () => {
    const g = src.grid();
    if (!g) return '';
    const keys = src.items(g).slice(0, 4).map(itemKey).filter(Boolean);
    return keys.length ? `${g.className}|${keys.join('|')}` : '';
  };
  const firstKey = (sig) => sig.split('|')[1];

  // ---------- top bar ----------
  function iconBtn(id, label, svg, onClick) {
    const b = el('button', { id, type: 'button', className: 'cx-icon', innerHTML: svg });
    b.setAttribute('aria-label', label);
    b.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
    return b;
  }

  function closePanels(except) {
    for (const p of [settings, presetsPanel]) if (p && p !== except) p.hidden = true;
  }

  function buildBar() {
    bar = el('nav', { id: 'cx-bar' });
    tabsEl = el('div', { id: 'cx-tabs' });
    bar.append(tabsEl);
    if (page() === 'browse') {
      bar.append(iconBtn('cx-star', 'Filter presets', ICON_STAR, () => { closePanels(presetsPanel); renderPresets(); presetsPanel.hidden = !presetsPanel.hidden; }));
    }
    bar.append(iconBtn('cx-cog', 'Settings', ICON_COG, () => { closePanels(settings); renderSettings(); settings.hidden = !settings.hidden; }));
    document.body.appendChild(bar);
    renderTabs();

    settings = el('div', { id: 'cx-settings', className: 'cx-panel', hidden: true });
    document.body.appendChild(settings);
    if (page() === 'browse') {
      presetsPanel = el('div', { id: 'cx-presets', className: 'cx-panel', hidden: true });
      document.body.appendChild(presetsPanel);
    }
    for (const p of [settings, presetsPanel]) p?.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', () => closePanels(null));
  }

  function renderTabs() {
    tabsEl.textContent = '';
    for (const k of barTabs()) {
      const b = el('button', { type: 'button', textContent: tabOf(k).label });
      b.dataset.view = k;
      b.classList.toggle('is-on', k === view);
      b.addEventListener('click', () => onTab(k));
      tabsEl.appendChild(b);
    }
    $('button.is-on', tabsEl)?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }

  function onTab(key) {
    if (key === view) { setY(0); return; }
    if (key === 'browse') { location.href = '/browse'; return; }
    if (page() !== 'home') { save(VIEW_KEY, key); location.href = '/'; return; }
    setView(key);
  }

  // ---------- settings panel ----------
  function renderSettings() {
    settings.textContent = '';
    // Shown tabs in bar order (arrows reorder), then hidden ones (tick to add at the end).
    settings.append(el('h3', { textContent: 'Shown tabs (arrows set the order)' }));
    enabled.forEach((k, i) => {
      const box = el('input', { type: 'checkbox', checked: true });
      box.addEventListener('change', () => {
        if (enabled.length === 1) { box.checked = true; return; } // keep at least one tab
        enabled = enabled.filter((x) => x !== k);
        tabsChanged();
      });
      const up = el('button', { type: 'button', className: 'cx-mini', textContent: '▲', disabled: i === 0 });
      const down = el('button', { type: 'button', className: 'cx-mini', textContent: '▼', disabled: i === enabled.length - 1 });
      up.setAttribute('aria-label', 'Move left');
      down.setAttribute('aria-label', 'Move right');
      up.addEventListener('click', () => moveTab(i, -1));
      down.addEventListener('click', () => moveTab(i, 1));
      settings.append(el('div', { className: 'cx-row' }, el('label', {}, box, tabOf(k).name), up, down));
    });
    const hidden = ALL_KEYS.filter((k) => !enabled.includes(k));
    if (hidden.length) settings.append(el('h3', { textContent: 'Hidden tabs' }));
    for (const k of hidden) {
      const box = el('input', { type: 'checkbox', checked: false });
      box.addEventListener('change', () => {
        enabled = [...enabled, k];
        tabsChanged();
      });
      settings.append(el('div', { className: 'cx-row' }, el('label', {}, box, tabOf(k).name)));
    }
    settings.append(el('p', { textContent: 'Signed-in sections (Followed, History, For you) are empty when logged out. Each tab keeps the site’s own ⋮ menu.' }));

    settings.append(el('h3', { textContent: 'Account' }));
    const login = $('header.topnav .login-btn');
    const account = $('header.topnav .usermenu__btn') || $('header.topnav button[aria-label="Account menu"]');
    const accBtn = el('button', { type: 'button', className: 'cx-wide', textContent: login ? 'Log in' : account ? 'Account menu' : 'Log in / account (not found)' });
    accBtn.addEventListener('click', () => {
      const target = $('header.topnav .login-btn') || $('header.topnav .usermenu__btn') || $('header.topnav button[aria-label="Account menu"]');
      if (!target) return;
      settings.hidden = true;
      peekHeader();
      // Wait a frame so the revealed header has a real position, then tap it.
      requestAnimationFrame(() => tap(target));
    });
    const hdrBox = el('input', { type: 'checkbox', checked: root.classList.contains('cx-showhdr') });
    hdrBox.addEventListener('change', () => {
      root.classList.toggle('cx-showhdr', hdrBox.checked);
      save(HEADER_KEY, hdrBox.checked);
    });
    settings.append(accBtn, el('div', { className: 'cx-row' }, el('label', {}, hdrBox, 'Always show the site’s header (search, notifications, account)')));

    settings.append(el('h3', { textContent: 'Site' }));
    const siteBtn = el('button', { type: 'button', className: 'cx-wide', textContent: 'Theme, content filter & preferences…' });
    siteBtn.addEventListener('click', () => {
      settings.hidden = true;
      const native = $('header.topnav button[aria-label="Settings"]');
      if (native) native.click();
    });
    settings.append(siteBtn);
  }

  function moveTab(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= enabled.length) return;
    enabled = enabled.slice();
    [enabled[i], enabled[j]] = [enabled[j], enabled[i]];
    tabsChanged();
  }

  function tabsChanged() {
    save(TABS_KEY, enabled);
    renderTabs();
    renderSettings();
    if (page() === 'home' && !homeTabs().includes(view) && homeTabs().length) setView(homeTabs()[0]);
  }

  // A full tap: menus often open on pointerdown/mousedown, which .click() alone skips.
  function tap(target) {
    const r = target.getBoundingClientRect();
    const at = { bubbles: true, cancelable: true, composed: true, view: window, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0 };
    const P = window.PointerEvent || MouseEvent;
    target.dispatchEvent(new P('pointerdown', { ...at, pointerId: 1, pointerType: 'touch', isPrimary: true, buttons: 1 }));
    target.dispatchEvent(new MouseEvent('mousedown', { ...at, buttons: 1 }));
    target.dispatchEvent(new P('pointerup', { ...at, pointerId: 1, pointerType: 'touch', isPrimary: true }));
    target.dispatchEvent(new MouseEvent('mouseup', at));
    target.click();
  }

  // Show the hidden site header until the next tap outside it, so its login /
  // account menu can open (and can be tapped by hand if it doesn't).
  function peekHeader() {
    root.classList.add('cx-peek');
    setTimeout(() => {
      const off = (e) => {
        if (e.target.closest?.('header.topnav')) return;
        root.classList.remove('cx-peek');
        document.removeEventListener('click', off, true);
      };
      document.addEventListener('click', off, true);
    }, 300);
  }

  // ---------- browse presets ----------
  const presetQuery = () => {
    const u = new URL(location.href);
    u.searchParams.delete('page');
    return u.searchParams.toString();
  };

  function renderPresets() {
    const presets = load(PRESETS_KEY, []);
    const cur = presetQuery();
    presetsPanel.textContent = '';
    presetsPanel.append(el('h3', { textContent: 'Filter presets' }));
    if (!presets.length) presetsPanel.append(el('p', { textContent: 'No presets yet. Set up the filters, then save them below.' }));
    presets.forEach((p, i) => {
      const go = el('button', { type: 'button', className: 'cx-preset', textContent: p.name });
      go.classList.toggle('is-on', p.query === cur);
      go.addEventListener('click', () => location.assign('/browse' + (p.query ? '?' + p.query : '')));
      const del = el('button', { type: 'button', className: 'cx-mini', textContent: '✕' });
      del.setAttribute('aria-label', `Delete ${p.name}`);
      del.addEventListener('click', () => {
        const list = load(PRESETS_KEY, []);
        list.splice(i, 1);
        save(PRESETS_KEY, list);
        renderPresets();
      });
      presetsPanel.append(el('div', { className: 'cx-row' }, go, del));
    });
    const name = el('input', { type: 'text', placeholder: 'Preset name', maxLength: 40 });
    const form = el('form', { className: 'cx-save' }, name, el('button', { type: 'submit', textContent: 'Save' }));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const n = name.value.trim();
      if (!n) { name.focus(); return; }
      const list = load(PRESETS_KEY, []).filter((p) => p.name !== n); // same name overwrites
      list.push({ name: n, query: presetQuery() });
      save(PRESETS_KEY, list);
      renderPresets();
    });
    presetsPanel.append(el('h3', { textContent: 'Save current filters' }), form);
  }

  // ---------- home views ----------
  function markActive() {
    if (page() !== 'home') return;
    const want = viewEl(view);
    for (const e of $$('.main-col > *')) {
      if (!e.classList.contains('cx-keep')) e.classList.toggle('cx-active', e === want);
    }
    for (const b of $$('button', tabsEl)) b.classList.toggle('is-on', b.dataset.view === view);
    root.dataset.cxView = isLatest(view) ? 'latest' : view;
    updateBadge();
  }

  function setView(v) {
    view = v;
    save(VIEW_KEY, v);
    markActive();
    setY(0);
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

  // ---------- endless feed (home Latest Updates and Browse) ----------
  function buildFeed() {
    feedWrap = el(page() === 'home' ? 'div' : 'section', { className: 'cx-keep' });
    feed = el('div', { id: 'cx-feed', className: page() === 'home' ? 'cx-home' : '' });
    status = el('div', { id: 'cx-status' });
    sentinel = el('div', { id: 'cx-sentinel' });
    sentinel.style.height = '1px';
    feedWrap.append(feed, status, sentinel);
    attachFeed();
    new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) loadMore();
    }, { rootMargin: '1500px 0px' }).observe(sentinel);
  }

  function attachFeed() {
    if (feedWrap.isConnected) return;
    if (page() === 'home') { mainCol()?.appendChild(feedWrap); return; }
    // Browse: right after the site's results block, before its pager.
    const pager = $('.list-wrap > .npager');
    if (pager) pager.before(feedWrap);
    else ($('.list-wrap') || $('main'))?.appendChild(feedWrap);
  }

  function resetFeed() {
    seen.clear();
    feed.textContent = '';
    status.textContent = '';
    loading = false;
    pendingSig = null;
    clearTimeout(loadTimer);
    holdY = null;
    pageNo = 0;
    targetPage = null;
    root.classList.remove('cx-bfeed-on');
  }

  function harvest() {
    const grid = src.grid();
    if (!grid) return 0;
    if (page() === 'browse') {
      // Copy the site's grid/list classes so the feed looks the same; a view switch restarts it.
      if (feedClass && feedClass !== grid.className) resetFeed();
      feedClass = grid.className;
      feed.className = grid.className;
    }
    const num = page() === 'browse' ? browsePage() : pageNo + 1;
    if ($(`.cx-pmark[data-page="${num}"]`, feed)) return 0; // already have this page
    pageNo = num;
    const mark = el('div', { className: 'cx-pmark', textContent: `Page ${num}` });
    mark.dataset.page = num;
    if (!feed.firstChild) mark.classList.add('cx-first');
    feed.appendChild(mark);
    let added = 0;
    for (const it of src.items(grid)) {
      const key = itemKey(it);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const c = it.cloneNode(true);
      $$('.card__menu', c).forEach((m) => m.remove()); // its "add to library" handler doesn't survive cloning
      for (const a of c.matches('a') ? [c] : $$('a[href^="/title/"]', c)) { a.target = '_blank'; a.rel = 'noopener'; }
      feed.appendChild(c);
      added++;
    }
    if (page() === 'browse') root.classList.add('cx-bfeed-on');
    return added;
  }

  function sentinelNear() {
    return sentinel.getBoundingClientRect().top < innerHeight + 1500;
  }

  function loadMore() {
    if (!src.active() || loading || !feed) return;
    const btn = src.next();
    if (!btn || btn.disabled || btn.getAttribute('aria-disabled') === 'true') {
      status.textContent = seen.size ? `End of list (last page ${pageNo})` : '';
      if (targetPage) finishJump(pageNo);
      return;
    }
    loading = true;
    pendingSig = gridSig();
    status.textContent = targetPage ? `Loading page ${pageNo + 1} of ${targetPage}…` : 'Loading…';
    holdScroll();
    btn.click();
    clearTimeout(loadTimer);
    loadTimer = setTimeout(() => { // give up on this attempt; the next scroll retries
      loading = false;
      targetPage = null;
      releaseScroll(0);
      status.textContent = 'Couldn’t load more. Scroll to retry.';
    }, 12000);
  }

  // After Next, the site scrolls back up (to the top of our page).
  // While a page loads, undo any big upward jump; normal scrolling down is allowed.
  let holdY = null;
  let releaseTimer;
  function holdScroll() {
    clearTimeout(releaseTimer);
    holdY = getY();
  }
  function releaseScroll(delay) {
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(() => { holdY = null; }, delay);
  }

  // React re-renders the site's list after Next, Hot/New, filters or a view switch.
  let debounce;
  function onSiteChange() {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      attachFeed();
      markActive();
      const sig = gridSig();
      if (!sig) return; // still loading / skeleton / empty
      if (loading) {
        if (sig === pendingSig) return;
        loading = false;
        clearTimeout(loadTimer);
        status.textContent = '';
        harvest();
        if (holdY !== null) setY(holdY);
        if (targetPage) {
          if (pageNo >= targetPage) finishJump(targetPage);
          else setTimeout(loadMore, 300); // one page at a time, gently
        } else {
          releaseScroll(800); // the site may scroll a moment after rendering
          if (sentinelNear()) loadMore();
        }
        updateBadge();
      } else if (!seen.has(firstKey(sig))) {
        // A list we didn't ask for (filters, Hot/New, view switch): start over.
        resetFeed();
        harvest();
        if (sentinelNear()) loadMore();
        updateBadge();
      }
    }, 120);
  }

  // ---------- page badge + go to page (bottom left) ----------
  function currentPage() {
    const marks = feed ? $$('.cx-pmark', feed) : [];
    if (!marks.length) return page() === 'browse' ? browsePage() : 1;
    let p = +marks[0].dataset.page;
    for (const m of marks) {
      if (m.getBoundingClientRect().top <= innerHeight * 0.35) p = +m.dataset.page;
      else break;
    }
    return p;
  }

  function updateBadge() {
    if (!pageBtn) return;
    const text = `Page ${currentPage()}`;
    if (pageBtn.textContent !== text) pageBtn.textContent = text;
    const hide = page() === 'home' && !isLatest(view);
    if (pageBox.hidden !== hide) pageBox.hidden = hide;
  }

  function buildPageBox() {
    pageBtn = el('button', { id: 'cx-pagebtn', type: 'button' });
    gotoInput = el('input', { type: 'number', min: '1', inputMode: 'numeric', placeholder: 'Page' });
    gotoBox = el('form', { id: 'cx-goto', hidden: true }, gotoInput, el('button', { type: 'submit', textContent: 'Go' }));
    pageBox = el('div', { id: 'cx-pagebox' }, gotoBox, pageBtn);
    document.body.appendChild(pageBox);

    pageBtn.addEventListener('click', () => {
      gotoBox.hidden = !gotoBox.hidden;
      if (!gotoBox.hidden) { gotoInput.value = ''; gotoInput.placeholder = String(currentPage()); gotoInput.focus(); }
    });
    gotoBox.addEventListener('submit', (e) => {
      e.preventDefault();
      const n = Math.floor(+gotoInput.value);
      if (n >= 1) { gotoBox.hidden = true; gotoInput.blur(); goToPage(n); }
    });
    pageBox.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', () => { gotoBox.hidden = true; });
    updateBadge();
  }

  function goToPage(n) {
    const mark = feed && $(`.cx-pmark[data-page="${n}"]`, feed);
    if (mark) { scrollToMark(mark); return; }
    if (page() === 'browse') { // browse opens on ?page=N and keeps the filters
      const u = new URL(location.href);
      u.searchParams.set('page', n);
      location.assign(u);
      return;
    }
    if (!isLatest(view)) return;
    if (n <= pageNo) return;
    // Not loaded yet: page forward with the site's Next button until we get there.
    targetPage = n;
    if (!loading) loadMore();
    else status.textContent = `Loading page ${pageNo + 1} of ${targetPage}…`;
  }

  function scrollToMark(mark) {
    clearTimeout(releaseTimer);
    holdY = null;
    mark.scrollIntoView({ block: 'start' });
    setTimeout(updateBadge, 50);
  }

  function finishJump(n) {
    targetPage = null;
    status.textContent = '';
    const mark = $(`.cx-pmark[data-page="${n}"]`, feed);
    if (mark) scrollToMark(mark);
    updateBadge();
  }

  // ---------- scrolling (window or inner element) ----------
  let ticking = false;
  document.addEventListener('scroll', (e) => {
    const t = e.target;
    if (t === document || t === document.documentElement || t === document.body) scroller = null;
    else if (t instanceof Element && (t.contains(feedWrap) || t.contains(mainCol()) || t.contains($('main')))) scroller = t;
    else return; // a carousel, our tab strip, a dropdown…

    if (holdY !== null) {
      const y = getY();
      if (y > holdY) holdY = y;
      else if (holdY - y > 150) setY(holdY);
    }
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(() => { ticking = false; updateBadge(); });
    }
  }, { capture: true, passive: true });

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
    if (page() === 'browse') return !!$('.list-wrap');
    return !!(mainCol() && SOURCES.home.grid() && viewEl('popular'));
  }

  function start() {
    buildBar();
    buildFeed();
    buildPageBox();
    markActive();
    new MutationObserver(onSiteChange).observe(src.watch(), { childList: true, subtree: true });
    if (page() === 'home' && isLatest(view)) selectLatestTab(view);
    harvest();
    if (sentinelNear()) loadMore();
    updateBadge();
    // If the SPA leaves home/browse, get out of the way.
    const here = page();
    setInterval(() => root.classList.toggle('cx-on', page() === here), 1000);
  }

  let bootTimer;
  const boot = new MutationObserver(() => {
    if (ready()) { boot.disconnect(); clearTimeout(bootTimer); start(); }
  });
  const begin = () => {
    if (ready()) { start(); return; }
    boot.observe(document.documentElement, { childList: true, subtree: true });
    // Browse with no results never gets a list; start anyway so the bar is there.
    if (page() === 'browse') bootTimer = setTimeout(() => { boot.disconnect(); if (!bar) start(); }, 8000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', begin);
  else begin();
})();
