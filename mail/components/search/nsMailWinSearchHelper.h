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
 * The Original Code is Windows Search integration.
 *
 * The Initial Developer of the Original Code is
 *  Siddharth Agarwal <sid1337@gmail.com>.
 * Portions created by the Initial Developer are Copyright (C) 2008
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

#ifndef nsMailWinSearchHelper_h_
#define nsMailWinSearchHelper_h_

#include "nsIMailWinSearchHelper.h"
#include "nsIFile.h"

#define NS_MAILWINSEARCHHELPER_CID \
{0x5dd31c99, 0x8c7, 0x4a3b, {0xae, 0xb3, 0xd2, 0xe6, 0x6, 0x65, 0xa3, 0x1a}}

class nsMailWinSearchHelper : public nsIMailWinSearchHelper
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIMAILWINSEARCHHELPER

  NS_HIDDEN_(nsresult) Init();
  nsMailWinSearchHelper();

private:
  ~nsMailWinSearchHelper();
  nsCOMPtr<nsIFile> mProfD;
  nsCOMPtr<nsIFile> mCurProcD;
};

#endif
