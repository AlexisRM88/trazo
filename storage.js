const DB_NAME = 'TechSnapDB';
const DB_VERSION = 1;
const STORE_NAME = 'captures';
const MAX_CAPTURES = 100;

/**
 * Opens (or initializes) the TechSnap IndexedDB database.
 * @returns {Promise<IDBDatabase>}
 */
export function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves a capture record to IndexedDB and trims oldest items if over MAX_CAPTURES.
 * @param {Object} capture
 * @returns {Promise<{ item: Object, count: number }>}
 */
export async function saveCapture(capture) {
  const db = await openDB();
  const item = {
    id: capture.id || `ts_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    dataUrl: capture.dataUrl,
    selector: capture.selector || 'Área libre',
    width: capture.width || 0,
    height: capture.height || 0,
    mode: capture.mode || 'element',
    infoEnabled: Boolean(capture.infoEnabled),
    pageUrl: capture.pageUrl || '',
    hostname: capture.hostname || '',
    createdAt: capture.createdAt || Date.now()
  };

  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  const all = await getCaptures();
  if (all.length > MAX_CAPTURES) {
    const toDelete = all.slice(MAX_CAPTURES);
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const old of toDelete) {
        store.delete(old.id);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return { item, count: MAX_CAPTURES };
  }

  return { item, count: all.length };
}

/**
 * Lists all saved captures sorted from newest to oldest.
 * @returns {Promise<Array<Object>>}
 */
export async function getCaptures() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const items = Array.isArray(request.result) ? request.result : [];
      items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      resolve(items);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Deletes a single capture by ID.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteCapture(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Deletes all saved captures.
 * @returns {Promise<void>}
 */
export async function clearCaptures() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
