# Comix Mobile Feed

Userscript for the comix.to home page:

- Fixed top bar with tabs. Tap the active tab again to scroll to the top.
- The ⚙ button at the right of the bar picks which tabs are shown: Announcements, Most Recent Popular, Most Follows · New Comics, Latest Updates Hot, Latest Updates New, User Collections and Browse. The default is Popular, Hot and New.
- Only the selected section is visible. The site header, sidebar, footer and other sections are hidden.
- **Browse** opens the site's own /browse page with the same top bar, so its filters and numbered pages work as usual. Its grid view shows 3 per row.
- The ⚙ panel also has a button for the site's own settings: theme, content filter and content preferences.
- A **Page N** badge in the bottom-left corner shows which page you're on. Tap it, type a number and press Go to jump there. On Hot/New, pages you haven't loaded yet are fetched one at a time until you get there. On Browse it opens that page with your filters kept.
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
