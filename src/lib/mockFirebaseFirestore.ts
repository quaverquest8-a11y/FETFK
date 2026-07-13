/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Helper to load a collection from localStorage
function getCollection(name: string): any[] {
  const key = `aether_db_${name}`;
  const raw = localStorage.getItem(key);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  }
  return [];
}

// Helper to save a collection to localStorage
function saveCollection(name: string, data: any[]) {
  const key = `aether_db_${name}`;
  localStorage.setItem(key, JSON.stringify(data));
}

export function getFirestore(app?: any, databaseId?: string) {
  return {};
}

export function collection(db: any, path: string) {
  return { type: 'collection', collectionName: path };
}

export function doc(...args: any[]) {
  if (args.length === 3) {
    return { type: 'doc', collectionName: args[1], id: args[2] };
  }
  if (args.length === 2 && args[0] && args[0].type === 'collection') {
    return { type: 'doc', collectionName: args[0].collectionName, id: args[1] };
  }
  if (args.length === 2 && typeof args[1] === 'string') {
    const parts = args[1].split('/');
    return { type: 'doc', collectionName: parts[0], id: parts[1] };
  }
  return { type: 'doc', collectionName: 'unknown', id: 'unknown' };
}

export function query(collectionRef: any, ...constraints: any[]) {
  return {
    type: 'query',
    collectionName: collectionRef.collectionName,
    constraints: constraints
  };
}

export function where(field: string, op: string, value: any) {
  return { type: 'where', field, op, value };
}

export function orderBy(field: string, dir: 'asc' | 'desc' = 'asc') {
  return { type: 'orderBy', field, dir };
}

export function limit(num: number) {
  return { type: 'limit', value: num };
}

export async function addDoc(collectionRef: any, data: any) {
  const name = collectionRef.collectionName;
  const list = getCollection(name);
  const id = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const newItem = { id, ...data };
  list.push(newItem);
  saveCollection(name, list);
  return { id, path: `${name}/${id}` };
}

export async function setDoc(docRef: any, data: any, options?: { merge?: boolean }) {
  const name = docRef.collectionName;
  const list = getCollection(name);
  const idx = list.findIndex((item: any) => item.id === docRef.id);

  if (idx !== -1) {
    if (options?.merge) {
      list[idx] = { ...list[idx], ...data };
    } else {
      list[idx] = { id: docRef.id, ...data };
    }
  } else {
    list.push({ id: docRef.id, ...data });
  }

  saveCollection(name, list);
  return Promise.resolve();
}

export async function updateDoc(docRef: any, data: any) {
  const name = docRef.collectionName;
  const list = getCollection(name);
  const idx = list.findIndex((item: any) => item.id === docRef.id);

  if (idx !== -1) {
    list[idx] = { ...list[idx], ...data };
    saveCollection(name, list);
  } else {
    // If updating a user and we only have it in users collection
    list.push({ id: docRef.id, ...data });
    saveCollection(name, list);
  }

  return Promise.resolve();
}

export async function deleteDoc(docRef: any) {
  const name = docRef.collectionName;
  let list = getCollection(name);
  list = list.filter((item: any) => item.id !== docRef.id);
  saveCollection(name, list);
  return Promise.resolve();
}

export async function getDoc(docRef: any) {
  const name = docRef.collectionName;
  const list = getCollection(name);
  const found = list.find((item: any) => item.id === docRef.id);

  return {
    exists: () => !!found,
    id: docRef.id,
    data: () => found
  };
}

export async function getDocs(queryOrCollection: any) {
  const name = queryOrCollection.collectionName;
  const constraints = queryOrCollection.constraints || [];
  let list = getCollection(name);

  // Apply filters
  for (const c of constraints) {
    if (c.type === 'where') {
      const { field, op, value } = c;
      list = list.filter((item: any) => {
        if (op === '==') {
          return item[field] === value;
        }
        return true;
      });
    }
  }

  // Apply sorting
  for (const c of constraints) {
    if (c.type === 'orderBy') {
      const { field, dir } = c;
      list.sort((a: any, b: any) => {
        const valA = a[field] ?? 0;
        const valB = b[field] ?? 0;
        if (valA < valB) return dir === 'asc' ? -1 : 1;
        if (valA > valB) return dir === 'asc' ? 1 : -1;
        return 0;
      });
    }
  }

  // Apply limit
  for (const c of constraints) {
    if (c.type === 'limit') {
      list = list.slice(0, c.value);
    }
  }

  return {
    docs: list.map((item: any) => ({
      id: item.id,
      data: () => item
    }))
  };
}
