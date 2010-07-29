# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is mozilla.org code.
#
# The Initial Developer of the Original Code is
# Netscape Communications Corporation.
# Portions created by the Initial Developer are Copyright (C) 1998
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#   Blake Ross <blake@cs.stanford.edu>
#   David Hyatt <hyatt@mozilla.org>
#   Peter Annema <disttsc@bart.nl>
#   Dean Tessman <dean_tessman@hotmail.com>
#   Kevin Puetz <puetzk@iastate.edu>
#   Ben Goodger <ben@netscape.com>
#   Pierre Chanial <chanial@noos.fr>
#   Jason Eager <jce2@po.cwru.edu>
#   Joe Hewitt <hewitt@netscape.com>
#   Alec Flett <alecf@netscape.com>
#   Asaf Romano <mozilla.mano@sent.com>
#   Jason Barnabe <jason_barnabe@fastmail.fm>
#   Peter Parente <parente@cs.unc.edu>
#   Giorgio Maone <g.maone@informaction.com>
#   Tom Germeau <tom.germeau@epigoon.com>
#   Jesse Ruderman <jruderman@gmail.com>
#   Joe Hughes <joe@retrovirus.com>
#   Pamela Greene <pamg.bugs@gmail.com>
#   Michael Ventnor <ventnors_dogs234@yahoo.com.au>
#   Simon Bünzli <zeniko@gmail.com>
#   Gijs Kruitbosch <gijskruitbosch@gmail.com>
#   Ehsan Akhgari <ehsan.akhgari@gmail.com>
#   Dan Mosedale <dmose@mozilla.org>
#   Justin Dolske <dolske@mozilla.com>
#   Florian Queze <florian@instantbird.org>
#
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK *****

var gContextMenu = null;

function nsContextMenu(aXulMenu, aBrowser) {
  this.target            = null;
  this.browser           = null;
  this.menu              = null;
  this.onLink            = false;
  this.onMailtoLink      = false;
  this.onSaveableLink    = false;
  this.link              = false;
  this.linkURL           = "";
  this.linkURI           = null;
  this.linkProtocol      = null;
  this.isTextSelected    = false;
  this.isContentSelected = false;
  this.shouldDisplay     = true;
  this.ellipsis = "\u2026";

  try {
    this.ellipsis = gPrefService.getComplexValue("intl.ellipsis",
                                                 Ci.nsIPrefLocalizedString).data;
  } catch (e) { }

  // Initialize new menu.
  this.initMenu(aXulMenu, aBrowser);
}

// Prototype for nsContextMenu "class."
nsContextMenu.prototype = {
  // Initialize context menu.
  initMenu: function CM_initMenu(aPopup, aBrowser) {
    this.menu = aPopup;
    this.browser = aBrowser;

    // Get contextual info.
    this.setTarget(document.popupNode);

    this.isTextSelected = this.isTextSelection();
    this.isContentSelected = this.isContentSelection();

    // Initialize (disable/remove) menu items.
    // Open/Save/Send link depends on whether we're in a link.
    var shouldShow = this.onSaveableLink;
    this.showItem("context-openlink", shouldShow);
    this.showItem("context-sep-open", shouldShow);
    this.showItem("context-savelink", shouldShow);

    this.showItem("context-searchselect", this.isTextSelected);
    this.showItem("context-searchselect-with", this.isTextSelected);

    // Copy depends on whether there is selected text.
    // Enabling this context menu item is now done through the global
    // command updating system
    goUpdateGlobalEditMenuItems();

    this.showItem("context-copy", this.isContentSelected);
    this.showItem("context-selectall", !this.onLink || this.isContentSelected);
    this.showItem("context-sep-selectall", this.isTextSelected);

    // Copy email link depends on whether we're on an email link.
    this.showItem("context-copyemail", this.onMailtoLink);

    // Copy link location depends on whether we're on a non-mailto link.
    this.showItem("context-copylink", this.onLink && !this.onMailtoLink);
    this.showItem("context-sep-copylink", this.onLink && this.isContentSelected);
  },

  // Set various context menu attributes based on the state of the world.
  setTarget: function (aNode) {

    // Initialize contextual info.
    this.onLink            = false;
    this.linkURL           = "";
    this.linkURI           = null;
    this.linkProtocol      = "";

    // Remember the node that was clicked.
    this.target = aNode;

    // First, do checks for nodes that never have children.
    // Second, bubble out, looking for items of interest that can have childen.
    // Always pick the innermost link, background image, etc.
    const XMLNS = "http://www.w3.org/XML/1998/namespace";
    var elem = this.target;
    while (elem) {
      if (elem.nodeType == Node.ELEMENT_NODE) {
        // Link?
        if (!this.onLink &&
             ((elem instanceof HTMLAnchorElement && elem.href) ||
              (elem instanceof HTMLAreaElement && elem.href) ||
              elem instanceof HTMLLinkElement ||
              elem.getAttributeNS("http://www.w3.org/1999/xlink", "type") == "simple")) {

          // Target is a link or a descendant of a link.
          this.onLink = true;

          // xxxmpc: this is kind of a hack to work around a Gecko bug (see bug 266932)
          // we're going to walk up the DOM looking for a parent link node,
          // this shouldn't be necessary, but we're matching the existing behaviour for left click
          var realLink = elem;
          var parent = elem;
          while ((parent = parent.parentNode) &&
                 (parent.nodeType == Node.ELEMENT_NODE)) {
            try {
              if ((parent instanceof HTMLAnchorElement && parent.href) ||
                  (parent instanceof HTMLAreaElement && parent.href) ||
                  parent instanceof HTMLLinkElement ||
                  parent.getAttributeNS("http://www.w3.org/1999/xlink", "type") == "simple")
                realLink = parent;
            } catch (e) { }
          }

          // Remember corresponding element.
          this.link = realLink;
          this.linkURL = this.getLinkURL();
          this.linkURI = this.getLinkURI();
          this.linkProtocol = this.getLinkProtocol();
          this.onMailtoLink = (this.linkProtocol == "mailto");
          this.onSaveableLink = this.isLinkSaveable(this.link);
        }
      }

      elem = elem.parentNode;
    }
  },

  // Returns true if clicked-on link targets a resource that can be saved.
  isLinkSaveable: function(aLink) {
    return this.linkProtocol && !(
             this.linkProtocol == "mailto"     ||
             this.linkProtocol == "javascript" ||
             this.linkProtocol == "news"       ||
             this.linkProtocol == "snews"      );
  },

  openEngineManager: function() {
    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                       .getService(Components.interfaces.nsIWindowMediator);
    var window = wm.getMostRecentWindow("Browser:SearchManager");
    if (window)
      window.focus();
    else {
      openDialog("chrome://instantbird/content/engineManager.xul",
                 "_blank", "chrome,dialog,modal,centerscreen");
    }
  },

  buildSearchEngineList: function() {
    let popup = document.getElementById("context-popup-searchselect-with");
    // remove the menuitems added last time we opened the popup
    while (popup.firstChild && popup.firstChild.localName != "menuseparator")
      popup.removeChild(popup.firstChild);

    let engines = Components.classes["@mozilla.org/browser/search-service;1"]
                            .getService(Ci.nsIBrowserSearchService)
                            .getVisibleEngines({});

    for (let i = engines.length - 1; i >= 0; --i) {
      let menuitem = document.createElement("menuitem");
      let name = engines[i].name;
      menuitem.setAttribute("label", name);
      menuitem.setAttribute("class", "menuitem-iconic");
      if (engines[i].iconURI)
        menuitem.setAttribute("src", engines[i].iconURI.spec);
      popup.insertBefore(menuitem, popup.firstChild);
      menuitem.engine = engines[i];
    }
  },

  searchSelectionWith: function(aEvent) {
    var engine = aEvent.originalTarget.engine;
    if (engine)
      this.searchSelection(engine);
  },

  searchSelection: function(aEngine) {
    if (!aEngine) {
      aEngine = Cc["@mozilla.org/browser/search-service;1"].
                getService(Ci.nsIBrowserSearchService).
                defaultEngine;
    }

    var submission = aEngine.getSubmission(getBrowserSelection(), null);
    // getSubmission can return null if the engine doesn't have a URL
    // with a text/html response type.  This is unlikely (since
    // SearchService._addEngineToStore() should fail for such an engine),
    // but let's be on the safe side.
    if (!submission)
      return;

    gExtProtoService.loadURI(submission.uri, window);
  },

  // Open linked-to URL in a new window.
  openLink: function () {
    gExtProtoService.loadURI(this.linkURI, window);
  },

  // Generate email address and put it on clipboard.
  copyEmail: function() {
    // Copy the comma-separated list of email addresses only.
    // There are other ways of embedding email addresses in a mailto:
    // link, but such complex parsing is beyond us.
    var url = this.linkURL;
    var qmark = url.indexOf("?");
    var addresses;

    // 7 == length of "mailto:"
    addresses = qmark > 7 ? url.substring(7, qmark) : url.substr(7);

    // Let's try to unescape it using a character set
    // in case the address is not ASCII.
    try {
      var characterSet = this.target.ownerDocument.characterSet;
      const textToSubURI = Cc["@mozilla.org/intl/texttosuburi;1"].
                           getService(Ci.nsITextToSubURI);
      addresses = textToSubURI.unEscapeURIForUI(characterSet, addresses);
    }
    catch(ex) {
      // Do nothing.
    }

    var clipboard = Cc["@mozilla.org/widget/clipboardhelper;1"].
                    getService(Ci.nsIClipboardHelper);
    clipboard.copyString(addresses);
  },

  ///////////////
  // Utilities //
  ///////////////

  // Show/hide one item (specified via name or the item element itself).
  showItem: function(aItemOrId, aShow) {
    var item = aItemOrId.constructor == String ?
      document.getElementById(aItemOrId) : aItemOrId;
    if (item)
      item.hidden = !aShow;
  },

  // Temporary workaround for DOM api not yet implemented by XUL nodes.
  cloneNode: function(aItem) {
    // Create another element like the one we're cloning.
    var node = document.createElement(aItem.tagName);

    // Copy attributes from argument item to the new one.
    var attrs = aItem.attributes;
    for (var i = 0; i < attrs.length; i++) {
      var attr = attrs.item(i);
      node.setAttribute(attr.nodeName, attr.nodeValue);
    }

    // Voila!
    return node;
  },

  // Generate fully qualified URL for clicked-on link.
  getLinkURL: function() {
    var href = this.link.href;
    if (href)
      return href;

    href = this.link.getAttributeNS("http://www.w3.org/1999/xlink",
                                    "href");

    if (!href || !href.match(/\S/)) {
      // Without this we try to save as the current doc,
      // for example, HTML case also throws if empty
      throw "Empty href";
    }

    return makeURLAbsolute(this.link.baseURI, href);
  },

  getLinkURI: function() {
    var ioService = Cc["@mozilla.org/network/io-service;1"].
                    getService(Ci.nsIIOService);
    try {
      return ioService.newURI(this.linkURL, null, null);
    }
    catch (ex) {
     // e.g. empty URL string
    }

    return null;
  },

  getLinkProtocol: function() {
    if (this.linkURI)
      return this.linkURI.scheme; // can be |undefined|

    return null;
  },

  // Get text of link.
  linkText: function() {
    var text = gatherTextUnder(this.link);
    if (!text || !text.match(/\S/)) {
      text = this.link.getAttribute("title");
      if (!text || !text.match(/\S/)) {
        text = this.link.getAttribute("alt");
        if (!text || !text.match(/\S/))
          text = this.linkURL;
      }
    }

    return text;
  },

  // Get selected text. Only display the first 15 chars.
  isTextSelection: function() {
    // Get 16 characters, so that we can trim the selection if it's greater
    // than 15 chars
    var selectedText = getBrowserSelection(16);

    if (!selectedText)
      return false;

    if (selectedText.length > 15)
      selectedText = selectedText.substr(0,15) + this.ellipsis;

    var engine = Cc["@mozilla.org/browser/search-service;1"].
                 getService(Ci.nsIBrowserSearchService).
                 defaultEngine;
    if (!engine)
      return false;

    // format "Search <engine> for <selection>" string to show in menu
    var bundle = document.getElementById("bundle_instantbird");
    var menuLabel = bundle.getFormattedString("contextMenuSearchText",
                                              [engine.name,
                                               selectedText]);
    document.getElementById("context-searchselect").label = menuLabel;
    document.getElementById("context-searchselect").accessKey =
      bundle.getString("contextMenuSearchText.accesskey");
    menuLabel = bundle.getFormattedString("contextMenuSearchWith",
                                          [selectedText]);
    document.getElementById("context-searchselect-with").label = menuLabel;

    return true;
  },

  // Returns true if anything is selected.
  isContentSelection: function() {
    return !document.commandDispatcher.focusedWindow.getSelection().isCollapsed;
  }
};

/**
 * Gets the selected text in the active browser. Leading and trailing
 * whitespace is removed, and consecutive whitespace is replaced by a single
 * space. A maximum of 150 characters will be returned, regardless of the value
 * of aCharLen.
 *
 * @param aCharLen
 *        The maximum number of characters to return.
 */
function getBrowserSelection(aCharLen) {
  // selections of more than 150 characters aren't useful
  const kMaxSelectionLen = 150;
  const charLen = Math.min(aCharLen || kMaxSelectionLen, kMaxSelectionLen);

  var focusedWindow = document.commandDispatcher.focusedWindow;
  var selection = focusedWindow.getSelection().toString();

  if (selection) {
    if (selection.length > charLen) {
      // only use the first charLen important chars. see bug 221361
      var pattern = new RegExp("^(?:\\s*.){0," + charLen + "}");
      pattern.test(selection);
      selection = RegExp.lastMatch;
    }

    selection = selection.replace(/^\s+/, "")
                         .replace(/\s+$/, "")
                         .replace(/\s+/g, " ");

    if (selection.length > charLen)
      selection = selection.substr(0, charLen);
  }
  return selection;
}
