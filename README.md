# Comix Mobile Feed

Userscript for comix.to on phones (home page and /browse):

- Fixed top bar with tabs. Tap the active tab again to scroll to the top.
- **⚙ settings** (right end of the bar):
  - **Shown tabs**, in bar order. Use ▲/▼ to reorder them and untick to hide one. Hidden tabs are listed below; tick one to add it to the end of the bar.
  - Available tabs: Announcements, New Chapters from Followed Comics, Reading History, Recommended for you, Most Recent Popular, Most Follows · New Comics, Latest Updates Hot, Latest Updates New, User Collections and Browse. The signed-in sections are empty when you're logged out.
  - **Log in / Account menu**, plus an option to always show the site's own header (search, notifications, account).
  - The site's own settings: theme, content filter and content preferences.
- Only the selected section is visible. The site header, sidebar and footer are hidden.
- 3 cards per row. Each tab keeps the site's own ⋮ menu (timeframe, type filter, …).
- **Endless scroll** on Hot, New and Browse. The script presses the site's own *Next* button and appends each page, with a small "Page N" divider between pages.
- **Page N** badge, bottom left. It shows the page you're looking at. Tap it, enter a number and press Go: a loaded page scrolls into view, and on Hot/New pages further ahead are loaded one at a time. On Browse, a page that isn't loaded yet opens directly with your filters kept.
- **★ Browse presets** (top bar on /browse). This saves the current filters (they live in the URL) under a name. Tap a preset to load it, or ✕ to delete it. Saving with an existing name overwrites that preset.
- Tapping a title or collection opens it in a new tab.

Only runs on `https://comix.to/` and `https://comix.to/browse`. Title and reader pages are left alone.

## Install on Firefox for Android

1. Install **Violentmonkey** (or Tampermonkey) from Firefox's Add-ons menu.
2. Open this link in Firefox and tap **Install**:
   https://raw.githubusercontent.com/polo2005x/comix-android-ui/main/comix-mobile.user.js
3. Open https://comix.to/.

## Updating

The script's `@updateURL` points at this repo. Violentmonkey checks for updates automatically, or you can tap **Check for updates** in its dashboard. It only installs a new copy when `@version` in the script header is higher, so bump the version with every change you push.

## Notes

- Popular, Follows and the signed-in rails show what the site provides for them; those lists aren't paged.
- Hot/New and Browse pages come from the site's own app, because its API requires a signature that only its own code adds.
- Settings and presets are saved in the browser's storage for comix.to, so clearing that site's data resets them.
- If comix.to renames its CSS classes (`.grid-updates`, `.pager__btn`, `.npager`, `.list-grid`, `a.card`, `section.section`), update the lookups near the top of the script.
