# Comix Mobile Feed

Userscript for the comix.to home page:

- Fixed top bar with three tabs: **Hot** and **New** (Latest Updates) and **Popular** (Most Recent Popular). Tap the active tab again to scroll to the top.
- Hides everything else: the site header, sidebar, footer, announcements and the other home sections.
- 3 cards per row.
- Endless scroll on Hot and New. The script presses the site's own hidden *Next* button and appends each new page.
- Tapping a title opens it in a new tab.
- The site's own filter menu (⋮) stays visible: type filter on Hot/New, timeframe on Popular.

Only runs on `https://comix.to/`. Title and reader pages are left alone.

## Install on Firefox for Android

1. Install **Violentmonkey** (or Tampermonkey) from Firefox's Add-ons menu.
2. Open this link in Firefox and tap **Install**:
   https://raw.githubusercontent.com/polo2005x/comix-android-ui/main/comix-mobile.user.js
3. Open https://comix.to/.

## Updating

The script's `@updateURL` points at this repo. Violentmonkey checks for updates automatically, or you can tap **Check for updates** in its dashboard. It only installs a new copy when `@version` in the script header is higher, so bump the version with every change you push.

## Notes

- Popular shows the 50 entries the site provides for the chosen timeframe. The site doesn't page this list.
- Hot/New pages come from the site's own app, because its API requires a signature that only its own code adds.
- If comix.to renames its CSS classes (`.grid-updates`, `.pager__btn`, `a.card`, `section.section`), update the lookups near the top of the script.
