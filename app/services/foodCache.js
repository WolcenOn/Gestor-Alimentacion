const DB_NAME = "gestor-alimentacion-food-cache";
const DB_VERSION = 1;
const STORE_FOODS = "foods";
const STORE_SEARCHES = "searches";
const MAX_FOODS = 500;

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      resolve(null);
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_FOODS)) {
        const foods = db.createObjectStore(STORE_FOODS, { keyPath: "id" });
        foods.createIndex("ts", "ts");
        foods.createIndex("source", "source");
      }
      if (!db.objectStoreNames.contains(STORE_SEARCHES)) {
        const searches = db.createObjectStore(STORE_SEARCHES, { keyPath: "key" });
        searches.createIndex("ts", "ts");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function tx(storeName, mode, callback) {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const result = callback(store);
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
  });
}

function getFromStore(storeName, key) {
  return tx(storeName, "readonly", store => new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  }));
}

function putIntoStore(storeName, value) {
  return tx(storeName, "readwrite", store => store.put(value));
}

async function countStore(storeName) {
  return tx(storeName, "readonly", store => new Promise(resolve => {
    const request = store.count();
    request.onsuccess = () => resolve(request.result || 0);
    request.onerror = () => resolve(0);
  })) || 0;
}

async function evictOldestFoods() {
  const count = await countStore(STORE_FOODS);
  if (count <= MAX_FOODS) return;
  const db = await openDb();
  if (!db) return;
  await new Promise(resolve => {
    const transaction = db.transaction(STORE_FOODS, "readwrite");
    const store = transaction.objectStore(STORE_FOODS);
    const index = store.index("ts");
    const request = index.openCursor(null, "next");
    let deleted = 0;
    const toDelete = count - MAX_FOODS;
    request.onsuccess = event => {
      const cursor = event.target.result;
      if (cursor && deleted < toDelete) {
        cursor.delete();
        deleted += 1;
        cursor.continue();
      }
    };
    transaction.oncomplete = resolve;
    transaction.onerror = resolve;
  });
}

export function cacheKey(source, lang, query) {
  return `${source}:${lang || "any"}:${String(query || "").trim().toLowerCase()}`;
}

export async function cacheFood(food) {
  if (!food) return;
  const id = String(food.id || food.barcode || food.fdcId || `${food.source || "food"}-${Date.now()}`);
  await putIntoStore(STORE_FOODS, { ...food, id, ts: Date.now() });
  await evictOldestFoods();
}

export async function getCachedFood(id) {
  return getFromStore(STORE_FOODS, String(id));
}

export async function cacheSearch(key, foodIds) {
  await putIntoStore(STORE_SEARCHES, { key, ids: foodIds.map(String), ts: Date.now() });
}

export async function getCachedSearch(key) {
  const search = await getFromStore(STORE_SEARCHES, key);
  if (!search) return null;
  const foods = await Promise.all((search.ids || []).map(id => getCachedFood(id)));
  return foods.filter(Boolean);
}

export async function getFoodCacheStats() {
  return {
    foods: await countStore(STORE_FOODS),
    searches: await countStore(STORE_SEARCHES),
    supported: "indexedDB" in window
  };
}
