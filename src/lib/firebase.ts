/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from './mockFirebaseApp';
import { getAuth } from './mockFirebaseAuth';
import { getFirestore } from './mockFirebaseFirestore';

const firebaseConfig = {
  apiKey: "local-storage-key",
  authDomain: "local-storage",
  projectId: "local-storage",
  storageBucket: "local-storage",
  messagingSenderId: "00000000",
  appId: "1:00000000:web:local-storage"
};

// Initialize Mock Firebase
const app = initializeApp(firebaseConfig);

// Initialize Mock Firestore and Auth
export const db = getFirestore(app) as any;
export const auth = getAuth(app) as any;
