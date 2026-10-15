import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, UploadCloud, QrCode, Clock } from 'lucide-react';
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
import ShareSessionModal from './components/ShareSessionModal';
import CsvUploaderModal from './components/CsvUploaderModal';
import PrintReportModal from './components/PrintReportModal';
import ClearConfirmModal from './components/ClearConfirmModal';
import CameraScannerModal from './components/CameraScannerModal';
import HistoryLogView from './components/HistoryLogView';
import LoginView from './components/LoginView';
import UserManagementModal from './components/UserManagementModal';
import SessionSelectorModal from './components/SessionSelectorModal';
import { getStoredToken, getStoredUser, fetchCurrentUser, clearAuthSession } from './utils/auth';
import { getCatalogCount, saveProductsInBatches, saveSingleProduct, updateProductInDB, initMemoryCache, getAllProductsFromDB } from './utils/db';
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
  emitHistoryClear,
  emitSessionJoin,
  getActiveSessionCode,
  setActiveSessionCode,
  fetchCatalogFromServer,
  fetchCatalogMeta,
  fetchNetworkInfo,
  migrateLocalDataToServer,
  resetSocket
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

  // Authentication State
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);

  // Active Multi-User Session State
  const [activeSession, setActiveSession] = useState(() => {
    try {
      const raw = localStorage.getItem('inventariosapp_active_session_info');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [isSessionSelectorOpen, setIsSessionSelectorOpen] = useState(false);

  // Multi-user Real-time Collaboration State
  const [isOnline, setIsOnline] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(1);
  const [auditorsList, setAuditorsList] = useState([]);
  const [currentUserName, setCurrentUserName] = useState(() => {
    return localStorage.getItem(LOCAL_STORAGE_USER_NAME) || '';
  });

  // Verify session on mount
  useEffect(() => {
    (async () => {
      try {
        const token = getStoredToken();
        if (token) {
          const user = await fetchCurrentUser();
          if (user) {
            setCurrentUser(user);
            setCurrentUserName(user.name);
            localStorage.setItem(LOCAL_STORAGE_USER_NAME, user.name);
          } else {
            setCurrentUser(null);
          }
        } else {
          setCurrentUser(null);
        }
      } catch (err) {
        console.warn('Error verificando sesión inicial:', err);
      } finally {
        setIsAuthChecking(false);
      }
    })();
  }, []);

  // When user is authenticated but has no active session, prompt to create or pick session (Not for Collaborators)
  useEffect(() => {
    const isCollab = currentUser?.isCollaborator || currentUser?.role === 'collaborator' || String(currentUser?.id || '').startsWith('collab_');
    if (!isAuthChecking && currentUser && !activeSession && !isCollab) {
      setIsSessionSelectorOpen(true);
    }
  }, [isAuthChecking, currentUser, activeSession]);

  // Keep active session in sync with storage & socket
  useEffect(() => {
    if (activeSession?.code) {
      try {
        localStorage.setItem('inventariosapp_active_session_info', JSON.stringify(activeSession));
        setActiveSessionCode(activeSession.code);
        if (activeSession.name) {
          setSessionName(activeSession.name);
        }
        emitSessionJoin(activeSession.code, currentUserName);
      } catch (e) {
        console.warn('Error saving active session info:', e);
      }
    }
  }, [activeSession, currentUserName]);

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

  // Audit History Logs
  const [historyLogs, setHistoryLogs] = useState(() => {
    try {
      const saved = localStorage.getItem('inventariosapp_history_logs_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('inventariosapp_history_logs_v1', JSON.stringify(historyLogs.slice(0, 2000)));
    } catch (e) {
      console.warn('LocalStorage history save error:', e);
    }
  }, [historyLogs]);


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
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [networkUrls, setNetworkUrls] = useState({ tunnelUrl: '', wifiUrl: '', localUrl: '' });
  const [localDataMigrationAvailable, setLocalDataMigrationAvailable] = useState(false);
  
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
      // Warm up memory cache in background
      initMemoryCache().catch(console.warn);

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

      if (localCount === 0 && currentUser?.role === 'admin') {
        setIsUploaderOpen(true);
      }
    })();
  }, [syncCatalogFromServer, currentUser]);


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
      if (data.sessionCode) {
        setActiveSession((prev) => ({
          code: data.sessionCode,
          name: data.sessionName || prev?.name || '',
          expiresAt: data.expiresAt !== undefined ? data.expiresAt : prev?.expiresAt,
          creatorName: data.creatorName || prev?.creatorName,
          isExpired: data.isExpired || false
        }));
      }
      if (data.sessionName) setSessionName(data.sessionName);
      if (Array.isArray(data.countedItems)) {
        setCountedItems(data.countedItems);
      }
      if (Array.isArray(data.historyLogs)) {
        setHistoryLogs(data.historyLogs);
      }
      if (data.totalUsers) setOnlineUsers(data.totalUsers);
      if (data.auditors) setAuditorsList(data.auditors);

      if (data.tunnelUrl || data.wifiUrl || data.localUrl) {
        setNetworkUrls({
          tunnelUrl: data.tunnelUrl || '',
          wifiUrl: data.wifiUrl || '',
          localUrl: data.localUrl || ''
        });
      }

      // Check if server is empty, but this browser already has counted items or catalog
      const serverCounted = (data.countedItems || []).length;
      const serverCatalog = data.catalogCount || 0;
      if (serverCounted === 0 && serverCatalog === 0) {
        try {
          const savedItems = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
          const localCatCount = await getCatalogCount();
          if (savedItems.length > 0 || localCatCount > 0) {
            setLocalDataMigrationAvailable(true);
          }
        } catch {}
      }

      // Check if server catalog has items that we don't have locally
      if (data.catalogCount && data.catalogCount > 0) {
        const localCount = await getCatalogCount();
        if (localCount === 0 || localCount < data.catalogCount) {
          syncCatalogFromServer(data.catalogCount);
        }
      }
    };

    const handleSessionError = (data) => {
      if (data?.error) {
        setLastScannedMessage({
          type: 'error',
          text: `⚠️ ${data.error}`,
          time: new Date().toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
        setIsSessionSelectorOpen(true);
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
      if (data.historyLogs) {
        setHistoryLogs(data.historyLogs);
      } else if (data.log) {
        setHistoryLogs(prev => [data.log, ...prev]);
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
      if (data.historyLogs) {
        setHistoryLogs(data.historyLogs);
      } else if (data.log) {
        setHistoryLogs(prev => [data.log, ...prev]);
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

    const handleHistoryCleared = (data) => {
      setHistoryLogs([]);
      const timeStr = new Date().toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastScannedMessage({
        type: 'info',
        text: `🧹 El historial fue reiniciado por ${data?.by || 'un usuario'}.`,
        time: timeStr
      });
    };

    const handleSessionRenamed = (data) => {
      if (data.sessionName) {
        setSessionName(data.sessionName);
        setActiveSession((prev) => prev ? { ...prev, name: data.sessionName } : null);
      }
    };

    const handleSessionRestored = (data) => {
      if (data.countedItems) setCountedItems(data.countedItems);
      if (data.sessionName) {
        setSessionName(data.sessionName);
        setActiveSession((prev) => prev ? { ...prev, name: data.sessionName } : null);
      }
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

    const handleTunnelUpdated = (data) => {
      if (data?.tunnelUrl) {
        setNetworkUrls(prev => ({ ...prev, tunnelUrl: data.tunnelUrl }));
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('sync:init', handleSyncInit);
    socket.on('session:error', handleSessionError);
    socket.on('users:update', handleUsersUpdate);
    socket.on('count:updated', handleCountUpdated);
    socket.on('item:deleted', handleItemDeleted);
    socket.on('inventory:cleared', handleInventoryCleared);
    socket.on('history:cleared', handleHistoryCleared);
    socket.on('session:renamed', handleSessionRenamed);
    socket.on('session:restored', handleSessionRestored);
    socket.on('catalog:syncedProduct', handleCatalogSyncedProduct);
    socket.on('catalog:updated', handleCatalogUpdated);
    socket.on('tunnel:updated', handleTunnelUpdated);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('sync:init', handleSyncInit);
      socket.off('session:error', handleSessionError);
      socket.off('users:update', handleUsersUpdate);
      socket.off('count:updated', handleCountUpdated);
      socket.off('item:deleted', handleItemDeleted);
      socket.off('inventory:cleared', handleInventoryCleared);
      socket.off('history:cleared', handleHistoryCleared);
      socket.off('session:renamed', handleSessionRenamed);
      socket.off('session:restored', handleSessionRestored);
      socket.off('catalog:syncedProduct', handleCatalogSyncedProduct);
      socket.off('catalog:updated', handleCatalogUpdated);
      socket.off('tunnel:updated', handleTunnelUpdated);
    };

  }, [currentUserName, syncCatalogFromServer]);

  // Product Key helper (matches by barcode, SKU, or ID)
  const getItemKey = (p) => {
    return p.codigoInternacional || p.codigoInterno || p.codigo || p.id;
  };

  // Add or update an item in the list
  const applyCountToItem = useCallback((product, qtyToAddOrSet, isSettingExact = false) => {
    if (activeSession?.expiresAt && new Date(activeSession.expiresAt).getTime() < Date.now()) {
      alert('Esta sesión de conteo ha culminado su período de vigencia. No se pueden registrar más conteos en esta sesión.');
      setIsSessionSelectorOpen(true);
      return;
    }

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

    // Only Admin can persist to master catalog
    if (saveToCatalog && currentUser?.role === 'admin') {
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

  // Open Edit Product in catalog modal (Admin only)
  const handleOpenEditProduct = (product) => {
    if (currentUser?.role !== 'admin') {
      alert('Solo el Administrador tiene permisos para modificar la base de datos principal.');
      return;
    }
    setEditProductModalData({
      isOpen: true,
      product
    });
  };

  // Save edited product to DB & active inventory (Admin only)
  const handleSaveEditedProduct = async (updatedProduct) => {
    if (currentUser?.role !== 'admin') {
      alert('Permiso denegado. Solo el Administrador puede editar la base de datos principal.');
      return;
    }
    try {
      await updateProductInDB(updatedProduct);
      emitCatalogProductUpdated(updatedProduct);

      // Local update in counted items
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
        text: `✏️ Producto "${updatedProduct.descripcion}" actualizado en la base de datos principal.`,
        time: new Date().toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });

      setEditProductModalData({ isOpen: false, product: null });
    } catch (err) {
      alert('Error al actualizar el producto: ' + err.message);
    }
  };

  // Confirm quantity from modal (Quick edits apply to current session only, unless admin chooses to update master catalog)
  const handleQuantityConfirm = async (product, enteredQty, isEditing, hasProductChanges = false, saveToCatalog = false) => {
    const isAdmin = currentUser?.role === 'admin';

    // 1. If product details (descripcion, costo, precio) were changed, ONLY persist to master catalog if user is Admin AND checked saveToCatalog
    if (hasProductChanges && isAdmin && saveToCatalog) {
      try {
        await updateProductInDB(product);
        emitCatalogProductUpdated(product);
      } catch (err) {
        console.warn('Error al actualizar datos del producto en catálogo maestro:', err);
      }
    }

    // 2. Apply count to this session (passes updated product so that current session's counted items have the new description/cost/price!)
    if (isEditing) {
      applyCountToItem(product, enteredQty, true);
    } else {
      applyCountToItem(product, enteredQty, false);
    }

    setQuantityModalData({ isOpen: false, product: null, currentCount: 0, isEditing: false });

    if (hasProductChanges) {
      const isMasterUpdated = isAdmin && saveToCatalog;
      setLastScannedMessage({
        type: 'success',
        text: isMasterUpdated
          ? `✏️ Datos de "${product.descripcion}" actualizados en catálogo principal e inventario.`
          : `✏️ Datos de "${product.descripcion}" modificados para esta sesión de conteo.`,
        time: new Date().toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
    }

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

  // Publish local data to server shared database
  const handlePublishLocalData = async () => {
    try {
      setLastScannedMessage({
        type: 'info',
        text: '⏳ Sincronizando catálogo e inventario local con el servidor...'
      });
      const allLocalCatalog = await getAllProductsFromDB();
      const res = await migrateLocalDataToServer({
        sessionName,
        countedItems,
        historyLogs,
        catalog: allLocalCatalog
      });
      setLocalDataMigrationAvailable(false);
      setLastScannedMessage({
        type: 'success',
        text: `✅ ¡Datos sincronizados con éxito! ${res.totalCounted || countedItems.length} artículos contados y ${res.catalogCount || allLocalCatalog.length} productos en catálogo subidos al servidor central.`
      });
    } catch (err) {
      alert(`Error al sincronizar: ${err.message || 'No se pudo conectar al servidor'}`);
    }
  };

  const handleLoginSuccess = (user, token, session) => {
    if (token && user) {
      saveAuthSession(token, user);
    }
    setCurrentUser(user);
    if (user.name) {
      setCurrentUserName(user.name);
      localStorage.setItem(LOCAL_STORAGE_USER_NAME, user.name);
      emitSetAuditorName(user.name);
    }
    const isCollab = user.isCollaborator || user.role === 'collaborator' || String(user.id || '').startsWith('collab_');
    if (session) {
      setActiveSession(session);
      setIsSessionSelectorOpen(false);
    } else if (!isCollab) {
      setIsSessionSelectorOpen(true);
    }
    resetSocket();
    getSocket();
  };

  const handleLogout = () => {
    const confirmLogout = window.confirm('¿Deseas cerrar tu sesión actual?');
    if (!confirmLogout) return;

    clearAuthSession();
    setCurrentUser(null);
    setActiveSession(null);
    localStorage.removeItem('inventariosapp_active_session_info');
    setActiveSessionCode('');
    resetSocket();
  };

  const handleSelectSession = (session) => {
    if (!session) return;
    setActiveSession(session);
    if (session.name) setSessionName(session.name);
    emitSessionJoin(session.code, currentUserName);
    setIsSessionSelectorOpen(false);
    setLastScannedMessage({
      type: 'success',
      text: `📂 Conectado a la sesión "${session.name}" (${session.code}).`,
      time: new Date().toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    });
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mb-3" />
        <p className="text-sm font-semibold text-slate-300">Verificando sesión segura...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  const isCollaborator = currentUser?.isCollaborator || currentUser?.role === 'collaborator' || String(currentUser?.id || '').startsWith('collab_');
  const isSessionExpired = activeSession?.expiresAt && new Date(activeSession.expiresAt).getTime() < Date.now();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      
      {/* Header */}
      <Navbar
        activeView={activeView}
        setActiveView={setActiveView}
        catalogCount={catalogCount}
        totalHistoryLogs={historyLogs.length}
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
        onOpenShareModal={() => setIsShareModalOpen(true)}
        currentUserName={currentUserName}
        currentUser={currentUser}
        activeSession={activeSession}
        onOpenSessionSelector={() => {
          if (!isCollaborator) setIsSessionSelectorOpen(true);
        }}
        onOpenUserManagement={() => setIsUserManagementOpen(true)}
        onLogout={handleLogout}
      />

      {/* Expired Session Alert Banner */}
      {isSessionExpired && (
        <div className="bg-rose-600 text-white px-4 py-2.5 text-xs flex items-center justify-between shadow-xs sticky top-14 z-30 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-rose-100 shrink-0 animate-pulse" />
            <span>
              <strong>Esta sesión de conteo ha culminado su período de vigencia</strong> (venció el {new Date(activeSession.expiresAt).toLocaleDateString('es-DO')}).
              {isCollaborator ? ' Comunícate con el líder del conteo para renovar el acceso.' : ' Para continuar, crea o selecciona una sesión vigente.'}
            </span>
          </div>
          {!isCollaborator ? (
            <button
              type="button"
              onClick={() => setIsSessionSelectorOpen(true)}
              className="px-2.5 py-1 bg-white text-rose-700 hover:bg-rose-50 font-bold rounded-lg text-xs shadow-xs transition-colors shrink-0 ml-2"
            >
              Cambiar Sesión
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLogout}
              className="px-2.5 py-1 bg-white text-rose-700 hover:bg-rose-50 font-bold rounded-lg text-xs shadow-xs transition-colors shrink-0 ml-2"
            >
              Cerrar Sesión
            </button>
          )}
        </div>
      )}

      {/* Notice when user's access has 3 or fewer days remaining */}
      {currentUser?.expiresAt && (() => {
        const diffMs = new Date(currentUser.expiresAt).getTime() - Date.now();
        const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (daysLeft > 0 && daysLeft <= 3) {
          return (
            <div className="bg-amber-500 text-white px-4 py-2 text-xs flex items-center justify-between shadow-xs sticky top-14 z-30 animate-in fade-in">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-100 animate-pulse shrink-0" />
                <span>
                  <strong>Aviso de Vigencia:</strong> Te {daysLeft === 1 ? 'queda 1 día' : `quedan ${daysLeft} días`} de acceso a la aplicación (vence el {new Date(currentUser.expiresAt).toLocaleDateString()}). Si requieres más tiempo, solicita una renovación a tu Administrador.
                </span>
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* Local Data Migration Prompt Banner (Admin Only) */}
      {localDataMigrationAvailable && currentUser?.role === 'admin' && (
        <div className="bg-amber-600 text-white px-4 py-2.5 shadow-md flex flex-wrap items-center justify-between gap-3 animate-in fade-in sticky top-14 z-30">
          <div className="flex items-center gap-2 text-xs">
            <UploadCloud className="w-5 h-5 shrink-0 animate-bounce text-amber-200" />
            <span>
              <strong>¡Se encontraron datos previos en este navegador!</strong> Tienes <strong>{countedItems.length}</strong> artículos contados y <strong>{catalogCount}</strong> en catálogo que aún no están en el servidor compartido.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePublishLocalData}
              className="px-3.5 py-1.5 bg-white text-amber-950 font-bold rounded-lg text-xs hover:bg-amber-50 shadow-sm transition-all flex items-center gap-1.5"
            >
              <UploadCloud className="w-3.5 h-3.5 text-amber-700" />
              <span>Sincronizar al Servidor Compartido</span>
            </button>
            <button
              type="button"
              onClick={() => setLocalDataMigrationAvailable(false)}
              className="text-white/80 hover:text-white text-xs px-2 py-1 font-bold"
              title="Ignorar"
            >
              ✕
            </button>
          </div>
        </div>
      )}

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
            onEditProduct={currentUser?.role === 'admin' ? handleOpenEditProduct : null}
            onAddNewProduct={currentUser?.role === 'admin' ? () => handleOpenGenericModal('') : null}
            catalogCount={catalogCount}
            isAdmin={currentUser?.role === 'admin'}
          />
        )}

        {/* VIEW 3: HISTORIAL Y AUDITORIA DE CONTEOS */}
        {activeView === 'history' && (
          <HistoryLogView
            historyLogs={historyLogs}
            onBackToInventory={() => setActiveView('inventory')}
            onClearHistory={() => {
              emitHistoryClear();
              setHistoryLogs([]);
            }}
            sessionName={sessionName}
          />
        )}

      </main>


      {/* Footer */}
      <footer className="no-print border-t border-slate-200 py-3 text-center text-xs text-slate-500 bg-white">
        InventariosApp &copy; {new Date().getFullYear()} • Sistema de Pase y Conteo Físico Colaborativo en Tiempo Real
      </footer>

      {/* Modals */}
      {currentUser?.role === 'admin' && (
        <CsvUploaderModal
          isOpen={isUploaderOpen}
          onClose={() => setIsUploaderOpen(false)}
          onImportSuccess={(newCount) => {
            setCatalogCount(newCount);
            getCatalogCount().then(setCatalogCount);
          }}
          currentCount={catalogCount}
        />
      )}

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
        isAdmin={currentUser?.role === 'admin'}
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

      <ShareSessionModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        networkUrls={networkUrls}
        totalUsers={onlineUsers}
        auditors={auditorsList}
        sessionName={sessionName}
        countedItems={countedItems}
        historyLogs={historyLogs}
        catalogCount={catalogCount}
        activeSession={activeSession}
        isAdmin={currentUser?.role === 'admin'}
        onSyncSuccess={() => {
          setLocalDataMigrationAvailable(false);
          setLastScannedMessage({
            type: 'success',
            text: '✅ Datos locales publicados exitosamente en el servidor compartido.'
          });
        }}
      />

      <QuantityModal
        isOpen={quantityModalData.isOpen}
        product={quantityModalData.product}
        currentCount={quantityModalData.currentCount}
        isEditing={quantityModalData.isEditing}
        isAdmin={currentUser?.role === 'admin'}
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

      {/* Multi-Session Selector / Room Picker Modal (Never for Collaborators) */}
      {!isCollaborator && (
        <SessionSelectorModal
          isOpen={isSessionSelectorOpen}
          onClose={() => setIsSessionSelectorOpen(false)}
          currentUser={currentUser}
          activeSession={activeSession}
          onSelectSession={handleSelectSession}
          canClose={!!activeSession}
        />
      )}

      {/* Admin User Management Modal */}
      <UserManagementModal
        isOpen={isUserManagementOpen}
        onClose={() => setIsUserManagementOpen(false)}
        currentUserId={currentUser?.id}
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
