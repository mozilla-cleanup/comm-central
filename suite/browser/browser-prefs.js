/* -*- Mode: javascript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Benjamin Smedberg <bsmedberg@covad.net>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/* The prefs in this file are specific to the seamonkey (toolkit) browser.
 * Generic default prefs that would be useful to embedders belong in
 * modules/libpref/src/init/all.js
 */

pref("startup.homepage_override_url","chrome://navigator-region/locale/region.properties");
pref("general.skins.selectedSkin", "classic/1.0");

pref("browser.chromeURL","chrome://navigator/content/navigator.xul");
pref("browser.hiddenWindowChromeURL", "chrome://navigator/content/hiddenWindow.xul");

// prompt for Master Password on startup
pref("signon.startup.prompt",               true);

pref("general.startup.browser",             true);
pref("general.startup.mail",                false);
pref("general.startup.news",                false);
pref("general.startup.editor",              false);
pref("general.startup.compose",             false);
pref("general.startup.addressbook",         false);

pref("general.open_location.last_url",      "");
pref("general.open_location.last_window_choice", 0);

pref("general.smoothScroll", false);
pref("general.autoScroll", true);

pref("general.useragent.compatMode.firefox", true);

// 0 = blank, 1 = home (browser.startup.homepage), 2 = last
pref("browser.startup.page",                1);
pref("browser.startup.homepage",	   "chrome://navigator-region/locale/region.properties");
pref("browser.startup.homepage.count", 1);

pref("browser.warnOnQuit", true);
pref("browser.warnOnRestart", true);

// disable this until it can be disabled on a per-docshell basis (see bug 319368)
pref("browser.send_pings", false);

pref("browser.chrome.site_icons", true);
pref("browser.chrome.favicons", false);

pref("browser.download.finished_download_sound", false);
pref("browser.download.finished_sound_url", "");
pref("browser.download.useDownloadDir", false);
pref("browser.download.folderList", 1);

pref("browser.download.manager.showAlertOnComplete", true);
pref("browser.download.manager.showAlertInterval", 2000);
pref("browser.download.manager.retention", 2);
pref("browser.download.manager.quitBehavior", 0);
pref("browser.download.manager.addToRecentDocs", true);
pref("browser.download.manager.scanWhenDone", true);
pref("browser.download.manager.resumeOnWakeDelay", 10000);
pref("browser.download.manager.flashCount", 2);
pref("browser.download.manager.showWhenStarting", true);
pref("browser.download.manager.focusWhenStarting", false);
pref("browser.download.manager.closeWhenDone", false);
pref("browser.download.progress.closeWhenDone", false);

// Number of milliseconds to wait for the http headers (and thus
// the Content-Disposition filename) before giving up and falling back to
// picking a filename without that info in hand so that the user sees some
// feedback from their action.
pref("browser.download.saveLinkAsFilenameTimeout", 1000);

// Use the findbar instead of the dialog box
pref("browser.findbar.enabled", true);

// Use doorhanger notifications instead of the notification bar
pref("browser.doorhanger.enabled", true);

// search engines URL
pref("browser.search.searchEnginesURL", "https://addons.mozilla.org/%LOCALE%/%APP%/search-engines/");

// pointer to the default engine name
pref("browser.search.defaultenginename", "chrome://communicator-region/locale/region.properties");

// Disable logging for the search service by default.
pref("browser.search.log", false);

// Ordering of Search Engines in the Engine list.
pref("browser.search.order.1", "chrome://communicator-region/locale/region.properties");
pref("browser.search.order.2", "chrome://communicator-region/locale/region.properties");

// Search (side)bar results always open in a new tab.
pref("browser.search.openintab", false);

// Invoking a search reveals the sidebar panel.
pref("browser.search.opensidebarsearchpanel", false);

// Send ping to the server to update.
pref("browser.search.update", true);

// Disable logging for the search service update system by default.
pref("browser.search.update.log", false);

// Check whether we need to perform engine updates every 6 hours
pref("browser.search.update.interval", 21600);

// Smart Browsing prefs
pref("keyword.enabled", true);
// Override the default keyword.URL. Empty value means
// "use the search service's default engine"
pref("keyword.URL", "");

pref("browser.urlbar.autocomplete.enabled", true);
pref("browser.urlbar.clickSelectsAll", true);
// when clickSelectsAll=true, does it also apply when the click is past end of text?
pref("browser.urlbar.clickAtEndSelects", true);

pref("browser.urlbar.autoFill", false);
pref("browser.urlbar.showPopup", true);
pref("browser.urlbar.showSearch", true);
// 0: Match anywhere (e.g., middle of words)
// 1: Match on word boundaries and then try matching anywhere
// 2: Match only on word boundaries (e.g., after / or .)
// 3: Match at the beginning of the url or title
pref("browser.urlbar.matchBehavior", 1);

// The default behavior for the urlbar can be configured to use any combination
// of the restrict or match filters with each additional filter restricting
// more (intersection). Add the following values to set the behavior as the
// default: 1: history, 2: bookmark, 4: tag, 8: title, 16: url, 32: typed
// E.g., 0 = show all results (no filtering), 1 = only visited pages in history,
// 2 = only bookmarks, 3 = visited bookmarks, 1+16 = history matching in the url
pref("browser.urlbar.default.behavior", 1);
pref("browser.urlbar.filter.javascript", true);

// Size of "chunks" affects the number of places to process between each search
// timeout (ms). Too big and the UI will be unresponsive; too small and we'll
// be waiting on the timeout too often without many results.
pref("browser.urlbar.search.chunkSize", 1000);
pref("browser.urlbar.search.timeout", 100);

// The special characters below can be typed into the urlbar to either restrict
// the search to visited history, bookmarked, tagged pages; or force a match on
// just the title text or url.
pref("browser.urlbar.restrict.history", "^");
pref("browser.urlbar.restrict.bookmark", "*");
pref("browser.urlbar.restrict.tag", "+");
pref("browser.urlbar.restrict.openpage", "%");
pref("browser.urlbar.restrict.typed", "~");
pref("browser.urlbar.match.title", "#");
pref("browser.urlbar.match.url", "@");

// Whether or not microsummary and generator updates are enabled.
pref("browser.microsummary.enabled", true);
pref("browser.microsummary.updateGenerators", true);

pref("browser.history.grouping", "day");
pref("browser.sessionhistory.max_entries", 50);

// Whether history is enabled or not.
pref("places.history.enabled", true);

// The percentage of system memory that the Places database can use.  Out of the
// allowed cache size it will at most use the size of the database file.
// Changes to this value are effective after an application restart.
// Acceptable values are between 0 and 50.
pref("places.database.cache_to_memory_percentage", 6);

// the (maximum) number of the recent visits to sample
// when calculating frecency
pref("places.frecency.numVisits", 10);

// buckets (in days) for frecency calculation
pref("places.frecency.firstBucketCutoff", 4);
pref("places.frecency.secondBucketCutoff", 14);
pref("places.frecency.thirdBucketCutoff", 31);
pref("places.frecency.fourthBucketCutoff", 90);

// weights for buckets for frecency calculations
pref("places.frecency.firstBucketWeight", 100);
pref("places.frecency.secondBucketWeight", 70);
pref("places.frecency.thirdBucketWeight", 50);
pref("places.frecency.fourthBucketWeight", 30);
pref("places.frecency.defaultBucketWeight", 10);

// bonus (in percent) for visit transition types for frecency calculations
pref("places.frecency.embedVisitBonus", 0);
pref("places.frecency.framedLinkVisitBonus", 0);
pref("places.frecency.linkVisitBonus", 100);
pref("places.frecency.typedVisitBonus", 2000);
pref("places.frecency.bookmarkVisitBonus", 75);
pref("places.frecency.downloadVisitBonus", 0);
pref("places.frecency.permRedirectVisitBonus", 0);
pref("places.frecency.tempRedirectVisitBonus", 0);
pref("places.frecency.defaultVisitBonus", 0);

// bonus (in percent) for place types for frecency calculations
pref("places.frecency.unvisitedBookmarkBonus", 140);
pref("places.frecency.unvisitedTypedBonus", 200);

// By default, do not export HTML at shutdown.
// If true, at shutdown the bookmarks in your menu and toolbar will
// be exported as HTML to the bookmarks.html file.
pref("browser.bookmarks.autoExportHTML", false);

// The maximum number of daily bookmark backups to
// keep in {PROFILEDIR}/bookmarkbackups. Special values:
// -1: unlimited
//  0: no backups created (and deletes all existing backups)
pref("browser.bookmarks.max_backups", 10);

// Don't try to alter this pref, it'll be reset the next time you use the
// bookmarking dialog
pref("browser.bookmarks.editDialog.firstEditField", "namePicker");

// Tabbed browser
pref("browser.tabs.loadDivertedInBackground", false);
pref("browser.tabs.loadInBackground", true);
pref("browser.tabs.opentabfor.doubleclick", false);
pref("browser.tabs.opentabfor.middleclick", true);
pref("browser.tabs.opentabfor.urlbar", true);
pref("browser.tabs.tooltippreview.enable", true);
pref("browser.tabs.tooltippreview.width", 300);
pref("browser.tabs.autoHide", true);
pref("browser.tabs.forceHide", false);
pref("browser.tabs.closeWindowWithLastTab", true);
pref("browser.tabs.warnOnClose", true);
pref("browser.tabs.warnOnCloseOther", true);
pref("browser.tabs.warnOnOpen", true);
pref("browser.tabs.maxOpenBeforeWarn", 15);
pref("browser.tabs.insertRelatedAfterCurrent", true);
// 0 = append, 1 = replace
pref("browser.tabs.loadGroup", 1);

// how many browsers can be saved in the DOM (by the tabbed browser)
pref("browser.tabs.max_tabs_undo", 3);
// should popups by saved in the DOM (by the tabbed browser)
pref("browser.tabs.cache_popups", false);

// tab width and clipping
pref("browser.tabs.tabMinWidth", 100);
pref("browser.tabs.tabMaxWidth", 250);
pref("browser.tabs.tabClipWidth", 140);

// Where to show tab close buttons:
// 0  on active tab only
// 1  on all tabs until tabClipWidth is reached, then active tab only
// 2  no close buttons at all
// 3  at the end of the tabstrip
pref("browser.tabs.closeButtons", 3);

// lets new tab/window load something different than first window
// -1 - use navigator startup preference
//  0 - loads blank page
//  1 - loads home page
//  2 - loads last page visited
pref("browser.tabs.loadOnNewTab", 0);
pref("browser.windows.loadOnNewWindow", 1);

// external link handling in tabbed browsers. values from nsIBrowserDOMWindow.
// 0=default window, 1=current window/tab, 2=new window, 3=new tab in most recent window
pref("browser.link.open_external", 3);
// internal links handling in tabbed browsers. see .open_external for values.
pref("browser.link.open_newwindow", 3);

// 0: no restrictions - divert everything
// 1: don't divert window.open at all
// 2: don't divert window.open with features
pref("browser.link.open_newwindow.restriction", 2);

// Translation service
pref("browser.translation.service", "chrome://navigator-region/locale/region.properties");
pref("browser.translation.serviceDomain", "chrome://navigator-region/locale/region.properties");

// 0 goes back
// 1 act like pgup
// 2 and other values, nothing
pref("browser.backspace_action", 0);

// Controls behavior of the "Add Exception" dialog launched from SSL error pages:
// 0 - don't pre-populate anything.
// 1 - pre-populate site URL, but don't fetch certificate.
// 2 - pre-populate site URL and pre-fetch certificate.
pref("browser.ssl_override_behavior", 2);

pref("browser.zoom.full", true);

pref("javascript.options.showInConsole",    true);

pref("offline.startup_state",            0);
pref("offline.send.unsent_messages",            0);
pref("offline.download.download_messages",  0);

pref("browser.formfill.expire_days",        180);

pref("mailnews.ui.deleteMarksRead", true);

// -- folders (Mac: these are binary aliases.)
pref("mail.signature_file",             "");
pref("mail.directory",                  "");
pref("news.directory",                  "");
pref("spellchecker.dictionaries.download.url", "chrome://branding/locale/brand.properties");

// this will automatically enable inline spellchecking (if it is available) for
// editable elements in HTML
// 0 = spellcheck nothing
// 1 = check multi-line controls [default]
// 2 = check multi/single line controls
pref("layout.spellcheckDefault", 1);

// Blocks auto refresh if true
pref("accessibility.blockautorefresh", false);

// special TypeAheadFind settings

// Use the findbar for type ahead find, instead of the XPFE implementation
pref("accessibility.typeaheadfind.usefindbar", true);
pref("accessibility.typeaheadfind.flashBar", 0);
#ifndef XP_UNIX
pref("accessibility.typeaheadfind.soundURL", "default");
#endif

#ifdef XP_WIN
pref("browser.preferences.instantApply", false);
#else
pref("browser.preferences.instantApply", true);
#endif
#ifdef XP_MACOSX
pref("browser.preferences.animateFadeIn", true);
#else
pref("browser.preferences.animateFadeIn", false);
#endif

pref("browser.download.show_plugins_in_list", true);
pref("browser.download.hide_plugins_without_extensions", true);

// initial web feed readers list - add enough entries for locales to add theirs
pref("browser.contentHandlers.types.0.title", "chrome://navigator-region/locale/region.properties");
pref("browser.contentHandlers.types.0.uri", "chrome://navigator-region/locale/region.properties");
pref("browser.contentHandlers.types.0.type", "application/vnd.mozilla.maybe.feed");
pref("browser.contentHandlers.types.1.title", "chrome://navigator-region/locale/region.properties");
pref("browser.contentHandlers.types.1.uri", "chrome://navigator-region/locale/region.properties");
pref("browser.contentHandlers.types.1.type", "application/vnd.mozilla.maybe.feed");
pref("browser.contentHandlers.types.2.title", "chrome://navigator-region/locale/region.properties");
pref("browser.contentHandlers.types.2.uri", "chrome://navigator-region/locale/region.properties");
pref("browser.contentHandlers.types.2.type", "application/vnd.mozilla.maybe.feed");
pref("browser.contentHandlers.types.3.title", "chrome://navigator-region/locale/region.properties");
pref("browser.contentHandlers.types.3.uri", "chrome://navigator-region/locale/region.properties");
pref("browser.contentHandlers.types.3.type", "application/vnd.mozilla.maybe.feed");
pref("browser.contentHandlers.types.4.title", "chrome://navigator-region/locale/region.properties");
pref("browser.contentHandlers.types.4.uri", "chrome://navigator-region/locale/region.properties");
pref("browser.contentHandlers.types.4.type", "application/vnd.mozilla.maybe.feed");
pref("browser.contentHandlers.types.5.title", "chrome://navigator-region/locale/region.properties");
pref("browser.contentHandlers.types.5.uri", "chrome://navigator-region/locale/region.properties");
pref("browser.contentHandlers.types.5.type", "application/vnd.mozilla.maybe.feed");

pref("browser.feeds.handler", "ask");
pref("browser.videoFeeds.handler", "ask");
pref("browser.audioFeeds.handler", "ask");

pref("browser.sessionstore.resume_from_crash", true);
pref("browser.sessionstore.resume_session_once", false);

// minimal interval between two save operations in milliseconds
pref("browser.sessionstore.interval", 15000);
// maximum amount of POSTDATA to be saved in bytes per history entry (-1 = all of it)
// (NB: POSTDATA will be saved either entirely or not at all)
pref("browser.sessionstore.postdata", 0);
// on which sites to save text data, POSTDATA and cookies
// 0 = everywhere, 1 = unencrypted sites, 2 = nowhere
pref("browser.sessionstore.privacy_level", 1);
// number of crashes that can occur before the about:sessionrestore page is displayed
// (this pref has no effect if more than 6 hours have passed since the last crash)
pref("browser.sessionstore.max_resumed_crashes", 1);
// how many tabs can be reopened (per window)
pref("browser.sessionstore.max_tabs_undo", 10);
// how many windows can be reopened (per session) - on non-OS X platforms this
// pref may be ignored when dealing with pop-up windows to ensure proper startup
pref("browser.sessionstore.max_windows_undo", 3);

pref("shell.checkDefaultClient", true);
// We want to check if we are the default client for browser and mail. See 
// suite/shell/public/nsIShellService.idl for the possible constants you can use
pref("shell.checkDefaultApps", 3);

pref("app.releaseNotesURL", "chrome://branding/locale/brand.properties");
pref("app.vendorURL", "chrome://branding/locale/brand.properties");

// Base URL for web-based support pages.
pref("app.support.baseURL", "http://www.seamonkey-project.org/doc/");

// App-specific update preferences

// Whether or not app updates are enabled
pref("app.update.enabled", true);
 
// This preference turns on app.update.mode and allows automatic download and
// install to take place. We use a separate boolean toggle for this to make
// the UI easier to construct.
pref("app.update.auto", true);

// Defines how the Application Update Service notifies the user about updates:
//
// AUM Set to:        Minor Releases:     Major Releases:
// 0                  download no prompt  download no prompt
// 1                  download no prompt  download no prompt if no incompatibilities
// 2                  download no prompt  prompt
//
// See chart in nsUpdateService.js.in for more details
//
pref("app.update.mode", 1);

// If set to true, the Update Service will present no UI for any event.
pref("app.update.silent", false);

// Update service URL:
pref("app.update.url", "https://aus2-community.mozilla.org/update/3/%PRODUCT%/%VERSION%/%BUILD_ID%/%BUILD_TARGET%/%LOCALE%/%CHANNEL%/%OS_VERSION%/%DISTRIBUTION%/%DISTRIBUTION_VERSION%/update.xml");
// URL user can browse to manually if for some reason all update installation
// attempts fail.
pref("app.update.url.manual", "http://www.seamonkey-project.org/");
// A default value for the "More information about this update" link
// supplied in the "An update is available" page of the update wizard. 
pref("app.update.url.details", "chrome://communicator-region/locale/region.properties");
 
// User-settable override to app.update.url for testing purposes.
//pref("app.update.url.override", "");
 
// Enables some extra Application Update Logging (can reduce performance)
pref("app.update.log", false);

// When |app.update.cert.requireBuiltIn| is true or not specified the
// final certificate and all certificates the connection is redirected to before
// the final certificate for the url specified in the |app.update.url|
// preference must be built-in.
pref("app.update.cert.requireBuiltIn", true);

// When |app.update.cert.checkAttributes| is true or not specified the
// certificate attributes specified in the |app.update.certs.| preference branch
// are checked against the certificate for the url specified by the
// |app.update.url| preference.
pref("app.update.cert.checkAttributes", true);

// The number of certificate attribute check failures to allow for background
// update checks before notifying the user of the failure. User initiated update
// checks always notify the user of the certificate attribute check failure.
pref("app.update.cert.maxErrors", 5);

// The |app.update.certs.| preference branch contains branches that are
// sequentially numbered starting at 1 that contain attribute name / value
// pairs for the certificate used by the server that hosts the update xml file
// as specified in the |app.update.url| preference. When these preferences are
// present the following conditions apply for a successful update check:
// 1. the uri scheme must be https
// 2. the preference name must exist as an attribute name on the certificate and
//    the value for the name must be the same as the value for the attribute
//    name on the certificate.
// If these conditions aren't met it will be treated the same as when there is
// no update available. This validation will not be performed when using the
// |app.update.url.override| preference for update checking.
pref("app.update.certs.1.issuerName", "OU=Equifax Secure Certificate Authority,O=Equifax,C=US");
pref("app.update.certs.1.commonName", "aus2-community.mozilla.org");

// Interval: Time between checks for a new version (in seconds)
//           default=1 day
pref("app.update.interval", 86400);
// Interval: Time before prompting the user again to restart to install the
//           latest download (in seconds) default=1 day
pref("app.update.nagTimer.restart", 86400);
// Interval: When all registered timers should be checked (in milliseconds)
//           default=10 minutes
pref("app.update.timer", 600000);
// Give the user x seconds to react before showing the big UI. default=12 hrs
pref("app.update.promptWaitTime", 43200);
// Show the Update Checking/Ready UI when the user was idle for x seconds
pref("app.update.idletime", 60);
 
// Whether or not we show a dialog box informing the user that the update was
// successfully applied. At the moment suite doesn't want this dialog by
// default
pref("app.update.showInstalledUI", false);

// 0 = suppress prompting for incompatibilities if there are updates available
//     to newer versions of installed addons that resolve them.
// 1 = suppress prompting for incompatibilities only if there are VersionInfo
//     updates available to installed addons that resolve them, not newer
//     versions.
pref("app.update.incompatible.mode", 0);

// Extension preferences

// Enables some extra Extension System Logging (can reduce performance)
pref("extensions.logging.enabled", false);

// Blocklist preferences
pref("extensions.blocklist.enabled", true);
pref("extensions.blocklist.interval", 86400);
pref("extensions.blocklist.url", "https://addons.mozilla.org/blocklist/3/%APP_ID%/%APP_VERSION%/%PRODUCT%/%BUILD_ID%/%BUILD_TARGET%/%LOCALE%/%CHANNEL%/%OS_VERSION%/%DISTRIBUTION%/%DISTRIBUTION_VERSION%/%PING_COUNT%/");
pref("extensions.blocklist.detailsURL", "https://www.mozilla.com/%LOCALE%/blocklist/");

// Symmetric (can be overridden by individual extensions) update preferences.
// e.g.
//  extensions.{GUID}.update.enabled
//  extensions.{GUID}.update.url
//  extensions.{GUID}.update.interval
//  .. etc ..
//
pref("extensions.update.enabled", true);
pref("extensions.update.url", "https://versioncheck.addons.mozilla.org/update/VersionCheck.php?reqVersion=%REQ_VERSION%&id=%ITEM_ID%&version=%ITEM_VERSION%&maxAppVersion=%ITEM_MAXAPPVERSION%&status=%ITEM_STATUS%&appID=%APP_ID%&appVersion=%APP_VERSION%&appOS=%APP_OS%&appABI=%APP_ABI%&locale=%APP_LOCALE%&currentAppVersion=%CURRENT_APP_VERSION%&updateType=%UPDATE_TYPE%");
pref("extensions.update.interval", 86400);  // Check for updates to Extensions and 
                                            // Themes every day

// Preferences for AMO integration
pref("extensions.getAddons.cache.enabled", true);
pref("extensions.getAddons.maxResults", 15);
pref("extensions.getAddons.get.url", "https://services.addons.mozilla.org/%LOCALE%/%APP%/api/%API_VERSION%/search/guid:%IDS%");
pref("extensions.getAddons.search.browseURL", "https://addons.mozilla.org/%LOCALE%/%APP%/search?q=%TERMS%");
pref("extensions.getAddons.search.url", "https://services.addons.mozilla.org/%LOCALE%/%APP%/api/%API_VERSION%/search/%TERMS%/all/%MAX_RESULTS%/%OS%/%VERSION%");
pref("extensions.webservice.discoverURL", "https://services.addons.mozilla.org/%LOCALE%/%APP%/discovery/%VERSION%/%OS%");

// getMoreThemes is used by our UI under our switch theme menu
pref("extensions.getMoreThemesURL", "chrome://branding/locale/brand.properties");
pref("extensions.dss.enabled", false);          // Dynamic Skin Switching
pref("extensions.dss.switchPending", false);    // Non-dynamic switch pending after next
                                                // restart.

pref("xpinstall.enabled", true);
pref("xpinstall.whitelist.add", "addons.mozilla.org");
pref("xpinstall.whitelist.add.36", "getpersonas.com");

pref("lightweightThemes.update.enabled", true);

// Customizable toolbar stuff
pref("custtoolbar.personal_toolbar_folder", "");
// Use a popup window for the customize toolbar UI
pref("toolbar.customization.usesheet", false);

pref("sidebar.customize.all_panels.url", "http://sidebar-rdf.netscape.com/%LOCALE%/sidebar-rdf/%SIDEBAR_VERSION%/all-panels.rdf");
pref("sidebar.customize.directory.url", "http://dmoz.org/Netscape/Sidebar/");
pref("sidebar.customize.more_panels.url", "http://dmoz.org/Netscape/Sidebar/");
pref("sidebar.num_tabs_in_view", 8);

pref("browser.throbber.url","chrome://navigator-region/locale/region.properties");

// pref to control the alert notification 
pref("alerts.slideIncrement", 1);
pref("alerts.slideIncrementTime", 10);
pref("alerts.totalOpenTime", 4000);

// 0 opens the download manager
// 1 opens a progress dialog
// 2 and other values, no download manager, no progress dialog. 
pref("browser.download.manager.behavior", 0);

pref("privacy.popups.sound_enabled",              false);
pref("privacy.popups.sound_type",                 1);
pref("privacy.popups.sound_url",                  "");
pref("privacy.popups.statusbar_icon_enabled",     true);
pref("privacy.popups.prefill_whitelist",          false);
pref("privacy.popups.remove_blacklist",           true);
pref("privacy.popups.showBrowserMessage",         true);

// sanitize (clear private data) options
pref("privacy.item.history",     true);
pref("privacy.item.urlbar",      true);
pref("privacy.item.formdata",    true);
pref("privacy.item.passwords",   false);
pref("privacy.item.downloads",   true);
pref("privacy.item.cookies",     false);
pref("privacy.item.cache",       true);
pref("privacy.item.sessions",    true);
pref("privacy.item.offlineApps", false);

pref("privacy.sanitize.sanitizeOnShutdown", false);
pref("privacy.sanitize.promptOnSanitize", true);

// Show XUL error pages instead of alerts for errors
pref("browser.xul.error_pages.enabled", true);
pref("browser.xul.error_pages.expert_bad_cert", false);

// Setting this pref to |true| forces BiDi UI menu items and keyboard shortcuts
// to be exposed. By default, only expose it for bidi-associated system locales.
pref("bidi.browser.ui", false);

// block popup windows
pref("dom.disable_open_during_load",   true);
// prevent JS from moving/resizing existing windows
pref("dom.disable_window_move_resize", true);
// prevent JS from raising or lowering windows
pref("dom.disable_window_flip",        true);
// prevent JS from disabling or replacing context menus
pref("dom.event.contextmenu.enabled",  true);

// The default for this pref reflects whether the build is capable of IPC.
// (Turning it on in a no-IPC build will have no effect.)
#ifdef XP_MACOSX
// i386 IPC preferences
pref("dom.ipc.plugins.enabled.i386", false);
pref("dom.ipc.plugins.enabled.i386.flash player.plugin", true);
pref("dom.ipc.plugins.enabled.i386.javaplugin2_npapi.plugin", true);
// ppc IPC preferences, ppc is not capable of IPC
pref("dom.ipc.plugins.enabled.ppc", false);
#elifdef MOZ_IPC
pref("dom.ipc.plugins.enabled", true);
#else
pref("dom.ipc.plugins.enabled", false);
#endif

// plugin finder service url
pref("pfs.datasource.url", "https://pfs.mozilla.org/plugins/PluginFinderService.php?mimetype=%PLUGIN_MIMETYPE%&appID=%APP_ID%&appVersion=%APP_VERSION%&clientOS=%CLIENT_OS%&chromeLocale=%CHROME_LOCALE%");
pref("plugins.hide_infobar_for_missing_plugin", false);

#ifdef XP_MACOSX
// determines the behavior upon starting a download.
//  0 - open the download manager
//  1 - open a progress dialog
//  2 - do nothing

pref("browser.download.manager.behavior", 1);

// Turn on click-and-hold contextual menus
pref("ui.click_hold_context_menus", true);

// Use a sheet instead of a popup window for the customize toolbar UI
pref("toolbar.customization.usesheet", true);
#endif

#ifndef XP_MACOSX
#ifdef XP_UNIX
// For the download dialog
pref("browser.download.progressDnldDialog.enable_launch_reveal_buttons", false);
pref("browser.urlbar.clickSelectsAll", false);

// 0 goes back
// 1 act like pgup
// 2 and other values, nothing
pref("browser.backspace_action", 2);

pref("general.autoScroll", false);

pref("layout.word_select.stop_at_punctuation", false);
#endif
#endif

// The breakpad report server to link to in about:crashes
pref("breakpad.reportURL", "http://crash-stats.mozilla.com/report/index/");

// Name of alternate about: page for certificate errors (when undefined, defaults to about:neterror)
pref("security.alternate_certificate_error_page", "certerror");

// FAQ URLs
pref("browser.geolocation.warning.infoURL", "http://www.seamonkey-project.org/doc/2.0/geolocation");

pref("browser.rights.version", 1);
pref("browser.rights.1.shown", false);

#ifdef DEBUG
// Don't show the about:rights notification in debug builds.
pref("browser.rights.override", true);
#elifndef OFFICIAL_BUILD
// Don't show the about:rights notification in non-official builds.
pref("browser.rights.override", true);
#endif
