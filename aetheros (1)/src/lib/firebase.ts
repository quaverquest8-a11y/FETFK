/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAaWqo-pvpUzXXuMZNnYEUcqFzXX52vIK8",
  authDomain: "gen-lang-client-0659124384.firebaseapp.com",
  projectId: "gen-lang-client-0659124384",
  storageBucket: "gen-lang-client-0659124384.firebasestorage.app",
  messagingSenderId: "313785081194",
  appId: "1:313785081194:web:38b4620d53ad271df95913"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with custom databaseId using getFirestore(app, databaseId)
export const db = getFirestore(app, "ai-studio-7e81ec57-5993-4c6b-b4e3-2a18823f73db");

// Initialize Auth
export const auth = getAuth(app);
