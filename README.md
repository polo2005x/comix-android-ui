# Comix Mobile Feed

Userscript for comix.to on phones (home page and /browse):

- Fixed top bar with tabs. Tap the active tab again to scroll to the top.
- **⚙ settings** (right end of the bar):
  - **Shown tabs**, in bar order. Use ▲/▼ to reorder them and untick to hide one. Hidden tabs are listed below; tick one to add it to the end of the bar.
  - Available tabs: Announcements, New Chapters from Followed Comics, Reading History, Recommended for you, Most Recent Popular, Most Follows · New Comics, Latest Updates Hot, Latest Updates New, User Collections and Browse. The signed-in sections are empty when you're logged out.
  - **Account:** shows or hides the site's own header, pinned just under the bar. Log in, your account menu, notifications and search are all there.
  - The site's own settings: theme, content filter and content preferences.
  - **Show debug info:** a small readout in the bottom-right corner for tracking down page-number problems.
- Only the selected section is visible. The site header, sidebar and footer are hidden.
- 3 cards per row. Each tab keeps the site's own ⋮ menu (timeframe, type filter, …).
- **Endless scroll** on Hot and New. The script presses the site's own *Next* button and appends each page, with a small "Page N" divider between pages (numbered like the site's own pages). A page only loads when you scroll near the end yourself, never while you leave the page alone, and loads are at least 1.5 s apart.
- **Top / ▲ / ▼ buttons**, bottom right. Tap ▲ or ▼ to move one screen, or hold to keep scrolling (it speeds up). ⤒ jumps to the top.
- **Links with a page number** (`?page=4`, also `?tab=New&page=4`) open the Hot/New feed at that page and keep scrolling from there. The site writes the page into the address as you scroll, so reloading picks up where you were. At the top of the feed, **↑ Load page N** adds the page before (one per tap, using the site's Previous button) without losing what you have, and **Start from page 1** reopens the feed from the beginning. After loading earlier pages, the next scroll past the end steps the site forward past pages you already have, which can take a few seconds.
- Browse keeps the site's own numbered pager. Endless scroll there tripped the site's third-party detection, so it was removed.
- **Page N** badge, bottom left. It shows the page you're looking at. Tap it, enter a number and press Go: a loaded page scrolls into view, and on Hot/New pages further ahead are loaded one at a time. On Browse, the number opens that page directly with your filters kept.
- **★ Browse presets** (top bar on /browse). This saves the current filters (they live in the URL) under a name. Tap a preset to load it, or ✕ to delete it. Saving with an existing name overwrites that preset.
- **Reading progress on cards.** While you're logged in, the script remembers the "read / total" numbers from your Reading History rail. It then shows "read / latest" in place of "Ch.X" on the same titles in every tab and on Browse, shown as a purple pill when there are new chapters and a green ✓ pill once you are caught up. Titles you've started but are behind on get a purple outline around the cover, and titles you've read up to the latest chapter are dimmed. The list grows as you read; turn it off in ⚙ → Reading progress.
- Tapping a title or collection opens it in a new tab.
- **Long-press a card** (right-click on desktop) to open the site's own Add to library menu: Reading, Completed, On-Hold, Plan to Read, Dropped. It appears where you pressed. On older Hot/New feed pages, the site's card for that title may no longer be on the page; you'll then see a short note to open the title instead.

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
