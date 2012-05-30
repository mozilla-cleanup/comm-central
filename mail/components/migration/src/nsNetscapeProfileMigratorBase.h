/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef netscapeprofilemigratorbase___h___
#define netscapeprofilemigratorbase___h___

#include "nsILocalFile.h"
#include "nsIStringBundle.h"
#include "nsStringGlue.h"
#include "nsTArray.h"
#include "nsIObserverService.h"
#include "nsITimer.h"
#include "nsIMailProfileMigrator.h"

class nsIPrefBranch;
class nsIMutableArray;

struct fileTransactionEntry {
  nsCOMPtr<nsIFile> srcFile;  // the src path including leaf name
  nsCOMPtr<nsIFile> destFile; // the destination path
  nsString newName; // only valid if the file should be renamed after getting copied
};

#define F(a) nsNetscapeProfileMigratorBase::a

#define MAKEPREFTRANSFORM(pref, newpref, getmethod, setmethod) \
  { pref, newpref, F(Get##getmethod), F(Set##setmethod), false, { -1 } }

#define MAKESAMETYPEPREFTRANSFORM(pref, method) \
  { pref, 0, F(Get##method), F(Set##method), false, { -1 } }

class nsNetscapeProfileMigratorBase : public nsIMailProfileMigrator,
                                      public nsITimerCallback
                                      
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSITIMERCALLBACK

  nsNetscapeProfileMigratorBase();
  virtual ~nsNetscapeProfileMigratorBase() { };

  NS_IMETHOD GetSourceHasMultipleProfiles(bool* aResult);
  NS_IMETHOD GetSourceExists(bool* aResult);

  struct PrefTransform;
  typedef nsresult(*prefConverter)(PrefTransform*, nsIPrefBranch*);

  struct PrefTransform {
    const char*   sourcePrefName;
    const char*   targetPrefName;
    prefConverter prefGetterFunc;
    prefConverter prefSetterFunc;
    bool          prefHasValue;
    union {
      PRInt32     intValue;
      bool        boolValue;
      char*       stringValue;
    };
  };

  struct PrefBranchStruct {
    char*         prefName;
    PRInt32       type;
    union {
      char*       stringValue;
      PRInt32     intValue;
      bool        boolValue;
    };
  };

  typedef nsTArray<PrefBranchStruct*> PBStructArray;

  static nsresult GetString(PrefTransform* aTransform, nsIPrefBranch* aBranch);
  static nsresult SetString(PrefTransform* aTransform, nsIPrefBranch* aBranch);
  static nsresult GetBool(PrefTransform* aTransform, nsIPrefBranch* aBranch);
  static nsresult SetBool(PrefTransform* aTransform, nsIPrefBranch* aBranch);
  static nsresult GetInt(PrefTransform* aTransform, nsIPrefBranch* aBranch);
  static nsresult SetInt(PrefTransform* aTransform, nsIPrefBranch* aBranch);

  nsresult RecursiveCopy(nsIFile* srcDir, nsIFile* destDir); // helper routine

protected:
  void CopyNextFolder();
  void EndCopyFolders();

  nsresult GetProfileDataFromProfilesIni(nsILocalFile* aDataDir,
                                         nsIMutableArray* aProfileNames,
                                         nsIMutableArray* aProfileLocations);

  nsresult CopyFile(const nsAString& aSourceFileName, const nsAString& aTargetFileName);

  nsresult GetSignonFileName(bool aReplace, char** aFileName);
  nsresult LocateSignonsFile(char** aResult);

  nsCOMPtr<nsILocalFile> mSourceProfile;
  nsCOMPtr<nsIFile> mTargetProfile;

  // List of src/destination files we still have to copy into the new profile
  // directory.
  nsTArray<fileTransactionEntry> mFileCopyTransactions;
  PRUint32 mFileCopyTransactionIndex;

  PRInt64 mMaxProgress;
  PRInt64 mCurrentProgress;

  nsCOMPtr<nsIObserverService> mObserverService;
  nsCOMPtr<nsITimer> mFileIOTimer;
};
 
#endif
