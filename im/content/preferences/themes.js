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
 * The Original Code is the Instantbird messenging client, released
 * 2009.
 *
 * The Initial Developer of the Original Code is
 * Florian QUEZE <florian@instantbird.org>.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

Components.utils.import("resource://gre/modules/AddonManager.jsm");  

const PREF_EXTENSIONS_GETMOREMESSAGESTYLESURL = "extensions.getMoreMessageStylesURL";
const PREF_EXTENSIONS_GETMOREEMOTICONSURL     = "extensions.getMoreEmoticonsURL";

var gThemePane = {
  init: function (){
    AddonManager.getAllAddons(function(aAddons) {
      gThemePane.extensionList = aAddons;
      previewObserver.load();
      smileysPreview.load();
    });
    gThemePane.setGetMore("Emoticons");
    gThemePane.setGetMore("MessageStyles");
  },

  /* Set the correct URL for the "Get more ..."-links */
  setGetMore: function (aType){
    var prefURL;
    switch(aType){
      case "Emoticons":
        prefURL = PREF_EXTENSIONS_GETMOREEMOTICONSURL;
        break;
      case "MessageStyles":
        prefURL = PREF_EXTENSIONS_GETMOREMESSAGESTYLESURL;
        break;
      default:
        return;
    }

    var getMore = document.getElementById("getMore" + aType);
    var showGetMore = false;
    const nsIPrefBranch2 = Components.interfaces.nsIPrefBranch2;

    if (Components.classes["@mozilla.org/preferences-service;1"]
                  .getService(nsIPrefBranch2)
                  .getPrefType(prefURL) != nsIPrefBranch2.PREF_INVALID) {
      try {
        var getMoreURL = Components.classes["@mozilla.org/toolkit/URLFormatterService;1"]
                                   .getService(Components.interfaces.nsIURLFormatter)
                                   .formatURLPref(prefURL);
        getMore.setAttribute("getMoreURL", getMoreURL);
        showGetMore = getMoreURL != "about:blank";
      }
      catch (e) { }
    }
    getMore.hidden = !showGetMore;
  },

  // Get extension list (slow) and cache it for use by messagestyle.js and smileys.js
  getExtensionList: function () {
    if (!this.extensionList)
      throw "The add-ons list should be loaded by now...";
    return this.extensionList;
  }
};
