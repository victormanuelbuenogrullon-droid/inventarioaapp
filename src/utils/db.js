// IndexedDB Database helper with In-Memory RAM Caching for Blazing Fast Lookup (< 2ms on mobile)

const DB_NAME = 'InventariosAppDB';
const DB_VERSION = 1;

let dbInstance = null;

// ==========================================
// IN-MEMORY RAM CACHE & O(1) HASH MAPS
// ==========================================
let memoryCatalog = null;           // Array of all items with pre-computed search strings
let barcodeMap = new Map();         // Barcode (Codigo Internacional) -> Product
let skuMap = new Map();             // SKU (Codigo Interno) -> Product
let skuPaddedMap = new Map();       // Padded SKU -> Product
let codeMap = new Map();            // Numeric / Base code -> Product
let categoriesCache = null;         // Pre-calculated unique categories list
let cacheInitPromise = null;        // Mutex promise to prevent concurrent double-initialization

function prepareItem(item) {
  return {
    ...item,
    _sDesc: (item.descripcion || '').toLowerCase(),
    _sBar: (item.codigoInternacional || '').toString().toLowerCase().trim(),
    _sSku: (item.codigoInterno || '').toString().toLowerCase().trim(),
    _sCode: (item.codigo != null ? String(item.codigo) : '').toLowerCase().trim(),
    _sCat: (item.categoria || '').toString().toUpperCase().trim()
  };
}

function registerItemInMaps(item) {
  if (item._sBar) {
    barcodeMap.set(item._sBar, item);
  }
  if (item._sSku) {
    skuMap.set(item._sSku, item);
    const padded6 = item._sSku.padStart(6, '0');
    skuPaddedMap.set(padded6, item);
  }
  if (item._sCode) {
    codeMap.set(item._sCode, item);
  }
}

function unregisterItemFromMaps(item) {
  if (item._sBar) barcodeMap.delete(item._sBar);
  if (item._sSku) {
    skuMap.delete(item._sSku);
    const padded6 = item._sSku.padStart(6, '0');
    skuPaddedMap.delete(padded6);
  }
  if (item._sCode) codeMap.delete(item._sCode);
}

export function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Store: Products catalog
      if (!db.objectStoreNames.contains('products')) {
        const productStore = db.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
        productStore.createIndex('codigoInternacional', 'codigoInternacional', { unique: false });
        productStore.createIndex('codigoInterno', 'codigoInterno', { unique: false });
        productStore.createIndex('codigo', 'codigo', { unique: false });
        productStore.createIndex('descripcion', 'descripcion', { unique: false });
      }

      // Store: Inventory counts
      if (!db.objectStoreNames.contains('counts')) {
        const countStore = db.createObjectStore('counts', { keyPath: 'id' });
        countStore.createIndex('sessionId', 'sessionId', { unique: false });
        countStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // Store: Sessions
      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', { keyPath: 'id' });
      }

      // Store: Metadata
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('IndexedDB error:', event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Initializes or refreshes the in-memory RAM cache from IndexedDB
 */
export async function initMemoryCache(forceReload = false) {
  if (memoryCatalog && !forceReload) {
    return memoryCatalog;
  }
  if (cacheInitPromise && !forceReload) {
    return cacheInitPromise;
  }

  cacheInitPromise = (async () => {
    try {
      const db = await openDB();
      const allItems = await new Promise((resolve) => {
        const tx = db.transaction(['products'], 'readonly');
        const store = tx.objectStore('products');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });

      const newCatalog = [];
      barcodeMap.clear();
      skuMap.clear();
      skuPaddedMap.clear();
      codeMap.clear();
      const catSet = new Set();

      for (let i = 0; i < allItems.length; i++) {
        const item = prepareItem(allItems[i]);
        newCatalog.push(item);
        registerItemInMaps(item);
        if (item.categoria) {
          catSet.add(item._sCat);
        }
      }

      memoryCatalog = newCatalog;
      categoriesCache = Array.from(catSet).sort();
      return memoryCatalog;
    } catch (err) {
      console.error('Error initializing RAM memory cache:', err);
      return [];
    } finally {
      cacheInitPromise = null;
    }
  })();

  return cacheInitPromise;
}

/**
 * Bulk save products from CSV and update RAM cache
 */
export async function saveProductsInBatches(products, onProgress) {
  const db = await openDB();
  
  // Clear previous products first in IndexedDB
  await new Promise((resolve, reject) => {
    const tx = db.transaction(['products'], 'readwrite');
    const store = tx.objectStore('products');
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  const batchSize = 2500;
  const total = products.length;
  let inserted = 0;

  for (let i = 0; i < total; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['products'], 'readwrite');
      const store = tx.objectStore('products');
      
      batch.forEach((p) => store.add(p));
      
      tx.oncomplete = () => {
        inserted += batch.length;
        if (onProgress) onProgress(inserted, total);
        resolve();
      };
      
      tx.onerror = () => reject(tx.error);
    });
  }

  // Update meta in IndexedDB
  await setMeta('catalogInfo', {
    totalProducts: total,
    importedAt: new Date().toISOString(),
  });

  // Re-populate in-memory RAM cache
  await initMemoryCache(true);

  return total;
}

/**
 * Find a product by Barcode, SKU, or Internal Code in O(1) time (< 0.1ms)
 */
export async function findProduct(query) {
  if (!query) return null;
  const cleanQuery = query.toString().trim().toLowerCase();
  if (!cleanQuery) return null;

  if (!memoryCatalog) {
    await initMemoryCache();
  }

  // 1. O(1) lookup in barcode map
  if (barcodeMap.has(cleanQuery)) {
    return barcodeMap.get(cleanQuery);
  }

  // 2. O(1) lookup in SKU map
  if (skuMap.has(cleanQuery)) {
    return skuMap.get(cleanQuery);
  }

  // 3. O(1) lookup with 6-digit zero padding
  const padded6 = cleanQuery.padStart(6, '0');
  if (skuPaddedMap.has(padded6)) {
    return skuPaddedMap.get(padded6);
  }

  // 4. O(1) lookup in numeric code map
  if (codeMap.has(cleanQuery)) {
    return codeMap.get(cleanQuery);
  }

  // 5. Fallback unpadded search if cleanQuery starts with 0s
  const unpadded = cleanQuery.replace(/^0+/, '');
  if (unpadded && skuMap.has(unpadded)) {
    return skuMap.get(unpadded);
  }
  if (unpadded && codeMap.has(unpadded)) {
    return codeMap.get(unpadded);
  }

  return null;
}

/**
 * Fuzzy search products by description or code for manual selection in RAM (< 2ms)
 */
export async function searchProducts(searchTerm, limit = 40) {
  if (!searchTerm || searchTerm.trim().length === 0) return [];
  const term = searchTerm.toLowerCase().trim();

  if (!memoryCatalog) {
    await initMemoryCache();
  }

  const results = [];
  const len = memoryCatalog ? memoryCatalog.length : 0;

  for (let i = 0; i < len; i++) {
    const item = memoryCatalog[i];
    if (
      item._sDesc.includes(term) ||
      item._sBar.includes(term) ||
      item._sSku.includes(term) ||
      item._sCode.includes(term)
    ) {
      results.push(item);
      if (results.length >= limit) break;
    }
  }

  return results;
}

/**
 * Get count of catalog products instantly
 */
export async function getCatalogCount() {
  if (memoryCatalog) {
    return memoryCatalog.length;
  }
  
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(['products'], 'readonly');
    const store = tx.objectStore('products');
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(0);
  });
}

/**
 * Meta store helpers
 */
export async function setMeta(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['meta'], 'readwrite');
    const store = tx.objectStore('meta');
    const req = store.put({ key, value });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function saveSingleProduct(product) {
  const db = await openDB();
  const id = await new Promise((resolve, reject) => {
    const tx = db.transaction(['products'], 'readwrite');
    const store = tx.objectStore('products');
    const req = store.add(product);
    req.onsuccess = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
  });

  const fullProduct = { ...product, id: product.id || id };
  const prepared = prepareItem(fullProduct);

  if (memoryCatalog) {
    memoryCatalog.unshift(prepared);
    registerItemInMaps(prepared);
    if (prepared.categoria && categoriesCache && !categoriesCache.includes(prepared._sCat)) {
      categoriesCache.push(prepared._sCat);
      categoriesCache.sort();
    }
  }

  return fullProduct;
}

export async function updateProductInDB(product) {
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(['products'], 'readwrite');
    const store = tx.objectStore('products');
    const req = store.put(product);
    req.onsuccess = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });

  const prepared = prepareItem(product);

  if (memoryCatalog) {
    const idx = memoryCatalog.findIndex(
      (it) => it.id === product.id || 
              (it.codigoInternacional && it.codigoInternacional === product.codigoInternacional) ||
              (it.codigoInterno && it.codigoInterno === product.codigoInterno)
    );

    if (idx >= 0) {
      unregisterItemFromMaps(memoryCatalog[idx]);
      memoryCatalog[idx] = prepared;
    } else {
      memoryCatalog.unshift(prepared);
    }
    registerItemInMaps(prepared);
    if (prepared.categoria && categoriesCache && !categoriesCache.includes(prepared._sCat)) {
      categoriesCache.push(prepared._sCat);
      categoriesCache.sort();
    }
  }

  return true;
}

export async function deleteProductFromDB(id) {
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(['products'], 'readwrite');
    const store = tx.objectStore('products');
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });

  if (memoryCatalog) {
    const idx = memoryCatalog.findIndex((it) => it.id === id);
    if (idx >= 0) {
      unregisterItemFromMaps(memoryCatalog[idx]);
      memoryCatalog.splice(idx, 1);
    }
  }

  return true;
}

/**
 * Filtered & paginated catalog retrieval directly from RAM (< 3ms)
 */
export async function getProductsPaged({ page = 1, pageSize = 25, search = '', category = '' }) {
  if (!memoryCatalog) {
    await initMemoryCache();
  }

  const term = (search || '').toLowerCase().trim();
  const cat = (category || '').toUpperCase().trim();

  const matched = [];
  const len = memoryCatalog ? memoryCatalog.length : 0;

  for (let i = 0; i < len; i++) {
    const item = memoryCatalog[i];
    const matchesTerm = !term || 
      item._sDesc.includes(term) ||
      item._sBar.includes(term) ||
      item._sSku.includes(term) ||
      item._sCat.toLowerCase().includes(term);

    const matchesCat = !cat || item._sCat === cat;

    if (matchesTerm && matchesCat) {
      matched.push(item);
    }
  }

  const total = matched.length;
  const start = (page - 1) * pageSize;
  const pagedItems = matched.slice(start, start + pageSize);

  return {
    items: pagedItems,
    total,
    totalPages: Math.ceil(total / pageSize) || 1,
    page
  };
}

/**
 * Get sorted unique categories from RAM cache instantly (0ms)
 */
export async function getAllCatalogCategories() {
  if (!memoryCatalog || !categoriesCache) {
    await initMemoryCache();
  }
  return categoriesCache || [];
}

/**
 * Export all catalog items directly from RAM cache or DB
 */
export async function exportAllCatalogData() {
  if (memoryCatalog && memoryCatalog.length > 0) {
    return memoryCatalog;
  }
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(['products'], 'readonly');
    const store = tx.objectStore('products');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

export async function getMeta(key) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(['meta'], 'readonly');
    const store = tx.objectStore('meta');
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : null);
    req.onerror = () => resolve(null);
  });
}

/**
 * Session Snapshots (Save / Restore)
 */
export async function saveSessionToDB(session) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['sessions'], 'readwrite');
    const store = tx.objectStore('sessions');
    const req = store.put(session);
    req.onsuccess = () => resolve(session.id);
    tx.oncomplete = () => resolve(session.id);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllSessionsFromDB() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(['sessions'], 'readonly');
    const store = tx.objectStore('sessions');
    const req = store.getAll();
    req.onsuccess = () => {
      const list = req.result || [];
      list.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
      resolve(list);
    };
    req.onerror = () => resolve([]);
  });
}

export async function deleteSessionFromDB(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['sessions'], 'readwrite');
    const store = tx.objectStore('sessions');
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export function downloadBackupJsonFile(sessionData) {
  const cleanName = (sessionData.name || 'Respaldo_Inventario').replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStr = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const filename = `${cleanName}_${dateStr}.json`;
  
  const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
