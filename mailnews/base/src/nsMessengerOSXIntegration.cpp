/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * The Original Code is Mac OSX New Mail Notification Code..
 *
 * The Initial Developer of the Original Code is
 * The Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2005
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Scott MacGregor <mscott@mozilla.org>
 *  Jon Baumgartner <jon@bergenstreetsoftware.com>
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
 
#include "nscore.h"
#include "nsMessengerOSXIntegration.h"
#include "nsIMsgMailSession.h"
#include "nsIMsgIncomingServer.h"
#include "nsIMsgIdentity.h"
#include "nsIMsgAccount.h"
#include "nsIMsgFolder.h"
#include "nsCOMPtr.h"
#include "nsMsgBaseCID.h"
#include "nsMsgFolderFlags.h"
#include "nsDirectoryServiceDefs.h"
#include "nsIDirectoryService.h"
#include "MailNewsTypes.h"
#include "nsIWindowMediator.h"
#include "nsIDOMChromeWindow.h"
#include "nsIDOMWindowInternal.h"
#include "nsPIDOMWindow.h"
#include "nsIDocShell.h"
#include "nsIBaseWindow.h"
#include "nsIWidget.h"
#include "nsIObserverService.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "nsIMessengerWindowService.h"
#include "prprf.h"
#include "nsIWeakReference.h"
#include "nsIAlertsService.h"
#include "nsIStringBundle.h"
#include "nsToolkitCompsCID.h"
#include "nsINotificationsList.h"
#include "nsIMsgDatabase.h"
#include "nsIMsgHdr.h"
#include "nsIMsgHeaderParser.h"
#include "nsISupportsPrimitives.h"
#include "nsIWindowWatcher.h"
#include "nsMsgLocalCID.h"
#include "nsIMsgMailNewsUrl.h"

#include <Carbon/Carbon.h>

#define kNewMailAlertIcon "chrome://messenger/skin/icons/new-mail-alert.png"
#define kBiffShowAlertPref "mail.biff.show_alert"
#define kMaxDisplayCount 10

// HACK: Limitations in Focus/SetFocus on Mac (see bug 465446)
nsresult FocusAppNative()
{
  ProcessSerialNumber psn;

  if (::GetCurrentProcess(&psn) != 0)
   return NS_ERROR_FAILURE;

  if (::SetFrontProcess(&psn) != 0)
   return NS_ERROR_FAILURE;

  return NS_OK;
}

static void openMailWindow(const nsCString& aUri)
{
  nsresult rv;
  nsCOMPtr<nsIMsgMailSession> mailSession ( do_GetService(NS_MSGMAILSESSION_CONTRACTID, &rv));
  if (NS_FAILED(rv))
    return;

  nsCOMPtr<nsIMsgWindow> topMostMsgWindow;
  rv = mailSession->GetTopmostMsgWindow(getter_AddRefs(topMostMsgWindow));
  if (topMostMsgWindow)
  {
    if (!aUri.IsEmpty())
    {
      nsCOMPtr<nsIMsgMailNewsUrl> msgUri(do_CreateInstance(NS_MAILBOXURL_CONTRACTID, &rv));
      if (NS_FAILED(rv))
        return;

      rv = msgUri->SetSpec(aUri);
      if (NS_FAILED(rv))
        return;

      PRBool isMessageUri = PR_FALSE;
      msgUri->GetIsMessageUri(&isMessageUri);

      if (isMessageUri)
      {
        nsCOMPtr<nsIWindowWatcher> wwatch(do_GetService(NS_WINDOWWATCHER_CONTRACTID, &rv));
        if (NS_FAILED(rv))
          return;

        nsCOMPtr<nsIDOMWindow> newWindow;
        wwatch->OpenWindow(0, "chrome://messenger/content/messageWindow.xul",
                           "_blank", "all,chrome,dialog=no,status,toolbar", msgUri,
                           getter_AddRefs(newWindow));
      }
      else
      {
        nsCOMPtr<nsIMsgWindowCommands> windowCommands;
        topMostMsgWindow->GetWindowCommands(getter_AddRefs(windowCommands));
        if (windowCommands)
          windowCommands->SelectFolder(aUri);
      }
    }

    FocusAppNative();
    nsCOMPtr<nsIDOMWindowInternal> domWindow;
    topMostMsgWindow->GetDomWindow(getter_AddRefs(domWindow));
    domWindow->Focus();
  }
  else
  {
    // the user doesn't have a mail window open already so open one for them...
    nsCOMPtr<nsIMessengerWindowService> messengerWindowService =
      do_GetService(NS_MESSENGERWINDOWSERVICE_CONTRACTID);
    // if we want to preselect the first account with new mail,
    // here is where we would try to generate a uri to pass in
    // (and add code to the messenger window service to make that work)
    if (messengerWindowService)
      messengerWindowService->OpenMessengerWindowWithUri(
                                "mail:3pane", aUri.get(), nsMsgKey_None);
  }
}

nsMessengerOSXIntegration::nsMessengerOSXIntegration()
{
  mBiffStateAtom = do_GetAtom("BiffState");
  mNewMailReceivedAtom = do_GetAtom("NewMailReceived");
  mBiffIconVisible = PR_FALSE;
  NS_NewISupportsArray(getter_AddRefs(mFoldersWithNewMail));
}

nsMessengerOSXIntegration::~nsMessengerOSXIntegration()
{
  if (mBiffIconVisible) 
  {
    RestoreApplicationDockTileImage();
    mBiffIconVisible = PR_FALSE;
  }
}

NS_IMPL_ADDREF(nsMessengerOSXIntegration)
NS_IMPL_RELEASE(nsMessengerOSXIntegration)

NS_INTERFACE_MAP_BEGIN(nsMessengerOSXIntegration)
   NS_INTERFACE_MAP_ENTRY_AMBIGUOUS(nsISupports, nsIMessengerOSIntegration)
   NS_INTERFACE_MAP_ENTRY(nsIMessengerOSIntegration)
   NS_INTERFACE_MAP_ENTRY(nsIFolderListener)
   NS_INTERFACE_MAP_ENTRY(nsIObserver)
NS_INTERFACE_MAP_END


nsresult
nsMessengerOSXIntegration::Init()
{
  // need to register a named Growl notification
  nsresult rv;
  nsCOMPtr<nsIObserverService> observerService = do_GetService("@mozilla.org/observer-service;1", &rv);
  if (NS_SUCCEEDED(rv))
    observerService->AddObserver(this, "before-growl-registration", PR_FALSE);

  nsCOMPtr<nsIMsgMailSession> mailSession = do_GetService(NS_MSGMAILSESSION_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  // because we care if the unread total count changes
  return mailSession->AddFolderListener(this, nsIFolderListener::boolPropertyChanged | nsIFolderListener::intPropertyChanged);
}

NS_IMETHODIMP
nsMessengerOSXIntegration::OnItemPropertyChanged(nsIMsgFolder *, nsIAtom *, char const *, char const *)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMessengerOSXIntegration::OnItemUnicharPropertyChanged(nsIMsgFolder *, nsIAtom *, const PRUnichar *, const PRUnichar *)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMessengerOSXIntegration::OnItemRemoved(nsIMsgFolder *, nsISupports *)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMessengerOSXIntegration::Observe(nsISupports* aSubject, const char* aTopic, const PRUnichar* aData)
{
  if (!strcmp(aTopic, "alertfinished"))
    return OnAlertFinished();

  if (!strcmp(aTopic, "alertclickcallback"))
    return OnAlertClicked(aData);

  // register named Growl notification for new mail alerts.
  if (!strcmp(aTopic, "before-growl-registration"))
  {
    nsresult rv;
    nsCOMPtr<nsIObserverService> observerService = do_GetService("@mozilla.org/observer-service;1", &rv);
    if (NS_SUCCEEDED(rv))
      observerService->RemoveObserver(this, "before-growl-registration");

    nsCOMPtr<nsINotificationsList> notifications = do_QueryInterface(aSubject, &rv);
    if (NS_SUCCEEDED(rv))
    {
      nsCOMPtr<nsIStringBundle> bundle;
      GetStringBundle(getter_AddRefs(bundle));
      if (bundle)
      {
        nsString growlNotification;
        bundle->GetStringFromName(NS_LITERAL_STRING("growlNotification").get(), getter_Copies(growlNotification));
        notifications->AddNotification(growlNotification, PR_TRUE);
      }
    }
  }
  return NS_OK;
}

PRInt32
nsMessengerOSXIntegration::CountNewMessages()
{
  // iterate over all the folders in mFoldersWithNewMail
  nsCOMPtr<nsIMsgFolder> folder;
  nsCOMPtr<nsIWeakReference> weakReference;
  PRInt32 numNewMessages = 0;
  PRInt32 totalNewMessages = 0;
  
  PRUint32 count = 0;
  mFoldersWithNewMail->Count(&count);

  for (PRUint32 index = 0; index < count; index++)
  {
    weakReference = do_QueryElementAt(mFoldersWithNewMail, index);
    folder = do_QueryReferent(weakReference);
    if (folder)
    {
      numNewMessages = 0;   
      folder->GetNumNewMessages(PR_TRUE, &numNewMessages);
      totalNewMessages += numNewMessages;
    } // if we got a folder
  } // for each folder

  return totalNewMessages;
}

nsresult
nsMessengerOSXIntegration::GetStringBundle(nsIStringBundle **aBundle)
{
  NS_ENSURE_ARG_POINTER(aBundle);
  nsresult rv;
  nsCOMPtr<nsIStringBundleService> bundleService = do_GetService(NS_STRINGBUNDLE_CONTRACTID, &rv);
  nsCOMPtr<nsIStringBundle> bundle;
  if (bundleService && NS_SUCCEEDED(rv))
    bundleService->CreateBundle("chrome://messenger/locale/messenger.properties", getter_AddRefs(bundle));
  bundle.swap(*aBundle);
  return rv;
}

void
nsMessengerOSXIntegration::FillToolTipInfo(nsIMsgFolder *aFolder, PRInt32 aNewCount)
{
  if (aFolder)
  {
    nsString authors;
    PRInt32 numNotDisplayed;
    nsresult rv = GetNewMailAuthors(aFolder, authors, aNewCount, &numNotDisplayed);

    // If all senders are vetoed, the authors string will be empty.
    if (NS_FAILED(rv) || authors.IsEmpty())
      return;

    // If this isn't the root folder, get it so we can report for it.
    // GetRootFolder always returns the server's root, so calling on the root itself is fine.
    nsCOMPtr<nsIMsgFolder> rootFolder;
    aFolder->GetRootFolder(getter_AddRefs(rootFolder));
    if (!rootFolder)
      return;

    nsString accountName;
    rootFolder->GetPrettiestName(accountName);

    nsCOMPtr<nsIStringBundle> bundle;
    GetStringBundle(getter_AddRefs(bundle));
    if (bundle)
    {
      nsAutoString numNewMsgsText;
      numNewMsgsText.AppendInt(aNewCount);
      nsString finalText;
      nsCString uri;
      aFolder->GetURI(uri);

      if (numNotDisplayed > 0)
      {
        nsAutoString numNotDisplayedText;
        numNotDisplayedText.AppendInt(numNotDisplayed);
        const PRUnichar *formatStrings[3] = { numNewMsgsText.get(), authors.get(), numNotDisplayedText.get() };
        bundle->FormatStringFromName(NS_LITERAL_STRING("macBiffNotification_messages_extra").get(),
                                     formatStrings,
                                     3,
                                     getter_Copies(finalText));
      }
      else
      {
        const PRUnichar *formatStrings[2] = { numNewMsgsText.get(), authors.get() };

        if (aNewCount == 1)
        {
          bundle->FormatStringFromName(NS_LITERAL_STRING("macBiffNotification_message").get(),
                                       formatStrings,
                                       2,
                                       getter_Copies(finalText));
          // Since there is only 1 message, use the most recent mail's URI instead of the folder's
          nsCOMPtr<nsIMsgDatabase> db;
          rv = aFolder->GetMsgDatabase(getter_AddRefs(db));
          if (NS_SUCCEEDED(rv) && db)
          {
            PRUint32 numNewKeys;
            PRUint32 *newMessageKeys;
            rv = db->GetNewList(&numNewKeys, &newMessageKeys);
            if (NS_SUCCEEDED(rv))
            {
              nsCOMPtr<nsIMsgDBHdr> hdr;
              rv = db->GetMsgHdrForKey(newMessageKeys[numNewKeys - 1],
                                       getter_AddRefs(hdr));
              if (NS_SUCCEEDED(rv) && hdr)
                aFolder->GetUriForMsg(hdr, uri);
            }
            NS_Free(newMessageKeys);
          }
        }
        else
          bundle->FormatStringFromName(NS_LITERAL_STRING("macBiffNotification_messages").get(),
                                       formatStrings,
                                       2,
                                       getter_Copies(finalText));
      }
      ShowAlertMessage(accountName, finalText, uri);
    } // if we got a bundle
  } // if we got a folder
}

nsresult
nsMessengerOSXIntegration::ShowAlertMessage(const nsAString& aAlertTitle,
                                            const nsAString& aAlertText,
                                            const nsACString& aFolderURI)
{
  nsresult rv;
  nsCOMPtr<nsIPrefBranch> prefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  PRBool showAlert = PR_TRUE;
  prefBranch->GetBoolPref(kBiffShowAlertPref, &showAlert);

  if (showAlert)
  {
    // Use growl if installed
    nsCOMPtr<nsIAlertsService> alertsService (do_GetService(NS_ALERTSERVICE_CONTRACTID, &rv));
    if (NS_SUCCEEDED(rv))
    {
      nsCOMPtr<nsIStringBundle> bundle;
      GetStringBundle(getter_AddRefs(bundle));
      if (bundle)
      {
        nsString growlNotification;
        bundle->GetStringFromName(NS_LITERAL_STRING("growlNotification").get(),
                                  getter_Copies(growlNotification));
        rv = alertsService->ShowAlertNotification(NS_LITERAL_STRING(kNewMailAlertIcon),
                                                  aAlertTitle,
                                                  aAlertText,
                                                  PR_TRUE,
                                                  NS_ConvertASCIItoUTF16(aFolderURI),
                                                  this,
                                                  growlNotification);
      }
    }

    PRBool bounceDockIcon = PR_FALSE;
    prefBranch->GetBoolPref("mail.biff.animate_dock_icon", &bounceDockIcon);

    if (bounceDockIcon)
      BounceDockIcon();
  }

  BadgeDockIcon();

  if (!showAlert || NS_FAILED(rv))
    OnAlertFinished();

  return rv;
}

NS_IMETHODIMP
nsMessengerOSXIntegration::OnItemIntPropertyChanged(nsIMsgFolder *aFolder,
                                                    nsIAtom *aProperty,
                                                    PRInt32 aOldValue,
                                                    PRInt32 aNewValue)
{
   // if we got new mail show an alert
  if (mBiffStateAtom == aProperty && mFoldersWithNewMail)
  {
    NS_ENSURE_TRUE(aFolder, NS_OK);

    if (aNewValue == nsIMsgFolder::nsMsgBiffState_NewMail)
    {
      // if the icon is not already visible, only show a system tray icon if
      // we are performing biff (as opposed to the user getting new mail)
      if (!mBiffIconVisible)
      {
        PRBool performingBiff = PR_FALSE;
        nsCOMPtr<nsIMsgIncomingServer> server;
        aFolder->GetServer(getter_AddRefs(server));
        if (server)
          server->GetPerformingBiff(&performingBiff);
        if (!performingBiff)
          return NS_OK; // kick out right now...
      }

      nsCOMPtr<nsIWeakReference> weakFolder = do_GetWeakReference(aFolder);

      if (mFoldersWithNewMail->IndexOf(weakFolder) == -1)
          mFoldersWithNewMail->AppendElement(weakFolder);

      // Biff happens for the root folder, but we want info for the child with new mail
      nsCString folderUri;
      GetFirstFolderWithNewMail(aFolder, folderUri);
      nsCOMPtr<nsIMsgFolder> childFolder;
      nsresult rv = aFolder->GetChildWithURI(folderUri, PR_TRUE, PR_TRUE,
                                             getter_AddRefs(childFolder));
      if (NS_FAILED(rv) || !childFolder)
        return NS_ERROR_FAILURE;

      PRInt32 numNewMessages = 0;
      childFolder->GetNumNewMessages(PR_TRUE, &numNewMessages);
      FillToolTipInfo(childFolder, numNewMessages);
    }
    else if (aNewValue == nsIMsgFolder::nsMsgBiffState_NoMail)
    {
      // we are always going to remove the icon whenever we get our first no
      // mail notification.
      mFoldersWithNewMail->Clear();
      if (mBiffIconVisible)
      {
        RestoreApplicationDockTileImage();
        mBiffIconVisible = PR_FALSE;
      }
    }
  }
  else if (mNewMailReceivedAtom == aProperty)
  {
    nsCOMPtr<nsIMsgFolder> rootFolder;
    nsresult rv = aFolder->GetRootFolder(getter_AddRefs(rootFolder));
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIWeakReference> weakFolder = do_GetWeakReference(rootFolder);
    if (mFoldersWithNewMail->IndexOf(weakFolder) == -1)
      mFoldersWithNewMail->AppendElement(weakFolder);

    FillToolTipInfo(aFolder, aNewValue);
  }
  return NS_OK;
}

nsresult
nsMessengerOSXIntegration::OnAlertClicked(const PRUnichar* aAlertCookie)
{
  openMailWindow(NS_ConvertUTF16toUTF8(aAlertCookie));
  return NS_OK;
}

nsresult
nsMessengerOSXIntegration::OnAlertFinished()
{
  return NS_OK;
}

nsresult
nsMessengerOSXIntegration::BounceDockIcon()
{
  nsCOMPtr<nsIWindowMediator> mediator(do_GetService(NS_WINDOWMEDIATOR_CONTRACTID));
  if (mediator)
  {
    nsCOMPtr<nsIDOMWindowInternal> domWindow;
    mediator->GetMostRecentWindow(NS_LITERAL_STRING("mail:3pane").get(), getter_AddRefs(domWindow));
    if (domWindow)
    {
      nsCOMPtr<nsIDOMChromeWindow> chromeWindow(do_QueryInterface(domWindow));
      chromeWindow->GetAttention();
    }
  }
  return NS_OK;
}

nsresult
nsMessengerOSXIntegration::BadgeDockIcon()
{
  // This will change the dock icon. If we want to overlay the number of
  // new messages on top of the icon use OverlayApplicationDockTileImage
  // you'll have to pass it a CGImage, and somehow we have to/ create
  // the CGImage with the numbers. tricky    
  PRInt32 totalNewMessages = CountNewMessages();
  CGContextRef context = ::BeginCGContextForApplicationDockTile();
    
  // Draw a circle.
  ::CGContextBeginPath(context);
  ::CGContextAddArc(context, 95.0, 95.0, 25.0, 0.0, 2 * M_PI, true);
  ::CGContextClosePath(context);

  // use #2fc600 for the color.
  ::CGContextSetRGBFillColor(context, 0.184, 0.776, 0.0, 1);
  ::CGContextFillPath(context);

  // Draw the number.
  nsAutoString total;
  total.AppendInt(totalNewMessages);

  // Use a system font (kThemeUtilityWindowTitleFont)
  ScriptCode sysScript = ::GetScriptManagerVariable(smSysScript);

  Str255 fontName;
  SInt16 fontSize;
  Style fontStyle;
  ::GetThemeFont(kThemeSmallEmphasizedSystemFont, sysScript, fontName,
                 &fontSize, &fontStyle);

  FMFontFamily family = ::FMGetFontFamilyFromName(fontName);
  FMFont fmFont;

  if (::FMGetFontFromFontFamilyInstance(family,
                                        fontStyle,
                                        &fmFont,
                                        nsnull) != noErr)
  {
    NS_WARNING("FMGetFontFromFontFamilyInstance failed");
    ::EndCGContextForApplicationDockTile(context);
    return NS_ERROR_FAILURE;
  }

  ATSUStyle style;
  if (::ATSUCreateStyle(&style) != noErr) 
  {
    NS_WARNING("ATSUCreateStyle failed");
    ::EndCGContextForApplicationDockTile(context);
    return NS_ERROR_FAILURE;
  }
        
  Fixed size = Long2Fix(24);
  RGBColor white = { 0xFFFF, 0xFFFF, 0xFFFF };
    
  ATSUAttributeTag tags[3] = { kATSUFontTag, kATSUSizeTag, kATSUColorTag };
  ByteCount valueSizes[3] = { sizeof(ATSUFontID), sizeof(Fixed),
                              sizeof(RGBColor) };
  ATSUAttributeValuePtr values[3] = { &fmFont, &size, &white };

  if (::ATSUSetAttributes(style, 3, tags, valueSizes, values) != noErr) 
  {
    NS_WARNING("ATSUSetAttributes failed");
    ::ATSUDisposeStyle(style);
    ::EndCGContextForApplicationDockTile(context);
    return NS_ERROR_FAILURE;
  }

  UniCharCount runLengths = kATSUToTextEnd;
  ATSUTextLayout textLayout;
  if (::ATSUCreateTextLayoutWithTextPtr(total.get(), 
                                        kATSUFromTextBeginning, 
                                        kATSUToTextEnd, 
                                        total.Length(), 
                                        1, 
                                        &runLengths, 
                                        &style, 
                                        &textLayout) != noErr) 
  {
    NS_WARNING("ATSUCreateTextLayoutWithTextPtr failed");
    ::ATSUDisposeStyle(style);
    ::EndCGContextForApplicationDockTile(context);
    return NS_ERROR_FAILURE;
  }

  ATSUAttributeTag layoutTags[1] = { kATSUCGContextTag };
  ByteCount layoutValueSizes[1] = { sizeof(CGContextRef) };
  ATSUAttributeValuePtr layoutValues[1] = { &context };

  if (::ATSUSetLayoutControls(textLayout, 
                              1, 
                              layoutTags, 
                              layoutValueSizes, 
                              layoutValues) != noErr) 
  {
    NS_WARNING("ATSUSetLayoutControls failed");
    ::ATSUDisposeStyle(style);
    ::EndCGContextForApplicationDockTile(context);
    return NS_ERROR_FAILURE;
  }

  Rect boundingBox;
  if (::ATSUMeasureTextImage(textLayout, 
                             kATSUFromTextBeginning,
                             kATSUToTextEnd,
                             Long2Fix(0),
                             Long2Fix(0),
                             &boundingBox) != noErr) 
  {
    NS_WARNING("ATSUMeasureTextImage failed");
    ::ATSUDisposeStyle(style);
    ::EndCGContextForApplicationDockTile(context);
    return NS_ERROR_FAILURE;
  }

  // Center text inside circle
  ::ATSUDrawText(textLayout, kATSUFromTextBeginning, kATSUToTextEnd,
                 Long2Fix(90 - (boundingBox.right - boundingBox.left) / 2),
                 Long2Fix(95 - (boundingBox.bottom - boundingBox.top) / 2));

  ::ATSUDisposeStyle(style);
  ::ATSUDisposeTextLayout(textLayout);

  ::CGContextFlush(context);
  ::EndCGContextForApplicationDockTile(context);

  mBiffIconVisible = PR_TRUE;
  return NS_OK;
}

NS_IMETHODIMP
nsMessengerOSXIntegration::OnItemPropertyFlagChanged(nsIMsgDBHdr *item, nsIAtom *property, PRUint32 oldFlag, PRUint32 newFlag)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMessengerOSXIntegration::OnItemAdded(nsIMsgFolder *, nsISupports *)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMessengerOSXIntegration::OnItemBoolPropertyChanged(nsIMsgFolder *aItem,
                                                         nsIAtom *aProperty,
                                                         PRBool aOldValue,
                                                         PRBool aNewValue)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMessengerOSXIntegration::OnItemEvent(nsIMsgFolder *, nsIAtom *)
{
  return NS_OK;
}

nsresult
nsMessengerOSXIntegration::GetNewMailAuthors(nsIMsgFolder* aFolder,
                                             nsString& aAuthors,
                                             PRInt32 aNewCount,
                                             PRInt32* aNotDisplayed)
{
  // Get a list of names or email addresses for the folder's authors
  // with new mail. Note that we only process the most recent "new"
  // mail (aNewCount), working from most recently added. Duplicates
  // are removed, and names are displayed to a set limit
  // (kMaxDisplayCount) with the remaining count being returned in
  // aNotDisplayed. Extension developers can listen for
  // "newmail-notification-requested" and then make a decision about
  // including a given author or not. As a result, it is possible that
  // the resulting length of aAuthors will be 0.
  nsCOMPtr<nsIMsgDatabase> db;
  nsresult rv = aFolder->GetMsgDatabase(getter_AddRefs(db));
  PRUint32 numNewKeys = 0;
  if (NS_SUCCEEDED(rv) && db)
  {
    nsCOMPtr<nsIMsgHeaderParser> parser =
      do_GetService(NS_MAILNEWS_MIME_HEADER_PARSER_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIObserverService> os =
      do_GetService("@mozilla.org/observer-service;1", &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    // Get proper l10n list separator -- ", " in English
    nsCOMPtr<nsIStringBundle> bundle;
    GetStringBundle(getter_AddRefs(bundle));
    if (!bundle)
      return NS_ERROR_FAILURE;

    PRUint32 *newMessageKeys;
    rv = db->GetNewList(&numNewKeys, &newMessageKeys);
    if (NS_SUCCEEDED(rv))
    {
      nsString listSeparator;
      bundle->GetStringFromName(NS_LITERAL_STRING("macBiffNotification_separator").get(), getter_Copies(listSeparator));

      PRInt32 displayed = 0;
      for (PRInt32 i = numNewKeys - 1; i >= 0; i--, aNewCount--)
      {
        if (0 == aNewCount || displayed == kMaxDisplayCount)
          break;
  
        nsCOMPtr<nsIMsgDBHdr> hdr;
        rv = db->GetMsgHdrForKey(newMessageKeys[i],
                                 getter_AddRefs(hdr));
        if (NS_SUCCEEDED(rv) && hdr)
        {
          nsString author;
          rv = hdr->GetMime2DecodedAuthor(author);
          if (NS_FAILED(rv))
            continue;

          nsCString name;
          rv = parser->ExtractHeaderAddressName(NS_ConvertUTF16toUTF8(author),
                                                name);
          if (NS_FAILED(rv))
            continue;

          // Give extensions a chance to suppress notifications for this author
          nsCOMPtr<nsISupportsPRBool> notify =
            do_CreateInstance(NS_SUPPORTS_PRBOOL_CONTRACTID);

          notify->SetData(PR_TRUE);
          os->NotifyObservers(notify, "newmail-notification-requested",
                              PromiseFlatString(author).get());

          PRBool includeSender;
          notify->GetData(&includeSender);

          // Don't add unwanted or duplicate names
          if (includeSender &&
              aAuthors.Find(name, PR_TRUE, 0, -1) == -1)
          {
            if (displayed > 0)
              aAuthors.Append(listSeparator);
            aAuthors.Append(NS_ConvertUTF8toUTF16(name));
            displayed++;
          }
        }
      }
    }
    NS_Free(newMessageKeys);
  }
  *aNotDisplayed = aNewCount;
  return rv;
}

nsresult
nsMessengerOSXIntegration::GetFirstFolderWithNewMail(nsIMsgFolder* aFolder, nsCString& aFolderURI)
{
  // Find the subfolder in aFolder with new mail and return the folderURI
  if (aFolder)
  {
    nsCOMPtr<nsIMsgFolder> msgFolder;
    // enumerate over the folders under this root folder till we find one with new mail....
    nsCOMPtr<nsISupportsArray> allFolders;
    NS_NewISupportsArray(getter_AddRefs(allFolders));
    nsresult rv = aFolder->ListDescendents(allFolders);
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIEnumerator> enumerator;
    allFolders->Enumerate(getter_AddRefs(enumerator));
    if (enumerator)
    {
      nsCOMPtr<nsISupports> supports;
      PRInt32 numNewMessages = 0;
      nsresult more = enumerator->First();
      while (NS_SUCCEEDED(more))
      {
        rv = enumerator->CurrentItem(getter_AddRefs(supports));
        if (supports)
        {
          msgFolder = do_QueryInterface(supports, &rv);
          if (msgFolder)
          {
            numNewMessages = 0;
            msgFolder->GetNumNewMessages(PR_FALSE, &numNewMessages);
            if (numNewMessages)
              break; // kick out of the while loop
            more = enumerator->Next();
          }
        } // if we have a folder
      }  // if we have more potential folders to enumerate
    }  // if enumerator

    if (msgFolder)
      msgFolder->GetURI(aFolderURI);
  }

  return NS_OK;
}
