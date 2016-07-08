/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* exported getWcapSessionFor */

Components.utils.import("resource://calendar/modules/calUtils.jsm");
Components.utils.import("resource://calendar/modules/calIteratorUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Preferences.jsm");

function calWcapTimezone(tzProvider, tzid_, component_) {
    this.wrappedJSObject = this;
    this.provider = tzProvider;
    this.icalComponent = component_;
    this.tzid = tzid_;
    this.isUTC = false;
    this.isFloating = false;
    this.latitude = null;
    this.longitude = null;
}
calWcapTimezone.prototype = {
    get displayName() {
        if (this.mDisplayName === undefined) {
            // used l10n'ed display name if available:
            let tz = cal.getTimezoneService().getTimezone(this.tzid);
            this.mDisplayName = (tz ? tz.displayName : this.tzid);
        }
        return this.mDisplayName;
    },
    toString: function() {
        return this.icalComponent.toString();
    }
};

function splitUriParams(uri) {
    let spec = uri.spec;
    let qmPos = spec.indexOf("?");
    return qmPos != -1
           ? [spec.substring(0, qmPos), spec.substring(qmPos)]
           : [spec, ""];
}

function getWcapSessionFor(calendar, uri) {
    let contextId = calendar.getProperty("shared_context");
    if (!contextId) {
        contextId = cal.getUUID();
        calendar.setProperty("shared_context", contextId);
    }

    if (!getWcapSessionFor.m_sessions) {
        getWcapSessionFor.m_sessions = {};
    }
    let session = getWcapSessionFor.m_sessions[contextId];

    if (!session) {
        session = new calWcapSession(contextId);
        getWcapSessionFor.m_sessions[contextId] = session;

        let defaultCal = null;
        let registeredCalendars = session.getRegisteredCalendars();
        for (let regCal of registeredCalendars) {
            if (regCal.isDefaultCalendar) {
                defaultCal = regCal;
                break;
            }
        }

        if (defaultCal) {
            session.defaultCalendar = defaultCal;
            // eslint-disable-next-line array-bracket-spacing
            let [defaultSpec, ] = splitUriParams(defaultCal.uri);
            session.uri = cal.makeURL(defaultSpec);
            session.credentials.userId = defaultCal.getProperty("user_id");
            log("default calendar found.", defaultCal);

            // check and fix changing urls (autoconf) of subscribed calendars here:
            for (let regCal of registeredCalendars) {
                if (!regCal.isDefaultCalendar) {
                    let [spec, params] = splitUriParams(regCal.uri);
                    if (spec != defaultSpec) {
                        log("fixing url of subscribed calendar: " + regCal.calId, session);
                        let caluri = regCal.uri.clone();
                        caluri.spec = defaultSpec + params;
                        regCal.uri = caluri;
                        regCal.setProperty("uri", caluri.spec);
                    }
                }
            }
        } else { // no default calendar found, dump all subscribed calendars:
            registeredCalendars.forEach(cal.getCalendarManager().unregisterCalendar,
                                        cal.getCalendarManager());
        }
    }
    return session;
}

function calWcapSession(contextId) {
    this.wrappedJSObject = this;
    this.m_contextId = contextId;
    this.m_loginQueue = [];

    // listen for shutdown, being logged out:
    Services.obs.addObserver(this, "quit-application", false /* don't hold weakly */);
    cal.getCalendarManager().addObserver(this);
}
var calWcapSessionClassID = Components.ID("{cbf803fd-4469-4999-ae39-367af1c7b077}");
var calWcapSessionInterfaces = [
    calIWcapSession,
    calIFreeBusyProvider,
    calICalendarSearchProvider,
    Components.interfaces.calITimezoneProvider,
    Components.interfaces.calICalendarManagerObserver
];
calWcapSession.prototype = {
    classID: calWcapSessionClassID,
    QueryInterface: XPCOMUtils.generateQI(calWcapSessionInterfaces),
    classInfo: XPCOMUtils.generateCI({
        classID: calWcapSessionClassID,
        contractID: "@mozilla.org/calendar/wcap/session;1",
        classDescription: "Sun Java System Calendar Server WCAP Session",
        interfaces: calWcapSessionInterfaces
    }),

    toString: function calWcapSession_toString(msg) {
        let str = "context-id: " + this.m_contextId + ", uri: " + (this.uri ? this.uri.spec : "unknown");
        if (this.credentials.userId) {
            str += ", userId=" + this.credentials.userId;
        }
        if (!this.m_sessionId) {
            str += (Services.io.offline ? ", offline" : ", not logged in");
        }
        return str;
    },
    notifyError: function calWcapSession_notifyError(err) {
        if (this.defaultCalendar) {
            this.defaultCalendar.notifyError_(err, null, this);
        } else {
            logError("no default calendar!", this);
            logError(err, this);
        }
    },

    // calITimezoneProvider:
    m_serverTimezones: null,
    get timezoneIds() {
        let tzids = [];
        for (let tzid in this.m_serverTimezones) {
            tzids.push(tzid);
        }
        return { // nsIUTF8StringEnumerator:
            m_index: 0,
            getNext: function() {
                if (this.m_index >= tzids) {
                    ASSERT(false, "calWcapSession::timezoneIds enumerator!");
                    throw Components.results.NS_ERROR_UNEXPECTED;
                }
                return tzids[this.m_index++];
            },
            hasMore: function() {
                return (this.m_index < tzids.length);
            }
        };
    },
    getTimezone: function calWcapSession_getTimezone(tzid) {
        switch (tzid) {
            case "floating":
                return floating();
            case "UTC":
                return UTC();
            default:
                if (this.m_serverTimezones) {
                    return this.m_serverTimezones[tzid];
                }
                return null;
        }
    },

    m_serverTimeDiff: null,
    getServerTime: function calWcapSession_getServerTime(localTime) {
        if (this.m_serverTimeDiff === null) {
            throw new Components.Exception("early run into getServerTime()!",
                                           Components.results.NS_ERROR_NOT_AVAILABLE);
        }
        let ret = (localTime ? localTime.clone() : getTime());
        ret.addDuration(this.m_serverTimeDiff);
        return ret;
    },

    m_sessionId: null,
    m_loginQueue: null,
    m_loginLock: false,

    getSessionId:
    function calWcapSession_getSessionId(request, respFunc, timedOutSessionId) {
        if (Services.io.offline) {
            log("in offline mode.", this);
            respFunc(new Components.Exception(errorToString(NS_ERROR_OFFLINE), NS_ERROR_OFFLINE));
            return;
        }

        log("login queue lock: " + this.m_loginLock + ", length: " + this.m_loginQueue.length, this);

        if (this.m_loginLock) {
            this.m_loginQueue.push(respFunc);
            log("login queue: " + this.m_loginQueue.length);
        } else {
            if (this.m_sessionId && this.m_sessionId != timedOutSessionId) {
                respFunc(null, this.m_sessionId);
                return;
            }

            this.m_loginLock = true;
            log("locked login queue.", this);
            this.m_sessionId = null; // invalidate for relogin

            if (timedOutSessionId) {
                log("reconnecting due to session timeout...", this);
                getFreeBusyService().removeProvider(this);
                getCalendarSearchService().removeProvider(this);
            }

            let this_ = this;
            this.getSessionId_(null, // don't couple to parent request parent may be cancelled
                               function getSessionId_resp_(err, sessionId) {
                                   log("getSessionId_resp_(): " + sessionId, this_);
                                   if (!err) {
                                       this_.m_sessionId = sessionId;
                                       getFreeBusyService().addProvider(this_);
                                       getCalendarSearchService().addProvider(this_);
                                   }

                                   let queue = this_.m_loginQueue;
                                   this_.m_loginLock = false;
                                   this_.m_loginQueue = [];
                                   log("unlocked login queue.", this_);

                                   function getSessionId_exec(func) {
                                       try {
                                           func(err, sessionId);
                                       } catch (exc) { // unexpected
                                           this_.notifyError(exc);
                                       }
                                   }
                                   // answer first request:
                                   getSessionId_exec(respFunc);
                                   // and any remaining:
                                   queue.forEach(getSessionId_exec);
                               });
        }
    },

    // this is a server limit for recurrencies; default is 60
    recurrenceBound: 60,

    getSessionId_: function calWcapSession_getSessionId_(request, respFunc) {
        let this_ = this;
        this.checkServerVersion(
            request,
            // probe whether server is accessible and responds:
            function checkServerVersion_resp(err) {
                if (err) {
                    respFunc(err);
                    return;
                }
                // lookup password manager, then try login or prompt/login:
                log("attempting to get a session id for " + this_.sessionUri.spec, this_);

                if (!this_.sessionUri.schemeIs("https") &&
                    !confirmInsecureLogin(this_.sessionUri)) {
                    log("user rejected insecure login on " + this_.sessionUri.spec, this_);
                    respFunc(new Components.Exception(errorToString(calIWcapErrors.WCAP_LOGIN_FAILED),
                                                      calIWcapErrors.WCAP_LOGIN_FAILED));
                    return;
                }

                let outUser = { value: this_.credentials.userId };
                let outPW = { value: this_.credentials.pw };
                let outSavePW = { value: false };

                if (outUser.value && !outPW.value) { // lookup pw manager
                    log("looking in pw db for: " + this_.uri.spec, this_);
                    cal.auth.passwordManagerGet(outUser.value, outPW, this_.uri.spec, "wcap login");
                }

                function promptAndLoginLoop_resp(loginerr, sessionId) {
                    if (checkErrorCode(loginerr, calIWcapErrors.WCAP_LOGIN_FAILED)) {
                        log("prompting for [user/]pw...", this_);
                        if (cal.auth.getCredentials(cal.calGetString("wcap", "loginDialog.label"),
                                                    this_.sessionUri.hostPort,
                                                    outUser,
                                                    outPW,
                                                    outSavePW,
                                                    this_.credentials.userId != null)) {
                            this_.login(request, promptAndLoginLoop_resp,
                                        outUser.value, outPW.value);
                        } else {
                            log("login prompt cancelled.", this_);
                            this_.defaultCalendar.setProperty("disabled", true);
                            this_.defaultCalendar.setProperty("auto-enabled", true);
                            respFunc(new Components.Exception(errorToString(calIWcapErrors.WCAP_LOGIN_FAILED),
                                                              calIWcapErrors.WCAP_LOGIN_FAILED));
                        }
                    } else if (loginerr) {
                        respFunc(loginerr);
                    } else {
                        if (outSavePW.value) {
                            // so try to remove old pw from db first:
                            cal.auth.passwordManagerSave(outUser.value, outPW.value, this_.uri.spec, "wcap login");
                        }
                        this_.credentials.userId = outUser.value;
                        this_.credentials.pw = outPW.value;
                        this_.setupSession(sessionId,
                                           request,
                                           function setupSession_resp(setuperr) {
                                               respFunc(setuperr, sessionId);
                                           });
                    }
                }

                if (outPW.value) {
                    this_.login(request, promptAndLoginLoop_resp, outUser.value, outPW.value);
                } else {
                    promptAndLoginLoop_resp(calIWcapErrors.WCAP_LOGIN_FAILED);
                }
            });
    },

    login: function calWcapSession_login(request, respFunc, user, pw) {
        let this_ = this;
        issueNetworkRequest(
            request,
            function netResp(err, str) {
                let sessionId;
                try {
                    if (err) {
                        throw err;
                    }
                    // currently, xml parsing at an early stage during
                    // process startup does not work reliably, so use
                    // libical parsing for now:
                    let icalRootComp = stringToIcal(this_, str);
                    let prop = icalRootComp.getFirstProperty("X-NSCP-WCAP-SESSION-ID");
                    if (!prop) {
                        throw new Components.Exception("missing X-NSCP-WCAP-SESSION-ID in\n" + str);
                    }
                    sessionId = prop.value;
                    prop = icalRootComp.getFirstProperty("X-NSCP-RECURRENCE-BOUND");
                    if (prop) {
                        let val = parseInt(prop.value, 10);
                        if (!isNaN(val)) {
                            this_.recurrenceBound = val;
                            log("X-NSCP-RECURRENCE-BOUND:" + this_.recurrenceBound);
                        }
                    }
                    log("login succeeded: " + sessionId, this_);
                } catch (exc) {
                    err = exc;
                    if (checkErrorCode(err, calIWcapErrors.WCAP_LOGIN_FAILED)) {
                        log("error: " + errorToString(exc), this_); // log login failure
                    } else if (getErrorModule(err) == NS_ERROR_MODULE_NETWORK) {
                        // server seems unavailable:
                        err = new Components.Exception(cal.calGetString("wcap", "accessingServerFailedError.text",
                                                                        [this_.sessionUri.hostPort]), exc);
                    }
                }
                respFunc(err, sessionId);
            },
            this_.sessionUri.spec + "login.wcap?fmt-out=text%2Fcalendar&user=" +
            encodeURIComponent(user) + "&password=" + encodeURIComponent(pw),
            false /* no logging */);
    },

    logout: function calWcapSession_logout(listener) {
        let this_ = this;
        let request = new calWcapRequest(
            function logout_resp(oprequest, err) {
                if (err) {
                    logError(err, this_);
                } else {
                    log("logout succeeded.", this_);
                }
                if (listener) {
                    listener.onResult(oprequest, null);
                }
            },
            log("logout", this));

        let url = null;
        if (this.m_sessionId) {
            log("attempting to log out...", this);
            // although io service's offline flag is already
            // set BEFORE notification
            // (about to go offline, nsIOService.cpp).
            // WTF.
            url = (this.sessionUri.spec + "logout.wcap?fmt-out=text%2Fxml&id=" + this.m_sessionId);
            this.m_sessionId = null;
            getFreeBusyService().removeProvider(this);
            getCalendarSearchService().removeProvider(this);
        }
        this.m_credentials = null;

        if (url) {
            issueNetworkRequest(request,
                                function netResp(err, str) {
                                    if (err) {
                                        throw err;
                                    }
                                    stringToXml(this_, str, -1 /* logout successfull */);
                                }, url);
        } else {
            request.execRespFunc();
        }
        return request;
    },

    checkServerVersion: function calWcapSession_checkServerVersion(request, respFunc) {
        // currently, xml parsing at an early stage during process startup
        // does not work reliably, so use libical:
        let this_ = this;
        issueNetworkRequest(
            request,
            function netResp(err, str) {
                try {
                    let icalRootComp;
                    if (!err) {
                        try {
                            icalRootComp = stringToIcal(this_, str);
                        } catch (exc) {
                            err = exc;
                        }
                    }
                    if (err) {
                        if (checkErrorCode(err, calIErrors.OPERATION_CANCELLED)) {
                            throw err;
                        } else { // soft error; request denied etc.
                                 // map into localized message:
                            throw new Components.Exception(cal.calGetString("wcap", "accessingServerFailedError.text",
                                                                            [this_.sessionUri.hostPort]),
                                                           calIWcapErrors.WCAP_LOGIN_FAILED);
                        }
                    }
                    let prop = icalRootComp.getFirstProperty("X-NSCP-WCAPVERSION");
                    if (!prop) {
                        throw new Components.Exception("missing X-NSCP-WCAPVERSION!");
                    }
                    let wcapVersion = parseInt(prop.value, 10);
                    if (wcapVersion < 3) {
                        let strVers = prop.value;
                        let vars = [this_.sessionUri.hostPort];
                        prop = icalRootComp.getFirstProperty("PRODID");
                        vars.push(prop ? prop.value : "<unknown>");
                        prop = icalRootComp.getFirstProperty("X-NSCP-SERVERVERSION");
                        vars.push(prop ? prop.value : "<unknown>");
                        vars.push(strVers);

                        let prompt = Services.ww.getNewPrompter(null);
                        let labelText = cal.calGetString("wcap", "insufficientWcapVersionConfirmation.label");
                        if (!prompt.confirm(labelText,
                                            cal.calGetString("wcap", "insufficientWcapVersionConfirmation.text", vars))) {
                            throw new Components.Exception(labelText, calIWcapErrors.WCAP_LOGIN_FAILED);
                        }
                    }
                } catch (exc) {
                    err = exc;
                }
                respFunc(err);
            },
            this_.sessionUri.spec + "version.wcap?fmt-out=text%2Fcalendar");
    },

    setupSession: function calWcapSession_setupSession(sessionId, request_, respFunc) {
        let this_ = this;
        let request = new calWcapRequest(
            function setupSession_resp(oprequest, err) {
                log("setupSession_resp finished: " + errorToString(err), this_);
                respFunc(err);
            },
            log("setupSession", this));
        if (request_) {
            request_.attachSubRequest(request);
        }

        request.lockPending();
        try {
            this.issueNetworkRequest_(
                request,
                function userprefs_resp(err, data) {
                    if (err) {
                        throw err;
                    }
                    this_.credentials.userPrefs = data;
                    log("installed user prefs.", this_);

                    // get calprops for all registered calendars:
                    let cals = this_.getRegisteredCalendars(true);

                    let calprops_resp = null;
                    let defaultCal = this_.defaultCalendar;
                    if (defaultCal && cals[defaultCal.calId] && // default calendar is registered
                        getPref("calendar.wcap.subscriptions", true) &&
                        !defaultCal.getProperty("subscriptions_registered")) {
                        let hasSubscriptions = false;
                        // post register subscribed calendars:
                        let list = this_.getUserPreferences("X-NSCP-WCAP-PREF-icsSubscribed");
                        for (let item of list) {
                            let ar = item.split(",");
                            // ',', '$' are not encoded. ',' can be handled here. WTF.
                            for (let a of ar) {
                                let dollar = a.indexOf("$");
                                if (dollar >= 0) {
                                    let calId = a.substring(0, dollar);
                                    if (calId != this_.defaultCalId) {
                                        cals[calId] = null;
                                        hasSubscriptions = true;
                                    }
                                }
                            }
                        }

                        if (hasSubscriptions) {
                            calprops_resp = function(aCalendar) {
                                if (aCalendar.isDefaultCalendar) {
                                    // tweak name:
                                    aCalendar.setProperty("name", aCalendar.displayName);
                                } else {
                                    log("registering subscribed calendar: " + aCalendar.calId, this_);
                                    cal.getCalendarManager().registerCalendar(aCalendar);
                                }
                            };
                            // do only once:
                            defaultCal.setProperty("subscriptions_registered", true);
                        }
                    }

                    if (!defaultCal.getProperty("user_id")) { // nail once:
                        defaultCal.setProperty("user_id", this_.credentials.userId);
                    }

                    if (getPref("calendar.wcap.no_get_calprops", false)) {
                        // hack around the get/search calprops mess:
                        this_.installCalProps_search_calprops(calprops_resp, sessionId, cals, request);
                    } else {
                        this_.installCalProps_get_calprops(calprops_resp, sessionId, cals, request);
                    }
                },
                stringToXml, "get_userprefs",
                "&fmt-out=text%2Fxml&userid=" + encodeURIComponent(this.credentials.userId),
                sessionId);
            this.installServerTimeDiff(sessionId, request);
            this.installServerTimezones(sessionId, request);
        } finally {
            request.unlockPending();
        }
    },

    installCalProps_get_calprops:
    function calWcapSession_installCalProps_get_calprops(respFunc, sessionId, cals, request) {
        let this_ = this;
        function calprops_resp(err, data) {
            if (err) {
                throw err;
            }
            // string to xml converter func without WCAP errno check:
            if (!data || data.length == 0) { // assuming time-out
                throw new Components.Exception(errorToString(calIWcapErrors.WCAP_LOGIN_FAILED),
                                               calIWcapErrors.WCAP_LOGIN_FAILED);
            }
            let xml = getDomParser().parseFromString(data, "text/xml");
            let nodeList = xml.getElementsByTagName("iCal");
            for (let i = 0; i < nodeList.length; ++i) {
                try {
                    let node = nodeList.item(i);
                    checkWcapXmlErrno(node);
                    let ar = filterXmlNodes("X-NSCP-CALPROPS-RELATIVE-CALID", node);
                    if (ar.length > 0) {
                        let calId = ar[0];
                        let calendar = cals[calId];
                        if (calendar === null) {
                            calendar = new calWcapCalendar(this_);
                            let uri = this_.uri.clone();
                            uri.path += "?calid=" + encodeURIComponent(calId);
                            calendar.uri = uri;
                        }
                        if (calendar) {
                            calendar.m_calProps = node;
                            if (respFunc) {
                                respFunc(calendar);
                            }
                        }
                    }
                } catch (exc) { // ignore but log any errors on subscribed calendars:
                    logError(exc, this_);
                }
            }
        }

        let calidParam = "";
        for (let calId in cals) {
            if (calidParam.length > 0) {
                calidParam += ";";
            }
            calidParam += encodeURIComponent(calId);
        }
        this_.issueNetworkRequest_(request, calprops_resp,
                                   null, "get_calprops",
                                   "&fmt-out=text%2Fxml&calid=" + calidParam,
                                   sessionId);
    },

    installCalProps_search_calprops:
    function calWcapSession_installCalProps_search_calprops(respFunc, sessionId, cals, request) {
        let this_ = this;
        let retrievedCals = {};
        let issuedSearchRequests = {};
        for (let calId in cals) {
            if (!retrievedCals[calId]) {
                let listener = {
                    onResult: function search_onResult(oprequest, result) {
                        try {
                            if (!Components.isSuccessCode(oprequest.status)) {
                                throw oprequest.status;
                            }
                            if (result.length < 1) {
                                throw Components.results.NS_ERROR_UNEXPECTED;
                            }
                            for (let calendar of result) {
                                // user may have dangling users referred in his subscription list, so
                                // retrieve each by each, don't break:
                                try {
                                    let thisCalId = calendar.calId;
                                    if ((cals[thisCalId] !== undefined) && !retrievedCals[thisCalId]) {
                                        retrievedCals[thisCalId] = calendar;
                                        if (respFunc) {
                                            respFunc(calendar);
                                        }
                                    }
                                } catch (exc) { // ignore but log any errors on subscribed calendars:
                                    logError(exc, this_);
                                }
                            }
                        } catch (exc) { // ignore but log any errors on subscribed calendars:
                            logError(exc, this_);
                        }
                    }
                };

                let colon = calId.indexOf(":");
                if (colon >= 0) { // searching for secondary calendars doesn't work. WTF.
                    calId = calId.substring(0, colon);
                }
                if (!issuedSearchRequests[calId]) {
                    issuedSearchRequests[calId] = true;
                    this.searchForCalendars(calId, calICalendarSearchProvider.HINT_EXACT_MATCH, 20, listener);
                }
            }
        }
    },

    installServerTimeDiff: function calWcapSession_installServerTimeDiff(sessionId, request) {
        let this_ = this;
        this.issueNetworkRequest_(
            request,
            function netResp(err, data) {
                if (err) {
                    throw err;
                }
                // xxx todo: think about
                // assure that locally calculated server time is smaller
                // than the current (real) server time:
                let localTime = getTime();
                let serverTime = getDatetimeFromIcalProp(data.getFirstProperty("X-NSCP-WCAPTIME"));
                this_.m_serverTimeDiff = serverTime.subtractDate(localTime);
                log("server time diff is: " + this_.m_serverTimeDiff, this_);
            },
            stringToIcal, "gettime", "&fmt-out=text%2Fcalendar",
            sessionId);
    },

    installServerTimezones: function calWcapSession_installServerTimezones(sessionId, request) {
        this.m_serverTimezones = {};
        let this_ = this;
        this_.issueNetworkRequest_(
            request,
            function netResp(err, data) {
                if (err) {
                    throw err;
                }
                for (let subComp of cal.ical.calendarComponentIterator(data, "VTIMEZONE")) {
                    try {
                        let tzid = subComp.getFirstProperty("TZID").value;
                        this_.m_serverTimezones[tzid] = new calWcapTimezone(this_, tzid, subComp);
                    } catch (exc) { // ignore but errors:
                        logError(exc, this_);
                    }
                }
                log("installed timezones.", this_);
            },
            stringToIcal, "get_all_timezones", "&fmt-out=text%2Fcalendar",
            sessionId);
    },

    getCommandUrl: function calWcapSession_getCommandUrl(wcapCommand, params, sessionId) {
        let url = this.sessionUri.spec;
        url += wcapCommand + ".wcap?appid=mozilla-calendar&id=";
        url += sessionId;
        url += params;
        return url;
    },

    issueNetworkRequest: function calWcapSession_issueNetworkRequest(
                    request, respFunc, dataConvFunc, wcapCommand, params) {
        let this_ = this;
        let getSessionId_resp = function(err, sessionId) {
            if (err) {
                request.execSubRespFunc(respFunc, err);
            } else {
                // else have session uri and id:
                this_.issueNetworkRequest_(
                    request,
                    function issueNetworkRequest_resp(loginerr, data) {
                        // timeout?
                        if (checkErrorCode(loginerr, calIWcapErrors.WCAP_LOGIN_FAILED)) {
                            // try again:
                            this_.getSessionId(
                                request,
                                getSessionId_resp,
                                sessionId/* (old) timed-out session */);
                            return;
                        }
                        request.execSubRespFunc(respFunc, loginerr, data);
                    },
                    dataConvFunc, wcapCommand, params, sessionId);
            }
        };
        this.getSessionId(request, getSessionId_resp);
    },

    issueNetworkRequest_: function calWcapSession_issueNetworkRequest_(
                    request, respFunc, dataConvFunc, wcapCommand, params, sessionId) {
        let url = this.getCommandUrl(wcapCommand, params, sessionId);
        let this_ = this;
        issueNetworkRequest(request,
                            function netResp(err, str) {
                                let data;
                                if (!err) {
                                    try {
                                        if (dataConvFunc) {
                                            data = dataConvFunc(this_, str);
                                        } else {
                                            data = str;
                                        }
                                    } catch (exc) {
                                        err = exc;
                                    }
                                }
                                request.execSubRespFunc(respFunc, err, data);
                            }, url);
    },

    m_credentials: null,
    get credentials() {
        if (!this.m_credentials) {
            this.m_credentials = {};
        }
        return this.m_credentials;
    },

    // calIWcapSession:

    m_contextId: null,
    m_uri: null,
    m_sessionUri: null,
    get uri() {
        return this.m_uri;
    },
    get sessionUri() {
        return this.m_sessionUri;
    },
    set uri(thatUri) {
        this.m_uri = thatUri.clone();
        this.m_sessionUri = thatUri.clone();
        this.m_sessionUri.userPass = "";
    },

    get userId() {
        return this.credentials.userId;
    },

    get defaultCalId() {
        let list = this.getUserPreferences("X-NSCP-WCAP-PREF-icsCalendar");
        let id = null;
        for (let item of list) {
            if (item.length > 0) {
                id = item;
                break;
            }
        }
        return (id ? id : this.credentials.userId);
    },

    get isLoggedIn() {
        return (this.m_sessionId != null);
    },

    defaultCalendar: null,

    belongsTo: function calWcapSession_belongsTo(calendar) {
        try {
            // xxx todo hack to get the unwrapped wcap calendar instance:
            calendar = calendar.getProperty("cache.uncachedCalendar")
                               .QueryInterface(calIWcapCalendar).wrappedJSObject;
            if (calendar && (calendar.session.m_contextId == this.m_contextId)) {
                return calendar;
            }
        } catch (exc) {
            // Fall through to the return statement below in case the uncached
            // calendar can't be retrieved.
        }
        return null;
    },

    getRegisteredCalendars: function calWcapSession_getRegisteredCalendars(asAssocObj) {
        let registeredCalendars = (asAssocObj ? {} : []);
        let cals = cal.getCalendarManager().getCalendars({});
        for (let calendar of cals) {
            calendar = this.belongsTo(calendar);
            if (calendar) {
                if (asAssocObj) {
                    registeredCalendars[calendar.calId] = calendar;
                } else {
                    registeredCalendars.push(calendar);
                }
            }
        }
        return registeredCalendars;
    },

    getUserPreferences: function calWcapSession_getUserPreferences(prefName) {
        let prefs = filterXmlNodes(prefName, this.credentials.userPrefs);
        return prefs;
    },

    get defaultAlarmStart() {
        let alarmStart = null;
        let ar = this.getUserPreferences("X-NSCP-WCAP-PREF-ceDefaultAlarmStart");
        if (ar.length > 0 && ar[0].length > 0) {
            // workarounding cs duration bug, missing "T":
            let dur = ar[0].replace(/(^P)(\d+[HMS]$)/, "$1T$2");
            alarmStart = cal.createDuration(dur);
            alarmStart.isNegative = !alarmStart.isNegative;
        }
        return alarmStart;
    },

    getDefaultAlarmEmails: function calWcapSession_getDefaultAlarmEmails(out_count) {
        let ret = [];
        let ar = this.getUserPreferences("X-NSCP-WCAP-PREF-ceDefaultAlarmEmail");
        if (ar.length > 0 && ar[0].length > 0) {
            for (let i of ar) {
                ret = ret.concat(i.split(/[;,]/).map(String.trim));
            }
        }
        out_count.value = ret.length;
        return ret;
    },

    // calICalendarSearchProvider:
    searchForCalendars:
    function calWcapSession_searchForCalendars(searchString, hints, maxResults, listener) {
        let this_ = this;
        let request = new calWcapRequest(
            function searchForCalendars_resp(oprequest, err, data) {
                if (err && !checkErrorCode(err, calIErrors.OPERATION_CANCELLED)) {
                    this_.notifyError(err);
                }
                if (listener) {
                    listener.onResult(oprequest, data);
                }
            },
            log("searchForCalendars, searchString=" + searchString, this));

        try {
            let registeredCalendars = this.getRegisteredCalendars(true);

            let params = "&fmt-out=text%2Fxml&search-string=" + encodeURIComponent(searchString);
            if (maxResults > 0) {
                params += "&maxResults=" + maxResults;
            }
            params += "&name=1&calid=1&primaryOwner=1&searchOpts=" +
                       (hints & calICalendarSearchProvider.HINT_EXACT_MATCH ? "3" : "0");

            this.issueNetworkRequest(
                request,
                function searchForCalendars_netResp(err, data) {
                    if (err) {
                        throw err;
                    }
                    // string to xml converter func without WCAP errno check:
                    if (!data || data.length == 0) { // assuming time-out
                        throw new Components.Exception(errorToString(calIWcapErrors.WCAP_LOGIN_FAILED),
                                                       calIWcapErrors.WCAP_LOGIN_FAILED);
                    }
                    let xml = getDomParser().parseFromString(data, "text/xml");
                    let ret = [];
                    let nodeList = xml.getElementsByTagName("iCal");
                    for (let i = 0; i < nodeList.length; ++i) {
                        let node = nodeList.item(i);
                        try {
                            checkWcapXmlErrno(node);
                            let ar = filterXmlNodes("X-NSCP-CALPROPS-RELATIVE-CALID", node);
                            if (ar.length > 0) {
                                let calId = ar[0];
                                let calendar = registeredCalendars[calId];
                                if (calendar) {
                                    calendar.m_calProps = node; // update calprops
                                } else {
                                    calendar = new calWcapCalendar(this_, node);
                                    let uri = this_.uri.clone();
                                    uri.path += "?calid=" + encodeURIComponent(calId);
                                    calendar.uri = uri;
                                }
                                ret.push(calendar);
                            }
                        } catch (exc) {
                            switch (getResultCode(exc)) {
                                case calIWcapErrors.WCAP_NO_ERRNO: // workaround
                                case calIWcapErrors.WCAP_ACCESS_DENIED_TO_CALENDAR:
                                    log("searchForCalendars_netResp() ignored error: " + errorToString(exc), this_);
                                    break;
                                default:
                                    this_.notifyError(exc);
                                    break;
                            }
                        }
                    }
                    log("search done. number of found calendars: " + ret.length, this_);
                    request.execRespFunc(null, ret);
                },
                null, "search_calprops", params);
        } catch (exc) {
            request.execRespFunc(exc);
        }
        return request;
    },

    // calIFreeBusyProvider:
    getFreeBusyIntervals:
    function calWcapCalendar_getFreeBusyIntervals(calId, rangeStart, rangeEnd, busyTypes, listener) {
        rangeStart = ensureDateTime(rangeStart);
        rangeEnd = ensureDateTime(rangeEnd);
        let zRangeStart = getIcalUTC(rangeStart);
        let zRangeEnd = getIcalUTC(rangeEnd);

        let this_ = this;
        let request = new calWcapRequest(
            function _resp(oprequest, err, data) {
                let rc = getResultCode(err);
                switch (rc) {
                    case calIWcapErrors.WCAP_NO_ERRNO: // workaround
                    case calIWcapErrors.WCAP_ACCESS_DENIED_TO_CALENDAR:
                    case calIWcapErrors.WCAP_CALENDAR_DOES_NOT_EXIST:
                        log("getFreeBusyIntervals_resp() error: " + errorToString(err), this_);
                        break;
                    default:
                        if (!Components.isSuccessCode(rc)) {
                            this_.notifyError(err);
                        }
                        break;
                }
                if (listener) {
                    listener.onResult(oprequest, data);
                }
            },
            log("getFreeBusyIntervals():\n\tcalId=" + calId +
                "\n\trangeStart=" + zRangeStart + ",\n\trangeEnd=" + zRangeEnd, this));

        // cannot use stringToXml here, because cs 6.3 returns plain nothing
        // on invalid user freebusy requests. WTF.
        let stringToXml_ = function(session, data) {
            if (!data || data.length == 0) { // assuming invalid user
                throw new Components.Exception(errorToString(calIWcapErrors.WCAP_CALENDAR_DOES_NOT_EXIST),
                                               calIWcapErrors.WCAP_CALENDAR_DOES_NOT_EXIST);
            }
            return stringToXml(session, data);
        };

        try {
            let params = "&calid=" + encodeURIComponent(calId);
            params += "&busyonly=" + (busyTypes & calIFreeBusyInterval.FREE ? "0" : "1");
            params += "&dtstart=" + zRangeStart;
            params += "&dtend=" + zRangeEnd;
            params += "&fmt-out=text%2Fxml";

            this.issueNetworkRequest(
                request,
                function net_resp(err, xml) {
                    if (err) {
                        throw err;
                    }
                    if (LOG_LEVEL > 0) {
                        log("getFreeBusyIntervals net_resp(): " +
                            getWcapRequestStatusString(xml), this_);
                    }
                    if (listener) {
                        let ret = [];
                        let nodeList = xml.getElementsByTagName("FB");

                        let fbTypeMap = {};
                        fbTypeMap["FREE"] = calIFreeBusyInterval.FREE;
                        fbTypeMap["BUSY"] = calIFreeBusyInterval.BUSY;
                        fbTypeMap["BUSY-UNAVAILABLE"] = calIFreeBusyInterval.BUSY_UNAVAILABLE;
                        fbTypeMap["BUSY-TENTATIVE"] = calIFreeBusyInterval.BUSY_TENTATIVE;

                        for (let i = 0; i < nodeList.length; ++i) {
                            let node = nodeList.item(i);
                            let fbType = fbTypeMap[node.attributes.getNamedItem("FBTYPE").nodeValue];
                            if (!fbType || (fbType & busyTypes)) {
                                if (!fbType) {
                                    fbType = calIFreeBusyInterval.UNKNOWN;
                                }
                                let str = node.textContent;
                                let slash = str.indexOf("/");
                                let start = getDatetimeFromIcalString(str.substr(0, slash));
                                let end = getDatetimeFromIcalString(str.substr(slash + 1));

                                ret.push(new cal.FreeBusyInterval(calId, fbType, start, end));
                            }
                        }
                        request.execRespFunc(null, ret);
                    }
                },
                stringToXml_, "get_freebusy", params);
        } catch (exc) {
            request.execRespFunc(exc);
        }
        return request;
    },

    // nsIObserver:
    observe: function calWcapSession_observer(subject, topic, data) {
        log("observing: " + topic + ", data: " + data, this);
        if (topic == "quit-application") {
            g_bShutdown = true;
            this.logout(null);
            // xxx todo: valid upon notification?
            cal.getCalendarManager().removeObserver(this);
            Services.obs.removeObserver(this, "quit-application");
        }
    },

    // calICalendarManagerObserver:

    // called after the calendar is registered
    onCalendarRegistered: function calWcapSession_onCalendarRegistered(aCalendar) {
        function assureDefault(pref, val) {
            if (aCalendar.getProperty(pref) === null) {
                aCalendar.setProperty(pref, val);
            }
        }

        try {
            // make sure the calendar belongs to this session:
            if (this.belongsTo(aCalendar)) {
                assureDefault("shared_context", this.m_contextId);
                assureDefault("name", aCalendar.name);

                const s_colors = ["#FFCCCC", "#FFCC99", "#FFFF99", "#FFFFCC", "#99FF99",
                                  "#99FFFF", "#CCFFFF", "#CCCCFF", "#FFCCFF", "#FF6666",
                                  "#FF9966", "#FFFF66", "#FFFF33", "#66FF99", "#33FFFF",
                                  "#66FFFF", "#9999FF", "#FF99FF", "#FF0000", "#FF9900",
                                  "#FFCC66", "#FFFF00", "#33FF33", "#66CCCC", "#33CCFF",
                                  "#6666CC", "#CC66CC", "#CC0000", "#FF6600", "#FFCC33",
                                  "#FFCC00", "#33CC00", "#00CCCC", "#3366FF", "#6633FF",
                                  "#CC33CC", "#990000", "#CC6600", "#CC9933", "#999900",
                                  "#009900", "#339999", "#3333FF", "#6600CC", "#993399",
                                  "#660000", "#993300", "#996633", "#666600", "#006600",
                                  "#336666", "#000099", "#333399", "#663366", "#330000",
                                  "#663300", "#663333", "#333300", "#003300", "#003333",
                                  "#000066", "#330099", "#330033"];
                assureDefault("color", s_colors[(new Date()).getUTCMilliseconds() % s_colors.length]);
            }
        } catch (exc) { // never break the listener chain
            this.notifyError(exc);
        }
    },

    // called before the unregister actually takes place
    onCalendarUnregistering: function calWcapSession_onCalendarUnregistering(aCalendar) {
        try {
            // make sure the calendar belongs to this session and is the default calendar,
            // then remove all subscribed calendars:
            aCalendar = this.belongsTo(aCalendar);
            if (aCalendar && aCalendar.isDefaultCalendar) {
                getFreeBusyService().removeProvider(this);
                getCalendarSearchService().removeProvider(this);
                let registeredCalendars = this.getRegisteredCalendars();
                for (let regCal of registeredCalendars) {
                    try {
                        if (!regCal.isDefaultCalendar) {
                            cal.getCalendarManager().unregisterCalendar(regCal);
                        }
                    } catch (exc) {
                        this.notifyError(exc);
                    }
                }
            }
        } catch (exc) { // never break the listener chain
            this.notifyError(exc);
        }
    },

    // called before the delete actually takes place
    onCalendarDeleting: function calWcapSession_onCalendarDeleting(aCalendar) {
    }
};

function confirmInsecureLogin(uri) {
    if (!confirmInsecureLogin.m_confirmedHttpLogins) {
        confirmInsecureLogin.m_confirmedHttpLogins = {};
        let confirmedHttpLogins = getPref("calendar.wcap.confirmed_http_logins", "");
        let tuples = confirmedHttpLogins.split(",");
        for (let tuple of tuples) {
            let ar = tuple.split(":");
            confirmInsecureLogin.m_confirmedHttpLogins[ar[0]] = ar[1];
        }
    }

    let bConfirmed = false;

    let host = uri.hostPort;
    let encodedHost = encodeURIComponent(host);
    let confirmedEntry = confirmInsecureLogin.m_confirmedHttpLogins[encodedHost];
    if (confirmedEntry) {
        bConfirmed = (confirmedEntry == "1");
    } else {
        let prompt = Services.ww.getNewPrompter(null);
        let out_dontAskAgain = { value: false };
        bConfirmed = prompt.confirmCheck(
            cal.calGetString("wcap", "noHttpsConfirmation.label"),
            cal.calGetString("wcap", "noHttpsConfirmation.text", [host]),
            cal.calGetString("wcap", "noHttpsConfirmation.check.text"),
            out_dontAskAgain);

        if (out_dontAskAgain.value) {
            // save decision for all running calendars and
            // all future confirmations:
            let newConfirmedLogins = getPref("calendar.wcap.confirmed_http_logins", "");
            if (newConfirmedLogins.length > 0) {
                newConfirmedLogins += ",";
            }
            confirmedEntry = (bConfirmed ? "1" : "0");
            newConfirmedLogins += encodedHost + ":" + confirmedEntry;
            Preferences.set("calendar.wcap.confirmed_http_logins", newConfirmedLogins);
            getPref("calendar.wcap.confirmed_http_logins"); // log written entry
            confirmInsecureLogin.m_confirmedHttpLogins[encodedHost] = confirmedEntry;
        }
    }

    log("returned: " + bConfirmed, "confirmInsecureLogin(" + host + ")");
    return bConfirmed;
}

