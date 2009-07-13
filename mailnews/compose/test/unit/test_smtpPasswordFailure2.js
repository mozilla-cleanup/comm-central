/**
 * This test checks to see if the pop3 password failure is handled correctly.
 * The steps are:
 *   - Have an invalid password in the password database.
 *   - Re-initiate connection, this time select enter new password, check that
 *     we get a new password prompt and can enter the password.
 *
 * XXX Due to problems with the fakeserver + smtp not using one connection for
 * multiple sends, the first part of this test is in
 * test_smtpPasswordFailure2.js.
 */

Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

load("../../../resources/alertTestUtils.js");
load("../../../resources/passwordStorage.js");

var server;
var attempt = 0;

var kSender = "from@foo.invalid";
var kTo = "to@foo.invalid";
var kUsername = "testsmtp";
// Password needs to match the login information stored in the signons json
// file.
var kInvalidPassword = "smtptest";
var kValidPassword = "smtptest1";

function alert(aDialogText, aText)
{
  // The first few attempts may prompt about the password problem, the last
  // attempt shouldn't.
  do_check_true(attempt < 4);

  // Log the fact we've got an alert, but we don't need to test anything here.
  dump("Alert Title: " + aDialogText + "\nAlert Text: " + aText + "\n");
}

function confirmEx(aDialogTitle, aText, aButtonFlags, aButton0Title,
                   aButton1Title, aButton2Title, aCheckMsg, aCheckState) {
  switch (++attempt) {
    // First attempt, retry.
    case 1:
      dump("\nAttempting Retry\n");
      return 0;
    // Second attempt, enter a new password.
    case 2:
      dump("\nEnter new password\n");
      return 2;
    default:
      do_throw("unexpected attempt number " + attempt);
      return 1;
  }
}

function promptPasswordPS(aParent, aDialogTitle, aText, aPassword, aCheckMsg,
                          aCheckState) {
  if (attempt == 2) {
    aPassword.value = kValidPassword;
    aCheckState.value = true;
    return true;
  }
  return false;
}

add_task(function *() {
  function createHandler(d) {
    var handler = new SMTP_RFC2821_handler(d);
    // Username needs to match the login information stored in the signons json
    // file.
    handler.kUsername = kUsername;
    handler.kPassword = kValidPassword;
    handler.kAuthRequired = true;
    handler.kAuthSchemes = [ "PLAIN", "LOGIN" ]; // make match expected transaction below
    return handler;
  }
  server = setupServerDaemon(createHandler);

  // Prepare files for passwords (generated by a script in bug 1018624).
  yield setupForPassword("signons-mailnews1.8.json")

  registerAlertTestUtils();

  // Test file
  var testFile = do_get_file("data/message1.eml");

  // Ensure we have at least one mail account
  localAccountUtils.loadLocalMailAccount();

  // Handle the server in a try/catch/finally loop so that we always will stop
  // the server if something fails.
  try {
    // Start the fake SMTP server
    server.start();
    var smtpServer = getBasicSmtpServer(server.port);
    var identity = getSmtpIdentity(kSender, smtpServer);

    // This time with auth
    test = "Auth sendMailMessage";

    smtpServer.authMethod = Ci.nsMsgAuthMethod.passwordCleartext;
    smtpServer.socketType = Ci.nsMsgSocketType.plain;
    smtpServer.username = kUsername;

    dump("Send\n");

    MailServices.smtp.sendMailMessage(testFile, kTo, identity,
                                      null, null, null, null,
                                      false, {}, {});

    server.performTest();

    dump("End Send\n");

    do_check_eq(attempt, 2);

    var transaction = server.playTransaction();
    do_check_transaction(transaction, ["EHLO test",
                                       // attempt 3 invalid password
                                       "AUTH PLAIN " + AuthPLAIN.encodeLine(kUsername, kInvalidPassword),
                                       "AUTH LOGIN",
                                       // attempt 4 which retries
                                       "AUTH PLAIN " + AuthPLAIN.encodeLine(kUsername, kInvalidPassword),
                                       "AUTH LOGIN",
                                       // then we enter the correct password
                                       "AUTH PLAIN " + AuthPLAIN.encodeLine(kUsername, kValidPassword),
                                       "MAIL FROM:<" + kSender + "> BODY=8BITMIME SIZE=155",
                                       "RCPT TO:<" + kTo + ">",
                                       "DATA"]);


      // Now check the new one has been saved.
      let count = {};
      let logins = Services.logins
                           .findLogins(count, "smtp://localhost", null,
                                       "smtp://localhost");

    do_check_eq(count.value, 1);
    do_check_eq(logins[0].username, kUsername);
    do_check_eq(logins[0].password, kValidPassword);
    do_test_finished();

  } catch (e) {
    do_throw(e);
  } finally {
    server.stop();

    var thread = gThreadManager.currentThread;
    while (thread.hasPendingEvents())
      thread.processNextEvent(true);
  }
});

function run_test() {
  run_next_test();
}
