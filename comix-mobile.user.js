// ==UserScript==
// @name         Comix Mobile Feed
// @namespace    comix-android-ui
// @version      0.9.7
// @description  Sticky tab bar with configurable, reorderable home sections, 3-column grid, endless Latest Updates and Browse, page jump, browse presets.
// @match        https://comix.to/*
// @run-at       document-start
// @grant        none
// @inject-into  page
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
  const PROGRESS_KEY = 'cx-read-progress'; // { "/title/…": { r: read, t: total, at } } from Reading History
  const SHOW_PROGRESS_KEY = 'cx-mobile-progress';
  const OVERLAY_KEY = 'cx-mobile-overlay'; // titles drawn on the cover instead of under it
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

  // The site is a single-page app: clicking the logo on a title page switches to the home page
  // without loading it, so the script never got to start there. Watch the address on every
  // comix.to page, and reload once when the site switches into home or Browse that way.
  {
    let lastPath = location.pathname;
    const check = () => {
      const path = location.pathname;
      if (path === lastPath) return;
      lastPath = path;
      if (page()) location.reload();
    };
    for (const name of ['pushState', 'replaceState']) {
      const orig = history[name];
      history[name] = function (...args) { const r = orig.apply(this, args); check(); return r; };
    }
    window.addEventListener('popstate', check);
    setInterval(check, 500);
  }

  if (!page()) return;

  // Only one copy per page. With the script installed in two managers (e.g. Tampermonkey
  // and Violentmonkey), each copy treated the other's page loads as a restart and wiped its list.
  // The mark lives on the DOM, which both managers share.
  if (document.documentElement.hasAttribute('data-cx-loaded')) return;
  document.documentElement.setAttribute('data-cx-loaded', '');

  const load = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch (_) { return fallback; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };

  let enabled = [...new Set(load(TABS_KEY, DEFAULT_TABS))].filter((k) => ALL_KEYS.includes(k));
  if (!enabled.length) enabled = DEFAULT_TABS.slice();
  const barTabs = () => enabled;
  const homeTabs = () => barTabs().filter((k) => k !== 'browse');

  // Latest Updates starts on the URL's ?page=N (the site renders that page itself), so a
  // link or reload to ?page=4 opens the feed at page 4. The page before it is one tap away.
  const startPage = () => Math.max(1, Math.floor(+(new URL(location.href).searchParams.get('page') || 1)) || 1);

  const root = document.documentElement;
  root.classList.add('cx-on');
  root.classList.toggle('cx-showhdr', !!load(HEADER_KEY, false));
  root.classList.toggle('cx-overlay', load(OVERLAY_KEY, true));
  root.dataset.cxPage = page();

  // ---------- styles ----------
  const css = `
  html.cx-on { --cx-bar: 48px; scroll-behavior: auto !important; }
  /* No scroll anchoring: at the bottom the browser anchored to the "Loading…" line and dragged
     the view down with every new page, which loaded the next page, and so on. */
  html.cx-on, html.cx-on body, #cx-status, #cx-sentinel { overflow-anchor: none !important; }
  html.cx-on body { padding-top: var(--cx-bar) !important; }
  html.cx-on footer.footer { display: none !important; }
  html.cx-on:not(.cx-showhdr) header.topnav { display: none !important; }
  /* site header (log in, account, notifications, search), when shown, is pinned right under our bar */
  html.cx-on.cx-showhdr header.topnav {
    position: fixed !important; top: var(--cx-bar) !important; left: 0 !important; right: 0 !important;
    z-index: 2147482990 !important; transform: none !important;
  }
  html.cx-on.cx-showhdr body { padding-top: calc(var(--cx-bar) + var(--cx-hdr, 64px)) !important; }
  /* Top / Up / Down buttons, bottom right; hold Up/Down to keep scrolling */
  #cx-nav { position: fixed; right: 10px; bottom: 12px; z-index: 2147483000; display: flex; flex-direction: column; gap: 8px; }
  #cx-nav button {
    width: 44px; height: 44px; padding: 0; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    border: 1px solid rgba(255, 255, 255, .14); background: rgba(20, 20, 26, .88); color: #e6e6ec;
    font: 600 16px system-ui, sans-serif; box-shadow: 0 4px 14px rgba(0, 0, 0, .4);
    touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
  }
  #cx-nav button:active, #cx-nav button.is-held { background: rgba(139, 124, 255, .55); }
  #cx-debug {
    position: fixed; right: 64px; bottom: 12px; z-index: 2147483000; max-width: 62vw; padding: 6px 8px;
    background: rgba(0, 0, 0, .82); color: #8f8; font: 11px/1.35 ui-monospace, monospace; border-radius: 8px;
    white-space: pre-wrap; pointer-events: none;
  }

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

  /* Browse: 3 per row in grid view (the site's own numbered pager stays) */
  html.cx-on[data-cx-page="browse"] .list-grid--cards { display: grid !important; grid-template-columns: repeat(${COLS}, minmax(0, 1fr)) !important; gap: 10px 8px !important; }
  #cx-feed .card__menu { display: none !important; }

  /* reading progress ("read / latest") in place of "Ch.X" for titles in your Reading History.
     The site's text stays in place (hidden); the label is drawn from an attribute, so the
     site's own page code never sees its card changed. */
  .card__ch[data-cx-read] { font-size: 0 !important; }
  /* drawn as a pill: purple with an eye while behind, green with a check once caught up */
  .card__ch[data-cx-read]::before {
    content: attr(data-cx-read); display: inline-block; font-size: 12px; line-height: 1.5; font-weight: 800;
    padding: 1px 7px 1px 20px; border-radius: 999px; color: #5ee08f;
    background: rgba(46, 204, 113, .18) no-repeat 5px center / 12px url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235ee08f' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 12.5l5 5L20 6.5'/%3E%3C/svg%3E");
    box-shadow: inset 0 0 0 1px rgba(94, 224, 143, .55);
  }
  .card__ch[data-cx-read].cx-new::before {
    color: #fff; box-shadow: 0 0 8px rgba(139, 124, 255, .7);
    background: #7c6cff no-repeat 5px center / 12px url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z'/%3E%3Ccircle cx='12' cy='12' r='3'/%3E%3C/svg%3E");
  }
  /* whole card: started but behind = outlined cover; read up to the latest = dimmed
     (cover and title only, so the green label stays readable) */
  a.card[data-cx-state="behind"] .card__poster-wrap {
    outline: 3px solid #8b7cff; outline-offset: 2px; border-radius: 8px; box-shadow: 0 0 14px 2px rgba(139, 124, 255, .55);
  }
  a.card[data-cx-state="caught"] .card__poster-wrap, a.card[data-cx-state="caught"] .card__title { opacity: .45; filter: grayscale(.6); }
  a.card[data-cx-state="caught"]:hover .card__poster-wrap, a.card[data-cx-state="caught"]:focus-visible .card__poster-wrap,
  a.card[data-cx-state="caught"]:hover .card__title, a.card[data-cx-state="caught"]:focus-visible .card__title { opacity: .85; }

  /* long-press a card -> the site's own "Add to library" menu (placed at your finger) */
  html.cx-on main a.card { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
  .card__menu-pop { z-index: 2147483002 !important; }
  #cx-ltitle {
    position: fixed; z-index: 2147483002; box-sizing: border-box; padding: 8px 11px; border-radius: 10px;
    background: rgba(20, 20, 26, .97); color: #f2f2f6; border: 1px solid rgba(139, 124, 255, .45);
    font: 600 13.5px/1.3 system-ui, sans-serif; box-shadow: 0 8px 24px rgba(0, 0, 0, .5); pointer-events: none; overflow-wrap: anywhere;
  }
  #cx-toast {
    position: fixed; left: 50%; bottom: 70px; transform: translateX(-50%); z-index: 2147483002; max-width: calc(100vw - 32px);
    padding: 10px 14px; border-radius: 10px; background: rgba(20, 20, 26, .95); color: #e6e6ec;
    font: 13px system-ui, sans-serif; box-shadow: 0 8px 24px rgba(0, 0, 0, .5); pointer-events: none;
  }

  /* compact cards for 3 columns */
  html.cx-on .cx-active a.card, #cx-feed a.card, .list-grid--cards a.card { min-width: 0; }
  html.cx-on .cx-active .card__title, #cx-feed .card__title, .list-grid--cards .card__title { font-size: 12px !important; line-height: 1.25 !important; }
  html.cx-on .cx-active .card__meta, #cx-feed .card__meta, .list-grid--cards .card__meta { font-size: 10.5px !important; gap: 4px !important; }

  /* title on the bottom of the cover, leaving only chapter + time under it. The card becomes a
     one-column grid and the boxes around the title are flattened (display: contents), so the
     title can share the cover's cell without depending on how deep the site nests it. */
  html.cx-on.cx-overlay a.card { display: grid !important; grid-template-columns: minmax(0, 1fr); align-content: start; }
  html.cx-on.cx-overlay a.card :is(*:has(.card__title)):not(.card__poster-wrap) { display: contents !important; }
  html.cx-on.cx-overlay a.card .card__poster-wrap { grid-row: 1; grid-column: 1; }
  html.cx-on.cx-overlay a.card .card__title {
    grid-row: 1; grid-column: 1; align-self: end; z-index: 1; position: relative; margin: 0 !important;
    padding: 16px 5px 4px !important; border-radius: 0 0 8px 8px; pointer-events: none;
    background: linear-gradient(to top, rgba(0, 0, 0, .88), rgba(0, 0, 0, .55) 60%, transparent);
    color: #fff !important; font-size: 11px !important; line-height: 1.2 !important; font-weight: 600;
    text-shadow: 0 1px 2px rgba(0, 0, 0, .9);
    display: -webkit-box !important; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; white-space: normal !important;
  }
  html.cx-on.cx-overlay a.card .card__meta { grid-column: 1; margin-top: 3px !important; }

  #cx-status { text-align: center; padding: 18px 0 28px; font: 13px system-ui, sans-serif; opacity: .65; }

  /* page separators in the feed */
  .cx-pmark {
    grid-column: 1 / -1; display: flex; align-items: center; gap: 10px; margin: 14px 0 4px;
    scroll-margin-top: calc(var(--cx-bar) + 8px); font: 600 12px system-ui, sans-serif; letter-spacing: .04em; color: #9a9aa6;
  }
  .cx-pmark::before, .cx-pmark::after { content: ''; flex: 1; height: 1px; background: rgba(255, 255, 255, .14); }
  .cx-pmark.cx-first { margin: 0; height: 0; overflow: hidden; }
  .cx-earlier-row { grid-column: 1 / -1; display: flex; gap: 8px; margin: 2px 0 0; }
  .cx-earlier-row button[hidden] { display: none; }
  .cx-restart {
    padding: 9px 12px; border-radius: 10px; cursor: pointer; border: 1px solid rgba(255, 255, 255, .16);
    background: transparent; color: #9a9aa6; font: 600 13px system-ui, sans-serif;
  }
  .cx-earlier {
    flex: 1; padding: 9px 12px; border-radius: 10px; cursor: pointer;
    border: 1px dashed rgba(139, 124, 255, .6); background: rgba(139, 124, 255, .12); color: #c9c0ff;
    font: 600 13px system-ui, sans-serif;
  }

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
  /* the site's own dialogs (settings, sign-in at z-index 200) cover the whole screen; drop our UI below them */
  html.cx-on body:has(> .settings-dialog, > .auth) #cx-bar,
  html.cx-on body:has(> .settings-dialog, > .auth) #cx-pagebox,
  html.cx-on body:has(> .settings-dialog, > .auth) #cx-debug,
  html.cx-on body:has(> .settings-dialog, > .auth) #cx-nav,
  html.cx-on body:has(> .settings-dialog, > .auth) .cx-panel { z-index: 100 !important; }
  html.cx-on.cx-showhdr body:has(> .settings-dialog, > .auth) header.topnav { z-index: 100 !important; }

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

  // After it renders a new Latest Updates page, the site calls
  // window.scrollTo({ top: <its section>, behavior: 'smooth' }), yanking you back up the list.
  // Ignore the site's own scroll calls for a moment around each page we load; our own
  // scrolling uses the untouched originals, and finger/wheel scrolling never goes through these.
  const nativeScrollTo = window.scrollTo.bind(window);
  let muteSiteScrollUntil = 0;
  const muteSiteScroll = (ms) => { muteSiteScrollUntil = Math.max(muteSiteScrollUntil, Date.now() + ms); };
  for (const name of ['scrollTo', 'scroll']) {
    const orig = window[name].bind(window);
    window[name] = function (...args) {
      if (Date.now() < muteSiteScrollUntil) return;
      return orig(...args);
    };
  }
  const setY = (y) => { if (scroller) scroller.scrollTop = y; else nativeScrollTo(0, y); };

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

  // Where the endless feed (home Hot/New only) reads its pages from.
  // Browse has no endless scroll: paging it in the background trips the site's tool detection.
  const src = {
    grid: () => $('.grid-updates', latestSec() || document),
    items: (g) => $$('a.card', g),
    next: () => $$('.pager__btn', latestSec() || document).find((b) => /next/i.test(b.textContent + b.getAttribute('aria-label'))),
    prev: () => $$('.pager__btn', latestSec() || document).find((b) => /prev/i.test(b.textContent + b.getAttribute('aria-label'))),
    active: () => isLatest(view),
    watch: () => mainCol(),
  };
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
  let earlierTarget = null; // loading an earlier page with the site's Previous button
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
    if (key === view) {
      // Hot/New scrolled or opened past page 1: start that list over, as a fresh visit would.
      if (page() === 'home' && isLatest(view) && feed && (firstPage() > 1 || pageNo > 1 || sitePage() > 1)) { openAtPage(1); return; }
      setY(0);
      return;
    }
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

    // Login, account menu, notifications and search live in the site's own header;
    // this shows it pinned under our bar so you can use them directly.
    settings.append(el('h3', { textContent: 'Account' }));
    const shown = root.classList.contains('cx-showhdr');
    const loggedOut = !!$('header.topnav .login-btn');
    const hdrBtn = el('button', {
      type: 'button',
      className: 'cx-wide',
      textContent: shown ? 'Hide the site header' : `Show the site header (${loggedOut ? 'Log in' : 'account'}, notifications, search)`,
    });
    hdrBtn.addEventListener('click', () => {
      setHeader(!root.classList.contains('cx-showhdr'));
      settings.hidden = true;
    });
    settings.append(hdrBtn, el('p', { textContent: 'The header appears just under this bar; tap Log in or your account icon there.' }));

    settings.append(el('h3', { textContent: 'Reading progress' }));
    const progBox = el('input', { type: 'checkbox', checked: showProgress });
    progBox.addEventListener('change', () => {
      showProgress = progBox.checked;
      save(SHOW_PROGRESS_KEY, showProgress);
      decorateProgress();
    });
    settings.append(
      el('div', { className: 'cx-row' }, el('label', {}, progBox, 'Show read / latest chapter on cards')),
      el('p', { textContent: `Learned from your Reading History while logged in (${Object.keys(progress).length} titles so far). Highlighted when there are new chapters.` }),
    );

    settings.append(el('h3', { textContent: 'Cards' }));
    const ovBox = el('input', { type: 'checkbox', checked: root.classList.contains('cx-overlay') });
    ovBox.addEventListener('change', () => {
      root.classList.toggle('cx-overlay', ovBox.checked);
      save(OVERLAY_KEY, ovBox.checked);
    });
    settings.append(el('div', { className: 'cx-row' }, el('label', {}, ovBox, 'Title on the cover (more compact)')));

    settings.append(el('h3', { textContent: 'Troubleshooting' }));
    const dbgBox = el('input', { type: 'checkbox', checked: !!debugEl });
    dbgBox.addEventListener('change', () => setDebug(dbgBox.checked));
    settings.append(el('div', { className: 'cx-row' }, el('label', {}, dbgBox, 'Show debug info (for page-number problems)')));

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

  function setHeader(on) {
    root.classList.toggle('cx-showhdr', on);
    save(HEADER_KEY, on);
    // Leave room for the header's real height once it's laid out.
    if (on) requestAnimationFrame(() => {
      const h = $('header.topnav')?.offsetHeight;
      if (h) root.style.setProperty('--cx-hdr', `${h}px`);
    });
  }

  // ---------- debug readout (bottom right) ----------
  // ---------- reading progress ----------
  // The Reading History rail (home, logged in) shows "read / total" per title. Remember it on
  // this device and show it on the same titles everywhere else, instead of "Ch.X".
  let progress = load(PROGRESS_KEY, {});
  let showProgress = load(SHOW_PROGRESS_KEY, true);
  const progressRe = /(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/;

  function collectHistory() {
    const sec = sectionTitled('Reading History');
    if (!sec) return;
    let changed = false;
    for (const a of $$('a.card', sec)) {
      const href = a.getAttribute('href');
      const m = $('.card__ch', a)?.textContent.match(progressRe);
      if (!href || !m) continue;
      const old = progress[href];
      if (!old || old.r !== +m[1] || old.t !== +m[2]) {
        progress[href] = { r: +m[1], t: +m[2], at: Date.now() };
        changed = true;
      }
    }
    if (!changed) return;
    const keys = Object.keys(progress);
    if (keys.length > 3000) { // keep the most recently seen
      keys.sort((a, b) => progress[a].at - progress[b].at).slice(0, keys.length - 3000).forEach((k) => delete progress[k]);
    }
    save(PROGRESS_KEY, progress);
  }

  function decorateProgress(scope = document) {
    for (const a of $$('main a.card', scope)) {
      const ch = $('.card__ch', a);
      if (!ch) continue;
      const text = ch.textContent;
      const p = showProgress && !progressRe.test(text) ? progress[a.getAttribute('href')] : null; // History cards already show it
      if (!p) {
        if (ch.hasAttribute('data-cx-read')) { ch.removeAttribute('data-cx-read'); ch.classList.remove('cx-new'); }
        if (a.hasAttribute('data-cx-state')) a.removeAttribute('data-cx-state');
        continue;
      }
      const latestM = text.match(/(\d+(?:\.\d+)?)/); // "Ch.1245" on the card is the newest chapter
      const latest = latestM ? +latestM[1] : p.t;
      const label = `${p.r} / ${latest}`;
      if (ch.getAttribute('data-cx-read') !== label) ch.setAttribute('data-cx-read', label);
      ch.classList.toggle('cx-new', p.r < latest);
      // Whole-card state: outlined while behind, dimmed once caught up.
      const state = p.r < latest ? 'behind' : 'caught';
      if (a.getAttribute('data-cx-state') !== state) a.setAttribute('data-cx-state', state);
    }
  }

  let progressTimer;
  const refreshProgress = () => {
    clearTimeout(progressTimer);
    progressTimer = setTimeout(() => { collectHistory(); decorateProgress(); }, 150);
  };

  const DEBUG_KEY = 'cx-mobile-debug';
  const VERSION = (typeof GM_info !== 'undefined' && GM_info.script?.version) || '0.9.0';
  let debugEl = null;
  let debugTimer = null;
  let lastScrollFrom = '—';
  function setDebug(on) {
    save(DEBUG_KEY, on);
    clearInterval(debugTimer);
    debugEl?.remove();
    debugEl = null;
    if (!on) return;
    debugEl = el('div', { id: 'cx-debug' });
    document.body.appendChild(debugEl);
    const tick = () => {
      const marks = feed ? $$('.cx-pmark', feed) : [];
      const sr = sentinel?.getBoundingClientRect();
      const n = src.next();
      debugEl.textContent = [
        `v${VERSION} ${page()} view=${view}`,
        `scroll: ${scroller ? 'element .' + (scroller.className || scroller.tagName) : 'window'} y=${Math.round(getY())}`,
        `last scroll event from: ${lastScrollFrom}`,
        `pages loaded=${pageNo} marks=${marks.length} showing=${currentPage()}`,
        `cards=${feed ? $$('a.card', feed).length : 0} loading=${loading} target=${targetPage ?? '-'}`,
        `next btn=${n ? (n.disabled ? 'disabled' : 'ok') : 'missing'} sentinel=${sr ? Math.round(sr.top - innerHeight) : '-'}px below`,
        `viewport=${innerWidth}x${innerHeight}`,
      ].join('\n');
    };
    tick();
    debugTimer = setInterval(tick, 500);
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
    feedWrap = el('div', { className: 'cx-keep' });
    feed = el('div', { id: 'cx-feed', className: 'cx-home' });
    status = el('div', { id: 'cx-status' });
    sentinel = el('div', { id: 'cx-sentinel' });
    sentinel.style.height = '1px';
    feedWrap.append(feed, status, sentinel);
    attachFeed();
    new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && userScrolledSince(lastLoadAt)) loadMore();
    }, { rootMargin: `${AHEAD}px 0px` }).observe(sentinel);
  }

  // Only your own scrolling (finger, wheel, keys, our scroll buttons) may trigger the next
  // page, so nothing keeps loading while you're not touching the page.
  let lastUserInput = 0;
  const noteInput = () => { lastUserInput = Date.now(); };
  for (const type of ['touchmove', 'wheel', 'keydown']) window.addEventListener(type, noteInput, { capture: true, passive: true });
  const userScrolledSince = (t) => lastUserInput > t;

  function attachFeed() {
    if (feedWrap && !feedWrap.isConnected) mainCol()?.appendChild(feedWrap);
  }

  function resetFeed() {
    seen.clear();
    feed.textContent = '';
    status.textContent = '';
    loading = false;
    pendingSig = null;
    clearTimeout(loadTimer);
    pageNo = 0;
    targetPage = null;
    earlierTarget = null;
    upEndless = false;
    feedListKey = null;
  }

  // The site writes the real page number into the URL (?page=N) before it renders the
  // new cards, so label pages with that instead of counting (counting drifted).
  const sitePage = () => +(new URL(location.href).searchParams.get('page') || 1);

  // Which list the feed shows: the URL without its page number (Hot vs ?tab=New, filters).
  const listKey = () => { const u = new URL(location.href); u.searchParams.delete('page'); return u.search; };
  let feedListKey = null;

  // Add the cards from the site's current grid that the feed doesn't have yet. The site often
  // renders a page twice (quickly, then with refreshed data), so a page can arrive in parts.
  function harvest() {
    const grid = src.grid();
    if (!grid) return 0;
    if (feedListKey === null) feedListKey = listKey();
    const num = sitePage();
    const fresh = src.items(grid).filter((it) => { const k = itemKey(it); return k && !seen.has(k); });
    pageNo = Math.max(pageNo, num);
    if (!fresh.length) return 0;
    // Pages stay in order: an earlier page (Previous) goes in before the next loaded one.
    const after = $$('.cx-pmark', feed).find((m) => +m.dataset.page > num) || null;
    // Inserting above what's on screen would push it down; keep it where it is (the new
    // page lands above, out of view, until you scroll up to it).
    const shiftFrom = after && after.getBoundingClientRect().top < innerHeight ? after.getBoundingClientRect().top : null;
    if (!$(`.cx-pmark[data-page="${num}"]`, feed)) {
      const mark = el('div', { className: 'cx-pmark', textContent: `Page ${num}` });
      mark.dataset.page = num;
      feed.insertBefore(mark, after);
    }
    for (const it of fresh) {
      seen.add(itemKey(it));
      const c = it.cloneNode(true);
      $$('.card__menu', c).forEach((m) => m.remove()); // its "add to library" handler doesn't survive cloning
      for (const a of c.matches('a') ? [c] : $$('a[href^="/title/"]', c)) { a.target = '_blank'; a.rel = 'noopener'; }
      feed.insertBefore(c, after);
    }
    if (shiftFrom !== null) setY((scroller ? scroller.scrollTop : scrollY) + after.getBoundingClientRect().top - shiftFrom);
    updateEarlier();
    return fresh.length;
  }

  // Opened partway in (?page=N): a row at the top loads the page before, one per tap, with the
  // site's own Previous button, or starts over from page 1.
  function updateEarlier() {
    const marks = $$('.cx-pmark', feed);
    const first = marks.length ? +marks[0].dataset.page : 1;
    let row = $('.cx-earlier-row', feed);
    if (page() !== 'home' || first <= 1) {
      row?.remove();
      row = null;
    } else {
      if (!row) {
        const prev = el('button', { type: 'button', className: 'cx-earlier' });
        prev.addEventListener('click', () => { upEndless = true; startEarlier(); });
        const restart = el('button', { type: 'button', className: 'cx-restart', textContent: 'Start from page 1' });
        restart.addEventListener('click', () => openAtPage(1));
        row = el('div', { className: 'cx-earlier-row' }, prev, restart);
        feed.prepend(row);
      }
      $('.cx-earlier', row).textContent = earlierTarget ? `Loading page ${earlierTarget}…` : `↑ Load page ${first - 1}`;
      $('.cx-restart', row).hidden = first <= 2;
    }
    marks.forEach((m, i) => m.classList.toggle('cx-first', i === 0 && !row)); // the top divider shows under the row
  }

  // After the first tap, scrolling up near the top loads the page before on its own,
  // the same way scrolling down loads the next one.
  let upEndless = false;
  const topNear = () => { const row = feed && $('.cx-earlier-row', feed); return !!row && row.getBoundingClientRect().bottom > -AHEAD; };
  function startEarlier() {
    if (earlierTarget || loading || firstPage() <= 1) return;
    earlierTarget = firstPage() - 1;
    updateEarlier();
    loadEarlier();
  }

  function loadEarlier() {
    if (!earlierTarget || !feed) return;
    if (loading) return; // a forward page is on its way; the row stays tappable after
    const wait = lastLoadAt + MIN_GAP - Date.now();
    if (wait > 0) { setTimeout(loadEarlier, wait); return; }
    const btn = src.prev();
    if (!btn || btn.disabled || btn.getAttribute('aria-disabled') === 'true' || sitePage() <= earlierTarget) {
      earlierTarget = null;
      updateEarlier();
      return;
    }
    loading = true;
    pendingSig = gridSig();
    lastLoadAt = Date.now();
    muteSiteScroll(15000);
    btn.click();
    clearTimeout(loadTimer);
    loadTimer = setTimeout(() => {
      loading = false;
      earlierTarget = null;
      muteSiteScrollUntil = Date.now() + 2000;
      updateEarlier(); // the button reads "Load page N" again, so another tap retries
    }, 12000);
  }

  // A different list (Hot/New switch, filter change) rather than more of the same one?
  function isNewList() {
    if (listKey() !== feedListKey) return true;
    const grid = src.grid();
    const keys = grid ? src.items(grid).map(itemKey).filter(Boolean) : [];
    if (!keys.length) return false;
    // Same address and same-or-earlier page, but almost nothing we've seen: a filter changed.
    const known = keys.filter((k) => seen.has(k)).length;
    return sitePage() <= pageNo && known / keys.length < 0.3 && sitePage() < 2;
  }

  // Start the next page about one screen before the end of the list.
  const AHEAD = 900;
  function sentinelNear() {
    return sentinel.getBoundingClientRect().top < innerHeight + AHEAD;
  }

  // Keep page loads at a human pace; rapid paging is what the site's tool detection reacts to.
  const MIN_GAP = 1500;
  let lastLoadAt = 0;
  let gapTimer = null;

  // After loading earlier pages the site sits on one of them, so its Next steps through pages
  // the feed already has before reaching a new one.
  const behind = () => !!feed && sitePage() < pageNo;

  function loadMore() {
    if (!src.active() || loading || !feed || earlierTarget) return;
    const wait = lastLoadAt + MIN_GAP - Date.now();
    if (wait > 0) {
      if (!gapTimer) gapTimer = setTimeout(() => { gapTimer = null; if (targetPage || behind() || (sentinelNear() && userScrolledSince(lastLoadAt))) loadMore(); }, wait);
      return;
    }
    const btn = src.next();
    if (!btn || btn.disabled || btn.getAttribute('aria-disabled') === 'true') {
      status.textContent = seen.size ? `End of list (last page ${pageNo})` : '';
      if (targetPage) finishJump(pageNo);
      return;
    }
    loading = true;
    pendingSig = gridSig();
    status.textContent = targetPage ? `Loading page ${pageNo + 1} of ${targetPage}…` : behind() ? `Loading page ${pageNo + 1}…` : 'Loading…';
    // Your own scrolling is never locked (an old "snap back down" guard trapped you at the
    // bottom); only the site's jump to its section is ignored.
    lastLoadAt = Date.now();
    muteSiteScroll(15000); // until the page arrives (see nativeScrollTo); shortened once it's in
    btn.click();
    clearTimeout(loadTimer);
    loadTimer = setTimeout(() => { // give up on this attempt; the next scroll retries
      loading = false;
      targetPage = null;
      muteSiteScrollUntil = Date.now() + 2000;
      status.textContent = 'Couldn’t load more. Scroll to retry.';
    }, 12000);
  }

  // React re-renders the site's list after Next, Hot/New, filters or a view switch.
  let debounce;
  function onSiteChange() {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      attachFeed();
      markActive();
      refreshProgress();
      const sig = gridSig();
      if (!sig) return; // still loading / skeleton / empty
      if (loading) {
        if (sig === pendingSig) return;
        loading = false;
        clearTimeout(loadTimer);
        status.textContent = '';
        harvest();
        muteSiteScrollUntil = Date.now() + 3000; // the site's jump comes just after it renders
        // No chaining unless jumping to a page: the next page loads only when you scroll near the end again.
        if (earlierTarget) {
          if (sitePage() <= earlierTarget) { earlierTarget = null; updateEarlier(); }
          else setTimeout(loadEarlier, 300);
        } else if (behind()) {
          setTimeout(loadMore, 300); // still on a page we have; keep going to the next new one
        } else if (targetPage) {
          if (pageNo >= targetPage) finishJump(targetPage);
          else setTimeout(loadMore, 300); // one page at a time, gently
        }
        updateBadge();
      } else if (!seen.has(firstKey(sig)) || src.items(src.grid()).some((it) => !seen.has(itemKey(it)))) {
        if (isNewList()) {
          resetFeed(); // a different list: start over
          harvest();
        } else {
          harvest(); // same list: a refreshed or later page; just add what's new
        }
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
    if (n < firstPage()) { openAtPage(n); return; } // before where this feed started: reopen there
    if (n <= pageNo) return;
    // Not loaded yet: page forward with the site's Next button until we get there.
    targetPage = n;
    if (!loading) loadMore();
    else status.textContent = `Loading page ${pageNo + 1} of ${targetPage}…`;
  }

  const firstPage = () => +($('.cx-pmark', feed || document)?.dataset.page || 1);
  function openAtPage(n) {
    const u = new URL(location.href);
    if (n > 1) u.searchParams.set('page', n); else u.searchParams.delete('page');
    location.assign(u);
  }

  function scrollToMark(mark) {
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

  // ---------- Top / Up / Down buttons (bottom right) ----------
  // Tap Up/Down: one screen. Hold: keep scrolling, speeding up. Top: jump to the top.
  function buildNav() {
    const mk = (label, text) => {
      const b = el('button', { type: 'button', textContent: text });
      b.setAttribute('aria-label', label);
      return b;
    };
    const top = mk('Go to top', '⤒');
    const up = mk('Scroll up', '▲');
    const down = mk('Scroll down', '▼');
    const nav = el('div', { id: 'cx-nav' }, top, up, down);
    document.body.appendChild(nav);
    top.addEventListener('click', () => setY(0));
    holdToScroll(up, -1);
    holdToScroll(down, 1);
    nav.addEventListener('contextmenu', (e) => e.preventDefault()); // no long-press menu
  }

  // Movement is timer-based in px per second, so it runs at the same speed whatever
  // the frame rate (animation frames and smooth scrolling can be throttled).
  let tapAnim = null;
  function glideBy(dist, ms = 220) {
    clearInterval(tapAnim);
    const from = getY();
    const t0 = performance.now();
    tapAnim = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      setY(Math.max(0, from + dist * (1 - (1 - k) * (1 - k)))); // ease-out
      if (k >= 1) clearInterval(tapAnim);
    }, 16);
  }

  function holdToScroll(btn, dir) {
    let timer = null;
    let holdTimer = null;
    let held = false;
    const stop = () => {
      clearTimeout(holdTimer);
      clearInterval(timer);
      timer = null;
      btn.classList.remove('is-held');
    };
    const startHold = () => {
      held = true;
      btn.classList.add('is-held');
      clearInterval(tapAnim);
      const t0 = performance.now();
      let last = t0;
      timer = setInterval(() => {
        const now = performance.now();
        const speed = Math.min(700 + (now - t0) * 1.2, 2600); // px/s, speeding up over ~1.5 s
        noteInput();
        setY(Math.max(0, getY() + dir * speed * (now - last) / 1000));
        last = now;
      }, 16);
    };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      held = false;
      try { btn.setPointerCapture(e.pointerId); } catch (_) {}
      holdTimer = setTimeout(startHold, 220);
    });
    btn.addEventListener('pointerup', () => {
      const wasHeld = held;
      stop();
      held = false;
      if (!wasHeld) { // a tap: one screen
        noteInput();
        glideBy(dir * Math.round(innerHeight * 0.85));
      }
    });
    btn.addEventListener('pointercancel', () => { stop(); held = false; });
  }

  // ---------- scrolling (window or inner element) ----------
  let ticking = false;
  document.addEventListener('scroll', (e) => {
    const t = e.target;
    const isPage = t === document || t === document.documentElement || t === document.body;
    lastScrollFrom = isPage ? 'window' : t instanceof Element ? `${t.tagName.toLowerCase()}.${String(t.className).split(' ')[0]}` : '?';
    // The badge reads positions on screen, so any scroll can update it.
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        updateBadge();
        if (feed && !loading && sentinelNear() && userScrolledSince(lastLoadAt)) loadMore();
        else if (feed && !loading && upEndless && topNear() && userScrolledSince(lastLoadAt)) startEarlier();
      });
    }
    if (isPage) scroller = null;
    else if (t instanceof Element && (t.contains(feedWrap) || t.contains(mainCol()) || t.contains($('main')))) scroller = t;
  }, { capture: true, passive: true });

  // ---------- long-press a card: the site's "Add to library" menu ----------
  // A long press on a link fires "contextmenu" (right-click on desktop). Use it to press the
  // card's own (hidden) library button, then move the site's menu to where you pressed.
  function toast(text) {
    $('#cx-toast')?.remove();
    const t = el('div', { id: 'cx-toast', textContent: text });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  function libraryButtonFor(a) {
    if (!a.closest('#cx-feed')) { const own = $('.card__action--menu', a); if (own) return own; }
    // Feed cards are copies: use the site's own card for the same title if it's on the page.
    const href = a.getAttribute('href');
    for (const c of $$('main a.card')) {
      if (c.closest('#cx-feed') || c.getAttribute('href') !== href) continue;
      const b = $('.card__action--menu', c);
      if (b) return b;
    }
    return null;
  }

  // The menu gets the full title in a box just above it (cover titles are cut to two lines).
  let titleWatch;
  function placeMenu(x, y, title) {
    const pop = $$('.card__menu-pop').pop();
    if (!pop) return;
    $('#cx-ltitle')?.remove();
    clearInterval(titleWatch);
    const r = pop.getBoundingClientRect();
    const box = title ? el('div', { id: 'cx-ltitle', textContent: title }) : null;
    let gap = 0;
    if (box) {
      box.style.width = `${Math.min(innerWidth - 16, Math.max(r.width, 220))}px`;
      document.body.appendChild(box);
      gap = box.getBoundingClientRect().height + 6;
    }
    const left = Math.max(8, Math.min(x - r.width / 2, innerWidth - r.width - 8));
    const top = Math.max(56 + gap, Math.min(y + 10, innerHeight - r.height - 8));
    for (const [k, v] of [['left', `${left}px`], ['top', `${top}px`], ['right', 'auto'], ['bottom', 'auto'], ['transform', 'none']]) {
      pop.style.setProperty(k, v, 'important');
    }
    if (!box) return;
    const w = box.getBoundingClientRect().width;
    box.style.left = `${Math.max(8, Math.min(left, innerWidth - w - 8))}px`;
    box.style.top = `${top - gap}px`;
    // gone with the menu (picked an option, tapped outside, scrolled away)
    titleWatch = setInterval(() => { if (!pop.isConnected || !pop.getClientRects().length) { box.remove(); clearInterval(titleWatch); } }, 150);
  }

  document.addEventListener('contextmenu', (e) => {
    if (!root.classList.contains('cx-on')) return;
    const a = e.target.closest?.('main a.card');
    if (!a) return;
    e.preventDefault();
    const btn = libraryButtonFor(a);
    if (!btn) { toast('Open this title to add it to your library'); return; }
    navigator.vibrate?.(15);
    const { clientX: x, clientY: y } = e;
    const title = ($('.card__title', a)?.textContent || '').trim();
    btn.click();
    requestAnimationFrame(() => requestAnimationFrame(() => placeMenu(x, y, title)));
  }, true);

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
    return !!(mainCol() && src.grid() && viewEl('popular'));
  }

  function start() {
    buildBar();
    buildPageBox();
    buildNav();
    if (page() === 'home') {
      buildFeed();
      // Opened on ?page=N: show the Hot/New list the site opened on, rather than clicking our
      // saved tab (which would send the site back to page 1).
      if (startPage() > 1) {
        const on = $$('.filter-btn.is-active', latestSec() || document).map((b) => b.textContent.trim().toLowerCase()).find(isLatest);
        if (on && homeTabs().includes(on)) view = on;
        else if (!isLatest(view)) view = homeTabs().find(isLatest) || view;
      }
      markActive();
      new MutationObserver(onSiteChange).observe(src.watch(), { childList: true, subtree: true });
      if (isLatest(view) && startPage() === 1) selectLatestTab(view);
      harvest();
      if (sentinelNear()) loadMore();
    } else {
      // Browse: keep its cards labelled as results and pages change.
      new MutationObserver(refreshProgress).observe($('main') || document.body, { childList: true, subtree: true });
    }
    refreshProgress();
    if (root.classList.contains('cx-showhdr')) setHeader(true);
    if (load(DEBUG_KEY, false)) setDebug(true);
    // Fallback in case scroll events never reach us on some layout.
    setInterval(updateBadge, 1000);
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
