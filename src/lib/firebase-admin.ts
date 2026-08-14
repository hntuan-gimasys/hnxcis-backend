/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { env } from '../config/env.ts';

let cachedAuth: Auth | null = null;

/**
 * On Cloud Run the runtime service account provides Application Default
 * Credentials, so no key file is needed. Locally, run
 * `gcloud auth application-default login` or set GOOGLE_APPLICATION_CREDENTIALS.
 */
export function getAdminAuth(): Auth {
  if (!cachedAuth) {
    if (!getApps().length) {
      initializeApp({
        credential: applicationDefault(),
        projectId: env.firebase.projectId,
      });
    }
    cachedAuth = getAuth();
  }
  return cachedAuth;
}
