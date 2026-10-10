import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import Navbar from './components/Navbar';
import ScannerBar from './components/ScannerBar';
import SummaryCards from './components/SummaryCards';
import InventoryTable from './components/InventoryTable';
import QuantityModal from './components/QuantityModal';
import ManualProductSearchModal from './components/ManualProductSearchModal';
import GenericProductModal from './components/GenericProductModal';
import SessionManagerModal from './components/SessionManagerModal';
import EditProductModal from './components/EditProductModal';
import CatalogManagerView from './components/CatalogManagerView';
import AuditorsModal from './components/AuditorsModal';
import CsvUploaderModal from './components/CsvUploaderModal';
import PrintReportModal from './components/PrintReportModal';
import ClearConfirmModal from './components/ClearConfirmModal';
import CameraScannerModal from './components/CameraScannerModal';
import { getCatalogCount, saveProductsInBatches, saveSingleProduct, updateProductInDB } from './utils/db';
import { exportToExcel } from './utils/export';
import { 
  getSocket, 
  emitCountApply, 
  emitItemDelete, 
  emitInventoryClear, 
  emitSessionRename, 
  emitSessionRestore, 
  emitCatalogProductUpdated, 
  emitSetAuditorName,
  fetchCatalogFromServer,
  fetchCatalogMeta
} from './utils/socket';
import { playSuccessBeep } from './utils/sound';

const LOCAL_STORAGE_KEY = 'inventariosapp_counted_items_v1';
const LOCAL_STORAGE_SESSION_KEY = 'inventariosapp_session_name_v1';
const LOCAL_STORAGE_SOUND_KEY = 'inventariosapp_sound_enabled_v1';
const LOCAL_STORAGE_SCANMODE_KEY = 'inventariosapp_scan_mode_v1';
const LOCAL_STORAGE_USER_NAME = 'inventariosapp_auditor_name';

export default function App() {
  // Main Navigation View
  const [activeView, setActiveView] = useState('inventory'); // 'inventory' | 'catalog'

  // Multi-user Real-time Collaboration State
  const [isOnline, setIsOnline] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(1);
  const [auditorsList, setAuditorsList] = useState([]);
  const [currentUserName, setCurrentUserName] = useState(() => {
    return localStorage.getItem(LOCAL_STORAGE_USER_NAME) || '';
  });

  // Main State
  const [catalogCount, setCatalogCount] = useState(0);
  const [isCatalogSyncing, setIsCatalogSyncing] = useState(false);
  const [catalogSyncProgress, setCatalogSyncProgress] = useState({ current: 0, total: 0 });
  const [sessionName, setSessionName] = useState(() => {
    return localStorage.getItem(LOCAL_STORAGE_SESSION_KEY) || 'Pase de Inventario General';
  });
  const [countedItems, setCountedItems] = useState(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_SOUND_KEY);
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [scanMode, setScanMode] = useState(() => {
    return localStorage.getItem(LOCAL_STORAGE_SCANMODE_KEY) || 'askQty';
  });

  // Auto reopen camera mode (continuous inventory loop)
  const [autoReopenCamera, setAutoReopenCamera] = useState(() => {
    const saved = localStorage.getItem('inventariosapp_auto_reopen_cam');
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem('inventariosapp_auto_reopen_cam', JSON.stringify(autoReopenCamera));
  }, [autoReopenCamera]);

  const isCameraScanRef = useRef(false);

  // Notifications & UI feedback
  const [lastScannedMessage, setLastScannedMessage] = useState(null);

  // Modals
  const [isUploaderOpen, setIsUploaderOpen] = useState(false);
  const [isCamScannerOpen, setIsCamScannerOpen] = useState(false);
  const [isManualSearchOpen, setIsManualSearchOpen] = useState(false);
  const [isSessionManagerOpen, setIsSessionManagerOpen] = useState(false);
  const [isAuditorsModalOpen, setIsAuditorsModalOpen] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

  
  // Generic / On-the-fly Product Modal state
  const [genericModalData, setGenericModalData] = useState({
    isOpen: false,
    initialCode: ''
  });

  // Edit Catalog Product Modal state
  const [editProductModalData, setEditProductModalData] = useState({
    isOpen: false,
    product: null
  });

  // Quantity Modal state
  const [quantityModalData, setQuantityModalData] = useState({
    isOpen: false,
    product: null,
    currentCount: 0,
    isEditing: false
  });

  // Keep a ref to soundEnabled to access inside socket callbacks
  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  // Sincronizar catálogo desde el servidor a IndexedDB local
  const syncCatalogFromServer = useCallback(async (expectedTotal = 0) => {
    try {
      setIsCatalogSyncing(true);
      setCatalogSyncProgress({ current: 0, total: expectedTotal || 0 });
      
      const products = await fetchCatalogFromServer();
      if (Array.isArray(products) && products.length > 0) {
        await saveProductsInBatches(products, (current, total) => {
          setCatalogSyncProgress({ current, total });
        });
        const newCount = await getCatalogCount();
        setCatalogCount(newCount);
        setIsUploaderOpen(false);
        
        const timeStr = new Date().toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastScannedMessage({
          type: 'success',
          text: `📦 Catálogo sincronizado con éxito (${products.length.toLocaleString()} productos disponibles).`,
          time: timeStr
        });
      }
    } catch (err) {
      console.warn('Error al sincronizar catálogo con servidor:', err);
    } finally {
      setIsCatalogSyncing(false);
    }
  }, []);

  // Load catalog count on startup & check server
  useEffect(() => {
    (async () => {
      const localCount = await getCatalogCount();
      setCatalogCount(localCount);

      try {
        const meta = await fetchCatalogMeta();
        if (meta && meta.totalProducts > 0) {
          if (localCount === 0 || localCount < meta.totalProducts) {
            syncCatalogFromServer(meta.totalProducts);
            return;
          }
        }
      } catch (err) {
        // Servidor no disponible o local offline
      }

      if (localCount === 0) {
        setIsUploaderOpen(true);
      }
    })();
  }, [syncCatalogFromServer]);


  // Sync to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(countedItems));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }, [countedItems]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, sessionName);
  }, [sessionName]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_SOUND_KEY, JSON.stringify(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_SCANMODE_KEY, scanMode);
  }, [scanMode]);

  // -------------------------------------------------------------
  // REAL-TIME WEBSOCKETS MULTI-USER SYNCHRONIZATION
  // -------------------------------------------------------------
  useEffect(() => {
    const socket = getSocket();

    const handleConnect = () => {
      setIsOnline(true);
      if (currentUserName) {
        emitSetAuditorName(currentUserName);
      }
    };

    const handleDisconnect = () => {
      setIsOnline(false);
    };

    const handleSyncInit = async (data) => {
      setIsOnline(true);
      if (data.sessionName) setSessionName(data.sessionName);
      if (Array.isArray(data.countedItems)) {
        // If server has counted items, adopt server state as source of truth
        if (data.countedItems.length > 0) {
          setCountedItems(data.countedItems);
        }
      }
      if (data.totalUsers) setOnlineUsers(data.totalUsers);
      if (data.auditors) setAuditorsList(data.auditors);

      // Check if server catalog has items that we don't have locally
      if (data.catalogCount && data.catalogCount > 0) {
        const localCount = await getCatalogCount();
        if (localCount === 0 || localCount < data.catalogCount) {
          syncCatalogFromServer(data.catalogCount);
        }
      }
    };

    const handleUsersUpdate = (data) => {
      if (data.totalUsers !== undefined) setOnlineUsers(data.totalUsers);
      if (data.auditors) setAuditorsList(data.auditors);
    };

    const handleCountUpdated = (data) => {
      if (data.allCountedItems) {
        setCountedItems(data.allCountedItems);
      }
      const timeStr = new Date().toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastScannedMessage({
        type: 'success',
        text: `👤 ${data.by || 'Compañero'} contó: ${data.item?.descripcion || ''} (${data.action === 'set' ? `=${data.qtyChange}` : `+${data.qtyChange}`})`,
        time: timeStr
      });
      if (soundEnabledRef.current && data.by !== currentUserName) {
        playSuccessBeep();
      }
    };

    const handleItemDeleted = (data) => {
      if (data.allCountedItems) {
        setCountedItems(data.allCountedItems);
      } else if (data.key) {
        setCountedItems((prev) => prev.filter((it) => getItemKey(it) !== data.key));
      }
      const timeStr = new Date().toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastScannedMessage({
        type: 'info',
        text: `🗑️ ${data.by || 'Compañero'} eliminó un producto del conteo.`,
        time: timeStr
      });
    };

    const handleInventoryCleared = (data) => {
      setCountedItems([]);
      const timeStr = new Date().toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastScannedMessage({
        type: 'info',
        text: `⚠️ El listado fue reiniciado por ${data.by || 'un usuario'}.`,
        time: timeStr
      });
    };

    const handleSessionRenamed = (data) => {
      if (data.sessionName) {
        setSessionName(data.sessionName);
      }
    };

    const handleSessionRestored = (data) => {
      if (data.countedItems) setCountedItems(data.countedItems);
      if (data.sessionName) setSessionName(data.sessionName);
      const timeStr = new Date().toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastScannedMessage({
        type: 'success',
        text: `📂 ${data.by || 'Un usuario'} restauró la sesión "${data.sessionName}" (${data.countedItems?.length || 0} productos).`,
        time: timeStr
      });
    };

    const handleCatalogSyncedProduct = (data) => {
      if (data.allCountedItems) {
        setCountedItems(data.allCountedItems);
      }
      if (data.product) {
        updateProductInDB(data.product);
      }
    };

    const handleCatalogUpdated = (data) => {
      const timeStr = new Date().toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastScannedMessage({
        type: 'info',
        text: `📦 Catálogo actualizado en el servidor (${data.totalProducts?.toLocaleString() || 0} productos). Sincronizando...`,
        time: timeStr
      });
      syncCatalogFromServer(data.totalProducts || 0);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('sync:init', handleSyncInit);
    socket.on('users:update', handleUsersUpdate);
    socket.on('count:updated', handleCountUpdated);
    socket.on('item:deleted', handleItemDeleted);
    socket.on('inventory:cleared', handleInventoryCleared);
    socket.on('session:renamed', handleSessionRenamed);
    socket.on('session:restored', handleSessionRestored);
    socket.on('catalog:syncedProduct', handleCatalogSyncedProduct);
    socket.on('catalog:updated', handleCatalogUpdated);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('sync:init', handleSyncInit);
      socket.off('users:update', handleUsersUpdate);
      socket.off('count:updated', handleCountUpdated);
      socket.off('item:deleted', handleItemDeleted);
      socket.off('inventory:cleared', handleInventoryCleared);
      socket.off('session:renamed', handleSessionRenamed);
      socket.off('session:restored', handleSessionRestored);
      socket.off('catalog:syncedProduct', handleCatalogSyncedProduct);
      socket.off('catalog:updated', handleCatalogUpdated);
    };
  }, [currentUserName, syncCatalogFromServer]);

  // Product Key helper (matches by barcode, SKU, or ID)
  const getItemKey = (p) => {
    return p.codigoInternacional || p.codigoInterno || p.codigo || p.id;
  };

  // Add or update an item in the list
  const applyCountToItem = useCallback((product, qtyToAddOrSet, isSettingExact = false) => {
    // 1. Emit real-time WebSocket event to server
    emitCountApply(product, qtyToAddOrSet, isSettingExact);

    // 2. Optimistic local update
    setCountedItems((prevItems) => {
      const key = getItemKey(product);
      const existingIndex = prevItems.findIndex((item) => getItemKey(item) === key);

      const now = Date.now();
      const updatedList = [...prevItems];

      if (existingIndex >= 0) {
        const existing = updatedList[existingIndex];
        const newQty = isSettingExact 
          ? qtyToAddOrSet 
          : (Number(existing.cantidadContada) || 0) + qtyToAddOrSet;

        if (newQty <= 0) {
          updatedList.splice(existingIndex, 1);
        } else {
          updatedList[existingIndex] = {
            ...existing,
            costo: Number(product.costo) !== undefined ? Number(product.costo) : existing.costo,
            precio: Number(product.precio) !== undefined ? Number(product.precio) : existing.precio,
            descripcion: product.descripcion || existing.descripcion,
            unidad: product.unidad || existing.unidad,
            cantidadContada: newQty,
            updatedAt: now,
            lastUpdatedBy: currentUserName || 'Tú'
          };
          const [movedItem] = updatedList.splice(existingIndex, 1);
          updatedList.unshift(movedItem);
        }
      } else {
        if (qtyToAddOrSet > 0) {
          const newItem = {
            id: key,
            codigo: product.codigo,
            codigoInterno: product.codigoInterno,
            codigoInternacional: product.codigoInternacional,
            descripcion: product.descripcion,
            unidad: product.unidad || 'UNIDAD',
            categoria: product.categoria || '',
            departamento: product.departamento || '',
            costo: Number(product.costo) || 0,
            precio: Number(product.precio) || 0,
            cantidadContada: qtyToAddOrSet,
            updatedAt: now,
            lastUpdatedBy: currentUserName || 'Tú'
          };
          updatedList.unshift(newItem);
        }
      }

      return updatedList;
    });

    const timeStr = new Date().toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLastScannedMessage({
      type: 'success',
      text: `✅ ${product.descripcion} • Contado: ${isSettingExact ? qtyToAddOrSet : `+${qtyToAddOrSet}`}`,
      time: timeStr
    });
  }, [currentUserName]);

  // When a barcode is scanned
  const handleProductFound = useCallback((product, currentScanMode, rawCode, isFromCamera = false) => {
    isCameraScanRef.current = !!isFromCamera;

    if (!product) {
      setLastScannedMessage({
        type: 'error',
        text: `❌ Código "${rawCode}" no encontrado en el catálogo.`,
        unfoundCode: rawCode,
        time: new Date().toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
      return;
    }

    if (currentScanMode === 'auto1') {
      applyCountToItem(product, 1, false);
    } else {
      const key = getItemKey(product);
      const existing = countedItems.find((it) => getItemKey(it) === key);
      setQuantityModalData({
        isOpen: true,
        product,
        currentCount: existing ? existing.cantidadContada : 0,
        isEditing: false
      });
    }
  }, [applyCountToItem, countedItems]);

  // Open generic product registration modal
  const handleOpenGenericModal = (code = '') => {
    setGenericModalData({
      isOpen: true,
      initialCode: code
    });
  };

  // Save generic / on-the-fly product
  const handleSaveGenericProduct = async (product, quantity, saveToCatalog) => {
    applyCountToItem(product, quantity, true);

    if (saveToCatalog) {
      try {
        await saveSingleProduct(product);
        const newCount = await getCatalogCount();
        setCatalogCount(newCount);
        emitCatalogProductUpdated(product);
      } catch (err) {
        console.warn('Could not save single product to catalog index:', err);
      }
    }

    setGenericModalData({ isOpen: false, initialCode: '' });
  };

  // Open Edit Product in catalog modal
  const handleOpenEditProduct = (product) => {
    setEditProductModalData({
      isOpen: true,
      product
    });
  };

  // Save edited product to DB & active inventory
  const handleSaveEditedProduct = async (updatedProduct) => {
    try {
      await updateProductInDB(updatedProduct);
      emitCatalogProductUpdated(updatedProduct);

      // Local update
      setCountedItems((prevItems) => {
        const key = getItemKey(updatedProduct);
        return prevItems.map((item) => {
          if (getItemKey(item) === key) {
            return {
              ...item,
              descripcion: updatedProduct.descripcion,
              unidad: updatedProduct.unidad,
              categoria: updatedProduct.categoria,
              costo: Number(updatedProduct.costo) || 0,
              precio: Number(updatedProduct.precio) || 0
            };
          }
          return item;
        });
      });

      setLastScannedMessage({
        type: 'success',
        text: `✏️ Producto "${updatedProduct.descripcion}" actualizado en la base de datos compartida.`,
        time: new Date().toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });

      setEditProductModalData({ isOpen: false, product: null });
    } catch (err) {
      alert('Error al actualizar el producto: ' + err.message);
    }
  };

  // Confirm quantity from modal
  const handleQuantityConfirm = (product, enteredQty, isEditing) => {
    if (isEditing) {
      applyCountToItem(product, enteredQty, true);
    } else {
      applyCountToItem(product, enteredQty, false);
    }
    setQuantityModalData({ isOpen: false, product: null, currentCount: 0, isEditing: false });

    // If autoReopenCamera is active and scan came from camera, reopen camera immediately!
    if (autoReopenCamera && isCameraScanRef.current) {
      isCameraScanRef.current = false;
      setTimeout(() => {
        setIsCamScannerOpen(true);
      }, 150);
    }
  };


  // Edit item directly from table
  const handleEditItem = (item) => {
    setQuantityModalData({
      isOpen: true,
      product: item,
      currentCount: item.cantidadContada,
      isEditing: true
    });
  };

  // Increment +1 from table
  const handleIncrementItem = (item) => {
    applyCountToItem(item, 1, false);
  };

  // Decrement -1 from table
  const handleDecrementItem = (item) => {
    const current = Number(item.cantidadContada) || 0;
    if (current <= 1) {
      handleDeleteItem(item);
    } else {
      applyCountToItem(item, current - 1, true);
    }
  };

  // Delete item from table
  const handleDeleteItem = (item) => {
    emitItemDelete(item);
    setCountedItems((prev) => prev.filter((it) => getItemKey(it) !== getItemKey(item)));
    setLastScannedMessage({
      type: 'info',
      text: `Eliminado del conteo: ${item.descripcion}`,
      time: new Date().toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    });
  };

  // Clear all counted items
  const handleClearCount = () => {
    emitInventoryClear();
    setCountedItems([]);
    setLastScannedMessage({
      type: 'info',
      text: 'Se ha reiniciado el listado de conteo para todos.',
      time: new Date().toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    });
  };

  // Rename session shared
  const handleSessionRename = (newName) => {
    setSessionName(newName);
    emitSessionRename(newName);
  };

  // Export to Excel
  const handleExportExcel = () => {
    exportToExcel(countedItems, sessionName);
  };

  // Manual search product selected
  const handleManualProductSelect = (product) => {
    setIsManualSearchOpen(false);
    const key = getItemKey(product);
    const existing = countedItems.find((it) => getItemKey(it) === key);
    setQuantityModalData({
      isOpen: true,
      product,
      currentCount: existing ? existing.cantidadContada : 0,
      isEditing: false
    });
  };

  // Restore saved session
  const handleLoadSession = (newItems, newSessionName) => {
    setCountedItems(newItems || []);
    if (newSessionName) {
      setSessionName(newSessionName);
    }
    emitSessionRestore(newItems, newSessionName);
    setLastScannedMessage({
      type: 'success',
      text: `✅ Sesión "${newSessionName}" restaurada correctamente (${newItems?.length || 0} productos).`,
      time: new Date().toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      
      {/* Header */}
      <Navbar
        activeView={activeView}
        setActiveView={setActiveView}
        catalogCount={catalogCount}
        onOpenUploader={() => setIsUploaderOpen(true)}
        onOpenSessionManager={() => setIsSessionManagerOpen(true)}
        onOpenPrint={() => setIsPrintOpen(true)}
        onExportExcel={handleExportExcel}
        onClearCount={() => setIsClearConfirmOpen(true)}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        totalItemsCounted={countedItems.length}
        sessionName={sessionName}
        setSessionName={handleSessionRename}
        isOnline={isOnline}
        onlineUsers={onlineUsers}
        onOpenAuditorsModal={() => setIsAuditorsModalOpen(true)}
        currentUserName={currentUserName}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-4">
        
        {/* VIEW 1: PASE DE INVENTARIO */}
        {activeView === 'inventory' && (
          <>
            {/* Scanner Control Bar */}
            <ScannerBar
              onProductFound={handleProductFound}
              onOpenManualSearch={() => setIsManualSearchOpen(true)}
              onOpenGenericModal={handleOpenGenericModal}
              onOpenCamScanner={() => setIsCamScannerOpen(true)}
              scanMode={scanMode}
              setScanMode={setScanMode}
              soundEnabled={soundEnabled}
              lastScannedMessage={lastScannedMessage}
              autoReopenCamera={autoReopenCamera}
              setAutoReopenCamera={setAutoReopenCamera}
            />


            {/* General Totals Summary Dashboard */}
            <SummaryCards items={countedItems} />

            {/* Counted Inventory Table (No "Existencia" column) */}
            <InventoryTable
              items={countedItems}
              onEditItem={handleEditItem}
              onIncrementItem={handleIncrementItem}
              onDecrementItem={handleDecrementItem}
              onDeleteItem={handleDeleteItem}
              onClearCount={() => setIsClearConfirmOpen(true)}
            />
          </>
        )}

        {/* VIEW 2: CONSULTA Y EDICION DE CATALOGO */}
        {activeView === 'catalog' && (
          <CatalogManagerView
            onBackToInventory={() => setActiveView('inventory')}
            onEditProduct={handleOpenEditProduct}
            onAddNewProduct={() => handleOpenGenericModal('')}
            catalogCount={catalogCount}
          />
        )}

      </main>

      {/* Footer */}
      <footer className="no-print border-t border-slate-200 py-3 text-center text-xs text-slate-500 bg-white">
        InventariosApp &copy; {new Date().getFullYear()} • Sistema de Pase y Conteo Físico Colaborativo en Tiempo Real
      </footer>

      {/* Modals */}
      <CsvUploaderModal
        isOpen={isUploaderOpen}
        onClose={() => setIsUploaderOpen(false)}
        onImportSuccess={(newCount) => {
          setCatalogCount(newCount);
          getCatalogCount().then(setCatalogCount);
        }}
        currentCount={catalogCount}
      />

      <CameraScannerModal
        isOpen={isCamScannerOpen}
        onClose={() => setIsCamScannerOpen(false)}
        onProductFound={handleProductFound}
        onOpenGenericModal={handleOpenGenericModal}
        scanMode={scanMode}
        setScanMode={setScanMode}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        autoReopenCamera={autoReopenCamera}
        setAutoReopenCamera={setAutoReopenCamera}
      />



      <GenericProductModal
        isOpen={genericModalData.isOpen}
        initialCode={genericModalData.initialCode}
        onClose={() => setGenericModalData({ isOpen: false, initialCode: '' })}
        onSave={handleSaveGenericProduct}
      />

      <EditProductModal
        isOpen={editProductModalData.isOpen}
        product={editProductModalData.product}
        onClose={() => setEditProductModalData({ isOpen: false, product: null })}
        onSave={handleSaveEditedProduct}
      />

      <SessionManagerModal
        isOpen={isSessionManagerOpen}
        onClose={() => setIsSessionManagerOpen(false)}
        currentItems={countedItems}
        currentSessionName={sessionName}
        onLoadSession={handleLoadSession}
      />

      <AuditorsModal
        isOpen={isAuditorsModalOpen}
        onClose={() => setIsAuditorsModalOpen(false)}
        auditors={auditorsList}
        totalUsers={onlineUsers}
        currentUserName={currentUserName}
        setCurrentUserName={setCurrentUserName}
      />

      <QuantityModal
        isOpen={quantityModalData.isOpen}
        product={quantityModalData.product}
        currentCount={quantityModalData.currentCount}
        isEditing={quantityModalData.isEditing}
        onConfirm={handleQuantityConfirm}
        onClose={() => {
          isCameraScanRef.current = false;
          setQuantityModalData({ isOpen: false, product: null, currentCount: 0, isEditing: false });
        }}
      />




      <ManualProductSearchModal
        isOpen={isManualSearchOpen}
        onClose={() => setIsManualSearchOpen(false)}
        onSelectProduct={handleManualProductSelect}
      />

      <PrintReportModal
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        items={countedItems}
        sessionName={sessionName}
      />

      <ClearConfirmModal
        isOpen={isClearConfirmOpen}
        onClose={() => setIsClearConfirmOpen(false)}
        onConfirmClear={handleClearCount}
        totalItems={countedItems.length}
      />

      {/* Catalog Syncing Toast Indicator */}
      {isCatalogSyncing && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-bottom-4">
          <Loader2 className="w-5 h-5 text-indigo-400 animate-spin shrink-0" />
          <div className="pr-2">
            <p className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Sincronizando catálogo con el servidor...</span>
            </p>
            <p className="text-[11px] text-slate-300">
              {catalogSyncProgress.total > 0
                ? `${catalogSyncProgress.current.toLocaleString()} de ${catalogSyncProgress.total.toLocaleString()} productos`
                : 'Descargando base de datos compartida...'}
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
