/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const listeners: Array<(user: any) => void> = [];

function getStoredUsers() {
  const raw = localStorage.getItem('aether_db_users');
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  }

  // Pre-populate default users if not found
  const defaultUsers = [
    {
      id: 'quaver-user-id',
      email: 'quaver@aetheros.com',
      password: 'BenisBest@1',
      userName: 'Quaver',
      isAdmin: true,
      createdAt: Date.now(),
      lastAccessed: Date.now()
    },
    {
      id: 'demo-user-id',
      email: 'demo@aetheros.com',
      password: 'demo1234',
      userName: 'Demo User',
      isAdmin: false,
      createdAt: Date.now(),
      lastAccessed: Date.now()
    }
  ];
  localStorage.setItem('aether_db_users', JSON.stringify(defaultUsers));
  return defaultUsers;
}

function getStoredCurrentUser() {
  const raw = localStorage.getItem('aether_current_user');
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }
  return null;
}

export function getAuth(app?: any) {
  return {
    currentUser: getStoredCurrentUser()
  };
}

export function onAuthStateChanged(auth: any, callback: (user: any) => void) {
  listeners.push(callback);
  
  // Call immediately with current state
  const currentUser = getStoredCurrentUser();
  callback(currentUser);

  // Return unsubscribe
  return () => {
    const idx = listeners.indexOf(callback);
    if (idx !== -1) {
      listeners.splice(idx, 1);
    }
  };
}

export async function signOut(auth: any) {
  localStorage.removeItem('aether_current_user');
  listeners.forEach(cb => cb(null));
  return Promise.resolve();
}

export async function signInWithEmailAndPassword(auth: any, emailInput: string, passwordInput: string) {
  let email = emailInput.trim();
  if (email.toLowerCase() === 'quaver') {
    email = 'quaver@aetheros.com';
  }

  const users = getStoredUsers();
  const found = users.find((u: any) => u.email.toLowerCase() === email.toLowerCase() && u.password === passwordInput);

  if (!found) {
    const err = new Error('Invalid email/username or password.');
    (err as any).code = 'auth/invalid-credential';
    throw err;
  }

  const sessionUser = {
    uid: found.id,
    email: found.email,
    isGuest: false
  };

  localStorage.setItem('aether_current_user', JSON.stringify(sessionUser));
  listeners.forEach(cb => cb(sessionUser));

  return { user: sessionUser };
}

export async function createUserWithEmailAndPassword(auth: any, emailInput: string, passwordInput: string) {
  const email = emailInput.trim();
  const users = getStoredUsers();

  const found = users.find((u: any) => u.email.toLowerCase() === email.toLowerCase());
  if (found) {
    const err = new Error('An account already exists with this email.');
    (err as any).code = 'auth/email-already-in-use';
    throw err;
  }

  const uid = `user-${Date.now()}`;
  const newUser = {
    id: uid,
    email: email,
    password: passwordInput,
    userName: email.split('@')[0],
    createdAt: Date.now(),
    lastAccessed: Date.now()
  };

  users.push(newUser);
  localStorage.setItem('aether_db_users', JSON.stringify(users));

  const sessionUser = {
    uid: uid,
    email: email,
    isGuest: false
  };

  localStorage.setItem('aether_current_user', JSON.stringify(sessionUser));
  listeners.forEach(cb => cb(sessionUser));

  return { user: sessionUser };
}
