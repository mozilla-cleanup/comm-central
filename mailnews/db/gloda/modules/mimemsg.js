/* ***** BEGIN LICENSE BLOCK *****
 *   Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * The Original Code is Thunderbird Global Database.
 *
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Andrew Sutherland <asutherland@asutherland.org>
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

const EXPORTED_SYMBOLS = ['MsgHdrToMimeMessage',
                          'MimeMessage', 'MimeContainer',
                          'MimeBody', 'MimeUnknown',
                          'MimeMessageAttachment'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const EMITTER_MIME_CODE = "application/x-js-mime-message";

/**
 * The URL listener is surplus because the CallbackStreamListener ends up
 *  getting the same set of events, effectively.
 */
let dumbUrlListener = {
  OnStartRunningUrl: function (aUrl) {
  },
  OnStopRunningUrl: function (aUrl, aExitCode) {
  },
};

/**
 * Maintain a list of all active stream listeners so that we can cancel them all
 *  during shutdown.  If we don't cancel them, we risk calls into javascript
 *  from C++ after the various XPConnect contexts have already begun their
 *  teardown process.
 */
let activeStreamListeners = {};

let shutdownCleanupObserver = {
  _initialized: false,
  ensureInitialized: function mimemsg_shutdownCleanupObserver_init() {
    if (this._initialized)
      return;

    Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService)
      .addObserver(this, "quit-application", false);

    this._initialized = true;
  },

  observe: function mimemsg_shutdownCleanupObserver_observe(
      aSubject, aTopic, aData) {
    if (aTopic == "quit-application") {
      Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService)
        .removeObserver(this, "quit-application");

      for each (let [, streamListener] in
                Iterator(activeStreamListeners)) {
        if (streamListener._request)
          streamListener._request.cancel(Cr.NS_BINDING_ABORTED);
      }
    }
  }
};

function CallbackStreamListener(aMsgHdr, aCallbackThis, aCallback) {
  this._msgHdr = aMsgHdr;
  let hdrURI = aMsgHdr.folder.getUriForMsg(aMsgHdr);
  this._request = null;
  this._stream = null;
  if (aCallback === undefined) {
    this._callbacksThis = [null];
    this._callbacks = [aCallbackThis];
  }
  else {
    this._callbacksThis = [aCallbackThis];
    this._callbacks =[aCallback];
  }
  activeStreamListeners[hdrURI] = this;
}

CallbackStreamListener.prototype = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIStreamListener]),

  // nsIRequestObserver part
  onStartRequest: function (aRequest, aContext) {
    this._request = aRequest;
  },
  onStopRequest: function (aRequest, aContext, aStatusCode) {
    let msgURI = this._msgHdr.folder.getUriForMsg(this._msgHdr);
    delete activeStreamListeners[msgURI];

    aContext.QueryInterface(Ci.nsIURI);
    let message = MsgHdrToMimeMessage.RESULT_RENDEVOUZ[aContext.spec];
    if (message === undefined)
      message = null;

    delete MsgHdrToMimeMessage.RESULT_RENDEVOUZ[aContext.spec];

    for (let i = 0; i < this._callbacksThis.length; i++) {
      try {
        this._callbacks[i].call(this._callbacksThis[i], this._msgHdr, message);
      } catch (e) {
        // Most of the time, exceptions will silently disappear into the endless
        // deeps of XPConnect, and never reach the surface ever again. At least
        // warn the user if he has dump enabled.
        dump("The MsgHdrToMimeMessage callback threw an exception: "+e+"\n");
        // That one will probably never make it to the original caller.
        throw(e);
      }
    }

    this._msgHdr = null;
    this._request = null;
    this._stream = null;
    this._callbacksThis = null;
    this._callbacks = null;
  },

  /* okay, our onDataAvailable should actually never be called.  the stream
     converter is actually eating everything except the start and stop
     notification. */
  // nsIStreamListener part
  onDataAvailable: function (aRequest,aContext,aInputStream,aOffset,aCount) {
    dump("this should not be happening! arrgggggh!\n");
    if (this._stream === null) {
      this._stream = Cc["@mozilla.org/scriptableinputstream;1"].
                    createInstance(Ci.nsIScriptableInputStream);
      this._stream.init(aInputStream);
    }
    this._stream.read(aCount);

  },
};

let gMessenger = Cc["@mozilla.org/messenger;1"].
                   createInstance(Ci.nsIMessenger);

/**
 * Starts retrieval of a MimeMessage instance for the given message header.
 *  Your callback will be called with the message header you provide and the
 *
 * @param aMsgHdr The message header to retrieve the body for and build a MIME
 *     representation of the message.
 * @param aCallbackThis The (optional) 'this' to use for your callback function.
 * @param aCallback The callback function to invoke on completion of message
 *     parsing or failure.  The first argument passed will be the nsIMsgDBHdr
 *     you passed to this function.  The second argument will be the MimeMessage
 *     instance resulting from the processing on success, and null on failure.
 * @param [aAllowDownload=false] Should we allow the message to be downloaded
 *     for this streaming request?  The default is false, which means that we
 *     require that the message be available offline.  If false is passed and
 *     the message is not available offline, we will propagate an exception
 *     thrown by the underlying code.
 * @param [aOptions] Optional options.
 * @param [aOptions.saneBodySize] Limit body sizes to a 'reasonable' size in
 *     order to combat corrupt offline/message stores creating pathological
 *     situtations where we have erroneously multi-megabyte messages.  This
 *     also likely reduces the impact of legitimately ridiculously large
 *     messages.
 */
function MsgHdrToMimeMessage(aMsgHdr, aCallbackThis, aCallback,
                             aAllowDownload, aOptions) {
  shutdownCleanupObserver.ensureInitialized();

  let requireOffline = !aAllowDownload;

  let msgURI = aMsgHdr.folder.getUriForMsg(aMsgHdr);
  let msgService = gMessenger.messageServiceFromURI(msgURI);

  MsgHdrToMimeMessage.OPTION_TUNNEL = aOptions;

  // if we're already streaming this msg, just add the callback
  // to the listener.
  let listenerForURI = activeStreamListeners[msgURI];
  if (listenerForURI != undefined) {
    listenerForURI._callbacks.push(aCallback ? aCallback : aCallbackThis);
    listenerForURI._callbacksThis.push(aCallback ? aCallbackThis : null);
    return;
  }
  let streamListener = new CallbackStreamListener(aMsgHdr,
                                                  aCallbackThis, aCallback);

  try {
    let streamURI = msgService.streamMessage(
      msgURI,
      streamListener, // consumer
      null, // nsIMsgWindow
      dumbUrlListener, // nsIUrlListener
      true, // have them create the converter
      // additional uri payload, note that "header=" is prepended automatically
      "filter&emitter=js",
      requireOffline);
  } catch (ex) {
    // If streamMessage throws an exception, we should make sure to clear the
    // activeStreamListener, or any subsequent attempt at sreaming this URI
    // will silently fail
    if (activeStreamListeners[msgURI]) {
      delete activeStreamListeners[msgURI];
    }
    MsgHdrToMimeMessage.OPTION_TUNNEL = null;
    throw(ex);
  }

  MsgHdrToMimeMessage.OPTION_TUNNEL = null;
}

/**
 * Let the jsmimeemitter provide us with results.  The poor emitter (if I am
 *  understanding things correctly) is evaluated outside of the C.u.import
 *  world, so if we were to import him, we would not see him, but rather a new
 *  copy of him.  This goes for his globals, etc.  (and is why we live in this
 *  file right here).  Also, it appears that the XPCOM JS wrappers aren't
 *  magically unified so that we can try and pass data as expando properties
 *  on things like the nsIUri instances either.  So we have the jsmimeemitter
 *  import us and poke things into RESULT_RENDEVOUZ.  We put it here on this
 *  function to try and be stealthy and avoid polluting the namespaces (or
 *  encouraging bad behaviour) of our importers.
 *
 * If you can come up with a prettier way to shuttle this data, please do.
 */
MsgHdrToMimeMessage.RESULT_RENDEVOUZ = {};
/**
 * Cram rich options here for the MimeMessageEmitter to grab from.  We
 *  leverage the known control-flow to avoid needing a whole dictionary here.
 *  We set this immediately before constructing the emitter and clear it
 *  afterwards.  Control flow is never yielded during the process and reentrancy
 *  cannot happen via any other means.
 */
MsgHdrToMimeMessage.OPTION_TUNNEL = null;

let HeaderHandlerBase = {
  /**
   * Look-up a header that should be present at most once.
   *
   * @param aHeaderName The header name to retrieve, case does not matter.
   * @param aDefaultValue The value to return if the header was not found, null
   *     if left unspecified.
   * @return the value of the header if present, and the default value if not
   *  (defaults to null).  If the header was present multiple times, the first
   *  instance of the header is returned.  Use getAll if you want all of the
   *  values for the multiply-defined header.
   */
  get: function MimeMessage_get(aHeaderName, aDefaultValue) {
    if (aDefaultValue === undefined) {
      aDefaultValue = null;
    }
    let lowerHeader = aHeaderName.toLowerCase();
    if (lowerHeader in this.headers)
      // we require that the list cannot be empty if present
      return this.headers[lowerHeader][0];
    else
      return aDefaultValue;
  },
  /**
   * Look-up a header that can be present multiple times.  Use get for headers
   *  that you only expect to be present at most once.
   *
   * @param aHeaderName The header name to retrieve, case does not matter.
   * @return An array containing the values observed, which may mean a zero
   *     length array.
   */
  getAll: function MimeMessage_getAll(aHeaderName) {
    let lowerHeader = aHeaderName.toLowerCase();
    if (lowerHeader in this.headers)
      return this.headers[lowerHeader];
    else
      return [];
  },
  /**
   * @param aHeaderName Header name to test for its presence.
   * @return true if the message has (at least one value for) the given header
   *     name.
   */
  has: function MimeMessage_has(aHeaderName) {
    let lowerHeader = aHeaderName.toLowerCase();
    return lowerHeader in this.headers;
  },
  _prettyHeaderString: function MimeMessage__prettyHeaderString(aIndent) {
    if (aIndent === undefined)
      aIndent = "";
    let s = "";
    for each (let [header, values] in Iterator(this.headers)) {
      s += "\n        " + aIndent + header + ": " + values;
    }
    return s;
  }
};

/**
 * @ivar partName The MIME part, ex "1.2.2.1".  The partName of a (top-level)
 *     message is "1", its first child is "1.1", its second child is "1.2",
 *     its first child's first child is "1.1.1", etc.
 * @ivar headers Maps lower-cased header field names to a list of the values
 *     seen for the given header.  Use get or getAll as convenience helpers.
 * @ivar parts The list of the MIME part children of this message.  Children
 *     will be either MimeMessage instances, MimeMessageAttachment instances,
 *     MimeContainer instances, or MimeUnknown instances.  The latter two are
 *     the result of limitations in the Javascript representation generation
 *     at this time, combined with the need to most accurately represent the
 *     MIME structure.
 */
function MimeMessage() {
  this.partName = null;
  this.headers = {};
  this.parts = [];
}

MimeMessage.prototype = {
  __proto__: HeaderHandlerBase,
  contentType: "message/rfc822",

  /**
   * @return a list of all attachments contained in this message and all its
   *     sub-messages.  Only MimeMessageAttachment instances will be present in
   *     the list (no sub-messages).
   */
  get allAttachments() {
    let results = []; // messages are not attachments, don't include self
    for (let iChild = 0; iChild < this.parts.length; iChild++) {
      let child = this.parts[iChild];
      results = results.concat(child.allAttachments);
    }
    return results;
  },

  /**
   * @return a list of all attachments contained in this message, with
   *    included/forwarded messages treated as real attachments. Attachments
   *    contained in inner messages won't be shown.
   */
  get allUserAttachments() {
    if (this.url)
      // The jsmimeemitter camouflaged us as a MimeAttachment
      return [this];
    else
      // Why is there no flatten method for arrays?
      return [child.allUserAttachments for each ([, child] in Iterator(this.parts))]
        .reduce(function (a, b) a.concat(b), []);
  },

  /**
   * @return the total size of this message, that is, the size of all subparts
   */
  get size () {
    return [child.size for each ([, child] in Iterator(this.parts))]
      .reduce(function (a, b) a + Math.max(b, 0), 0);
  },

  /**
   * In the case of attached messages, libmime considers them as attachments,
   * and if the body is, say, quoted-printable encoded, then libmime will start
   * counting bytes and notify the js mime emitter about it. The JS mime emitter
   * being a nice guy, it will try to set a size on us. While this is the
   * expected behavior for MimeMsgAttachments, we must make sure we can handle
   * that (failing to write a setter results in exceptions being thrown).
   */
  set size (whatever) {
    // nop
  },

  /**
   * @param aMsgFolder A message folder, any message folder.  Because this is
   *    a hack.
   * @return The concatenation of all of the body parts where parts
   *    available as text/plain are pulled as-is, and parts only available
   *    as text/html are converted to plaintext form first.  In other words,
   *    if we see a multipart/alternative with a text/plain, we take the
   *    text/plain.  If we see a text/html without an alternative, we convert
   *    that to text.
   */
  coerceBodyToPlaintext:
      function MimeMessage_coerceBodyToPlaintext(aMsgFolder) {
    let bodies = [];
    for each (let [, part] in Iterator(this.parts)) {
      // an undefined value for something not having the method is fine
      let body = part.coerceBodyToPlaintext &&
                 part.coerceBodyToPlaintext(aMsgFolder);
      if (body)
        bodies.push(body);
    }
    if (bodies)
      return bodies.join("");
    else
      return "";
  },

  /**
   * Convert the message and its hierarchy into a "pretty string".  The message
   *  and each MIME part get their own line.  The string never ends with a
   *  newline.  For a non-multi-part message, only a single line will be
   *  returned.
   * Messages have their subject displayed, attachments have their filename and
   *  content-type (ex: image/jpeg) displayed.  "Filler" classes simply have
   *  their class displayed.
   */
  prettyString: function MimeMessage_prettyString(aVerbose, aIndent,
                                                  aDumpBody) {
    if (aIndent === undefined)
      aIndent = "";
    let nextIndent = aIndent + "  ";

    let s = "Message (" + this.size + " bytes): " + this.headers.subject;
    if (aVerbose)
      s += this._prettyHeaderString(nextIndent);

    for (let iPart = 0; iPart < this.parts.length; iPart++) {
      let part = this.parts[iPart];
      s += "\n" + nextIndent + (iPart+1) + " " +
        part.prettyString(aVerbose, nextIndent, aDumpBody);
    }

    return s;
  },
};


/**
 * @ivar contentType The content-type of this container.
 * @ivar parts The parts held by this container.  These can be instances of any
 *      of the classes found in this file.
 */
function MimeContainer(aContentType) {
  this.partName = null;
  this.contentType = aContentType;
  this.headers = {};
  this.parts = [];
}

MimeContainer.prototype = {
  __proto__: HeaderHandlerBase,
  get allAttachments() {
    let results = [];
    for (let iChild = 0; iChild < this.parts.length; iChild++) {
      let child = this.parts[iChild];
      results = results.concat(child.allAttachments);
    }
    return results;
  },
  get allUserAttachments () {
    return [child.allUserAttachments for each ([, child] in Iterator(this.parts))]
      .reduce(function (a, b) a.concat(b), []);
  },
  get size () {
    return [child.size for each ([, child] in Iterator(this.parts))]
      .reduce(function (a, b) a + Math.max(b, 0), 0);
  },
  set size (whatever) {
    // nop
  },
  coerceBodyToPlaintext:
      function MimeContainer_coerceBodyToPlaintext(aMsgFolder) {
    if (this.contentType == "multipart/alternative") {
      let htmlPart;
      // pick the text/plain if we can find one, otherwise remember the HTML one
      for each (let [, part] in Iterator(this.parts)) {
        if (part.contentType == "text/plain")
          return part.body;
        if (part.contentType == "text/html")
          htmlPart = part;
        // text/enriched gets transformed into HTML, use it if we don't already
        //  have an HTML part.
        else if (!htmlPart && part.contentType == "text/enriched")
	  htmlPart = part;
      }
      // convert the HTML part if we have one
      if (htmlPart)
        return aMsgFolder.convertMsgSnippetToPlainText(htmlPart.body);
    }
    // if it's not alternative, recurse/aggregate using MimeMessage logic
    return MimeMessage.prototype.coerceBodyToPlaintext.call(this, aMsgFolder);
  },
  prettyString: function MimeContainer_prettyString(aVerbose, aIndent,
                                                    aDumpBody) {
    let nextIndent = aIndent + "  ";

    let s = "Container (" + this.size + " bytes): " + this.contentType;
    if (aVerbose)
      s += this._prettyHeaderString(nextIndent);

    for (let iPart = 0; iPart < this.parts.length; iPart++) {
      let part = this.parts[iPart];
      s += "\n" + nextIndent + (iPart+1) + " " +
        part.prettyString(aVerbose, nextIndent, aDumpBody);
    }

    return s;
  },
  toString: function MimeContainer_toString() {
    return "Container: " + this.contentType;
  }
};

/**
 * @class Represents a body portion that we understand and do not believe to be
 *  a proper attachment.  This means text/plain or text/html and it has no
 *  filename.  (A filename suggests an attachment.)
 *
 * @ivar contentType The content type of this body materal; text/plain or
 *     text/html.
 * @ivar body The actual body content.
 */
function MimeBody(aContentType) {
  this.partName = null;
  this.contentType = aContentType;
  this.headers = {};
  this.body = "";
}

MimeBody.prototype = {
  __proto__: HeaderHandlerBase,
  get allAttachments() {
    return []; // we are a leaf
  },
  get allUserAttachments() {
    return []; // we are a leaf
  },
  get size() {
    return this.body.length;
  },
  set size (whatever) {
    // nop
  },
  coerceBodyToPlaintext:
      function MimeBody_coerceBodyToPlaintext(aMsgFolder) {
    if (this.contentType == "text/plain")
      return this.body;
    // text/enriched gets transformed into HTML by libmime
    if (this.contentType == "text/html" ||
        this.contentType == "text/enriched")
      return aMsgFolder.convertMsgSnippetToPlainText(this.body);
    return "";
  },
  prettyString: function MimeBody_prettyString(aVerbose, aIndent, aDumpBody) {
    let s = "Body: " + this.contentType + " (" + this.body.length + " bytes" +
      (aDumpBody ? (": '" + this.body + "'") : "") + ")";
    if (aVerbose)
      s += this._prettyHeaderString(aIndent + "  ");
    return s;
  },
  toString: function MimeBody_toString() {
    return "Body: " + this.contentType + " (" + this.body.length + " bytes)";
  }
};

/**
 * @class A MIME Leaf node that doesn't have a filename so we assume it's not
 *  intended to be an attachment proper.  This is probably meant for inline
 *  display or is the result of someone amusing themselves by composing messages
 *  by hand or a bad client.  This class should probably be renamed or we should
 *  introduce a better named class that we try and use in preference to this
 *  class.
 *
 * @ivar contentType The content type of this part.
 */
function MimeUnknown(aContentType) {
  this.partName = null;
  this.contentType = aContentType;
  this.headers = {};
  // Looks like libmime does not always intepret us as an attachment, which
  //  means we'll have to have a default size. Returning undefined would cause
  //  the recursive size computations to fail.
  this.size = 0;
}

MimeUnknown.prototype = {
  __proto__: HeaderHandlerBase,
  get allAttachments() {
    return []; // we are a leaf
  },
  get allUserAttachments() {
    return []; // we are a leaf
  },
  prettyString: function MimeUnknown_prettyString(aVerbose, aIndent,
                                                  aDumpBody) {
    let s = "Unknown: " + this.contentType + " (" + this.size + " bytes)";
    if (aVerbose)
      s += this._prettyHeaderString(aIndent + "  ");
    return s;
  },
  toString: function MimeUnknown_toString() {
    return "Unknown: " + this.contentType;
  }
};

const MIME_MSG_DEFAULT_ATTACHMENT_NAME = 1040;
let localizedPartStr;

/**
 * Part names are localized for display purposes; a longer term fix is proposed
 * on bug 554294, although since this will fix that bug, a new bug will likely
 * be filed and referenced by that bug.
 */
function getLocalizedPartStr() {
  let stringBundleService = Cc["@mozilla.org/intl/stringbundle;1"]
                              .getService(Ci.nsIStringBundleService);
  let mimeBundle = stringBundleService.createBundle(
                     "chrome://messenger/locale/mime.properties");
  localizedPartStr = mimeBundle.GetStringFromID(
                       MIME_MSG_DEFAULT_ATTACHMENT_NAME);
}

/**
 * @class An attachment proper.  We think it's an attachment because it has a
 *  filename that libmime was able to figure out.
 *
 * @ivar partName @see{MimeMessage.partName}
 * @ivar name The filename of this attachment.
 * @ivar contentType The MIME content type of this part.
 * @ivar url The URL to stream if you want the contents of this part.
 * @ivar isExternal Is the attachment stored someplace else than in the message?
 * @ivar size The size of the attachment if available, -1 otherwise (size is set
 *  after initialization by jsmimeemitter.js)
 */
function MimeMessageAttachment(aPartName, aName, aContentType, aUrl,
                               aIsExternal) {
  this.partName = aPartName;
  this.name = aName;
  this.contentType = aContentType;
  this.url = aUrl;
  this.isExternal = aIsExternal;
  // parts is copied over from the part instance that preceded us
  // headers is copied over from the part instance that preceded us
}

MimeMessageAttachment.prototype = {
  __proto__: HeaderHandlerBase,
  /**
   * Is this an actual attachment, as far as we can tell?  An example of
   *  something that's not a real attachment is a mailing list footer that
   *  gets its own MIME part because the original message had both HTML and text
   *  as alternatives.
   * Our super-advanced heuristic is to check whether the attachment name is
   *  the same as the part name. Beware, this is localized.
   */
  get isRealAttachment() {
    if (!localizedPartStr)
      getLocalizedPartStr();
    let partName = localizedPartStr.replace("%s", this.partName);
    return this.name != partName;
  },
  get allAttachments() {
    return [this]; // we are a leaf, so just us.
  },
  get allUserAttachments() {
    return [this];
  },
  prettyString: function MimeMessageAttachment_prettyString(aVerbose, aIndent,
                                                            aDumpBody) {
    let s = "Attachment (" + this.size+" bytes): "
      + this.name + ", " + this.contentType;
    if (aVerbose)
      s += this._prettyHeaderString(aIndent + "  ");
    return s;
  },
  toString: function MimeMessageAttachment_toString() {
    return this.prettyString(false, "");
  },
};
