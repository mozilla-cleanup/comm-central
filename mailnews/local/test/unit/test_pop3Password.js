/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Authentication tests for POP3.
 */
var test = null;
var server;
var daemon;
var incomingServer;
var pop3Service;
var firstTest = true;
var thisTest;

var tests = [
  { title: "Get New Mail, One Message",
    messages: ["message1.eml"],
    transaction: [ "AUTH", "CAPA", "AUTH PLAIN", "STAT", "LIST",
                   "UIDL", "RETR 1", "DELE 1" ] }
];

var urlListener =
{
  OnStartRunningUrl: function (url) {
  },
  OnStopRunningUrl: function (url, result) {
    try {
      var transaction = server.playTransaction();

      do_check_transaction(transaction, thisTest.transaction);

      do_check_eq(gLocalInboxFolder.getTotalMessages(false), thisTest.messages.length);

      do_check_eq(result, 0);
    }
    catch (e) {
      // If we have an error, clean up nicely before we throw it.
      server.stop();

      var thread = gThreadManager.currentThread;
      while (thread.hasPendingEvents())
        thread.processNextEvent(true);

      do_throw(e);
    }

    // Let OnStopRunningUrl return cleanly before doing anything else.
    do_timeout(0, checkBusy);
  }
};

function checkBusy() {
  if (tests.length == 0) {
    incomingServer.closeCachedConnections();

    // No more tests, let everything finish
    server.stop();

    var thread = gThreadManager.currentThread;
    while (thread.hasPendingEvents())
      thread.processNextEvent(true);

    do_test_finished();
    return;
  }

  // If the server hasn't quite finished, just delay a little longer.
  if (incomingServer.serverBusy ||
      (incomingServer instanceof Ci.nsIPop3IncomingServer &&
       incomingServer.runningProtocol)) {
    do_timeout(20, checkBusy);
    return;
  }

  testNext();
}

function testNext() {
  thisTest = tests.shift();

  // Handle the server in a try/catch/finally loop so that we always will stop
  // the server if something fails.
  try {
    if (firstTest) {
      firstTest = false;

      // Start the fake POP3 server
      server.start(POP3_PORT);
    }
    else
      server.resetTest();

    // Set up the test
    test = thisTest.title;
    daemon.setMessages(thisTest.messages);

    // Now get the mail
    pop3Service.GetNewMail(null, urlListener, gLocalInboxFolder,
                           incomingServer);

    server.performTest();
  } catch (e) {
    server.stop();

    do_throw(e);
  } finally {
    var thread = gThreadManager.currentThread;
    while (thread.hasPendingEvents())
      thread.processNextEvent(true);
  }
}

function run_test() {
  // Disable new mail notifications
  Services.prefs.setBoolPref("mail.biff.play_sound", false);
  Services.prefs.setBoolPref("mail.biff.show_alert", false);
  Services.prefs.setBoolPref("mail.biff.show_tray_icon", false);
  Services.prefs.setBoolPref("mail.biff.animate_dock_icon", false);

  // Passwords File (generated from Mozilla 1.8 branch).
  var signons = do_get_file("../../../data/signons-mailnews1.8.txt");

  // Copy the file to the profile directory for a PAB
  signons.copyTo(gProfileDir, "signons.txt");

  // Set up the Server
  var serverArray = setupServerDaemon();
  daemon = serverArray[0];
  server = serverArray[1];
  var handler = serverArray[2]

  // Set the server expected username & password to what we have in signons.txt
  handler.kUsername = "testpop3";
  handler.kPassword = "pop3test";

  // Set up the basic accounts and folders.
  // We would use createPop3ServerAndLocalFolders() however we want to have
  // a different username and NO password for this test (as we expect to load
  // it from signons.txt).
  loadLocalMailAccount();

  var acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                  .getService(Ci.nsIMsgAccountManager);

  incomingServer = acctMgr.createIncomingServer("testpop3", "localhost", "pop3");

  incomingServer.port = POP3_PORT;

  // Check that we haven't got any messages in the folder, if we have its a test
  // setup issue.
  do_check_eq(gLocalInboxFolder.getTotalMessages(false), 0);

  pop3Service = Cc["@mozilla.org/messenger/popservice;1"]
                      .getService(Ci.nsIPop3Service);

  do_test_pending();

  testNext();
}
