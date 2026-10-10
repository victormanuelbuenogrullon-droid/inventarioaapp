// IndexedDB Database helper for fast product lookup (20,000+ items)

const DB_NAME = 'InventariosAppDB';
const DB_VERSION = 1;

let dbInstance = null;

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
 * Bulk save products from CSV
 */
export async function saveProductsInBatches(products, onProgress) {
  const db = await openDB();
  
  // Clear previous products first
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

  // Update meta
  await setMeta('catalogInfo', {
    totalProducts: total,
    importedAt: new Date().toISOString(),
  });

  return total;
}

/**
 * Find a product by Barcode (Codigo Internacional), Internal Code, or Numeric ID
 */
export async function findProduct(query) {
  if (!query) return null;
  const cleanQuery = query.toString().trim();
  const db = await openDB();

  return new Promise((resolve) => {
    const tx = db.transaction(['products'], 'readonly');
    const store = tx.objectStore('products');

    // 1. Try by Codigo Internacional (Barcode)
    const intIndex = store.index('codigoInternacional');
    const req1 = intIndex.get(cleanQuery);

    req1.onsuccess = () => {
      if (req1.result) {
        return resolve(req1.result);
      }

      // 2. Try by Codigo Interno (SKU)
      const internIndex = store.index('codigoInterno');
      const req2 = internIndex.get(cleanQuery);

      req2.onsuccess = () => {
        if (req2.result) {
          return resolve(req2.result);
        }

        // 3. Try with padded zeros or unpadded
        const padded6 = cleanQuery.padStart(6, '0');
        const req3 = internIndex.get(padded6);

        req3.onsuccess = () => {
          if (req3.result) {
            return resolve(req3.result);
          }

          // 4. Try by primary key or numeric code
          const codeIndex = store.index('codigo');
          const req4 = codeIndex.get(cleanQuery);

          req4.onsuccess = () => {
            if (req4.result) {
              return resolve(req4.result);
            }
            resolve(null);
          };
        };
      };
    };

    req1.onerror = () => resolve(null);
  });
}

/**
 * Fuzzy search products by description or code for manual selection
 */
export async function searchProducts(searchTerm, limit = 40) {
  if (!searchTerm || searchTerm.trim().length === 0) return [];
  const term = searchTerm.toLowerCase().trim();
  const db = await openDB();

  return new Promise((resolve) => {
    const tx = db.transaction(['products'], 'readonly');
    const store = tx.objectStore('products');
    const results = [];
    const req = store.openCursor();

    req.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor && results.length < limit) {
        const item = cursor.value;
        const desc = (item.descripcion || '').toLowerCase();
        const intCode = (item.codigoInternacional || '').toLowerCase();
        const internCode = (item.codigoInterno || '').toLowerCase();

        if (desc.includes(term) || intCode.includes(term) || internCode.includes(term)) {
          results.push(item);
        }
        cursor.continue();
      } else {
        resolve(results);
      }
    };

    req.onerror = () => resolve([]);
  });
}

/**
 * Get count of catalog products
 */
export async function getCatalogCount() {
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
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['products'], 'readwrite');
    const store = tx.objectStore('products');
    const req = store.add(product);
    req.onsuccess = () => resolve(req.result);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function updateProductInDB(product) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['products'], 'readwrite');
    const store = tx.objectStore('products');
    const req = store.put(product);
    req.onsuccess = () => resolve(true);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteProductFromDB(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['products'], 'readwrite');
    const store = tx.objectStore('products');
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getProductsPaged({ page = 1, pageSize = 25, search = '', category = '' }) {
  const db = await openDB();
  const term = (search || '').toLowerCase().trim();
  const cat = (category || '').toUpperCase().trim();

  return new Promise((resolve) => {
    const tx = db.transaction(['products'], 'readonly');
    const store = tx.objectStore('products');
    const matched = [];
    const req = store.openCursor();

    req.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        const item = cursor.value;
        const matchesTerm = !term || 
          (item.descripcion || '').toLowerCase().includes(term) ||
          (item.codigoInternacional || '').toLowerCase().includes(term) ||
          (item.codigoInterno || '').toLowerCase().includes(term) ||
          (item.categoria || '').toLowerCase().includes(term);

        const matchesCat = !cat || (item.categoria || '').toUpperCase() === cat;

        if (matchesTerm && matchesCat) {
          matched.push(item);
        }
        cursor.continue();
      } else {
        const total = matched.length;
        const start = (page - 1) * pageSize;
        const pagedItems = matched.slice(start, start + pageSize);
        resolve({
          items: pagedItems,
          total,
          totalPages: Math.ceil(total / pageSize) || 1,
          page
        });
      }
    };

    req.onerror = () => resolve({ items: [], total: 0, totalPages: 1, page: 1 });
  });
}

export async function getAllCatalogCategories() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(['products'], 'readonly');
    const store = tx.objectStore('products');
    const categoriesSet = new Set();
    const req = store.openCursor();

    req.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        if (cursor.value.categoria) {
          categoriesSet.add(cursor.value.categoria.trim().toUpperCase());
        }
        cursor.continue();
      } else {
        resolve(Array.from(categoriesSet).sort());
      }
    };
    req.onerror = () => resolve([]);
  });
}

export async function exportAllCatalogData() {
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


