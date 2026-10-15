import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { 
  UploadCloud, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  FileText, 
  Loader2, 
  Download, 
  FileSpreadsheet,
  Database
} from 'lucide-react';
import { saveProductsInBatches, upsertProductsInBatches } from '../utils/db';
import { uploadCatalogToServer } from '../utils/socket';

export default function CsvUploaderModal({ isOpen, onClose, onImportSuccess, currentCount }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, text: '' });
  const [errorMsg, setErrorMsg] = useState(null);
  const [successInfo, setSuccessInfo] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  // Process rows data uniformly whether from Excel or CSV
  const processRowsData = async (rawRows, fileName) => {
    setProgress({ current: 0, total: rawRows.length, text: 'Procesando y normalizando productos...' });

    const formattedProducts = rawRows.map((row) => {
      // Normalize cost, prices, and inventory
      const rawCost = (row['Costo'] || row['COSTO'] || '0').toString().replace(/,/g, '');
      const rawPrice1 = (row['Precio1'] || row['PRECIO1'] || row['Precio'] || row['PRECIO'] || '0').toString().replace(/,/g, '');
      const rawPrice2 = (row['Precio2'] || row['PRECIO2'] || '0').toString().replace(/,/g, '');
      const rawExistencia = (row['Existencia'] || row['EXISTENCIA'] || '0').toString().replace(/,/g, '');

      const cost = parseFloat(rawCost) || 0;
      let price = parseFloat(rawPrice1) || 0;
      if (price === 0 && parseFloat(rawPrice2) > 0) {
        price = parseFloat(rawPrice2);
      }

      return {
        codigo: (row['Codigo'] || row['CODIGO'] || '').toString().trim(),
        codigoInterno: (row['Codigo Interno'] || row['CodigoInterno'] || row['CODIGO_INTERNO'] || row['SKU'] || '').toString().trim(),
        codigoInternacional: (row['Codigo Internacional'] || row['CodigoInternacional'] || row['Codigo Barra'] || row['CodigoBarra'] || row['CODIGO_BARRA'] || row['BARCODE'] || '').toString().trim(),
        descripcion: (row['Descripcion'] || row['DESCRIPCION'] || row['Nombre'] || row['NOMBRE'] || '').toString().trim(),
        marca: (row['Marca'] || row['MARCA'] || '').toString().trim(),
        modelo: (row['Modelo'] || row['MODELO'] || '').toString().trim(),
        unidad: (row['Unidad'] || row['UNIDAD'] || 'UNIDAD').toString().trim().toUpperCase(),
        categoria: (row['Categoria'] || row['CATEGORIA'] || '').toString().trim(),
        departamento: (row['Departamento'] || row['DEPARTAMENTO'] || '').toString().trim(),
        costo: cost,
        precio: price,
        existencia: parseFloat(rawExistencia) || 0,
      };
    }).filter(p => p.descripcion || p.codigoInternacional || p.codigoInterno);

    if (formattedProducts.length === 0) {
      throw new Error('No se encontraron productos válidos en el archivo. Asegúrate de que las columnas tengan nombres como "Descripcion", "Codigo Internacional", "Costo", "Precio1".');
    }

    setProgress({ current: 0, total: formattedProducts.length, text: 'Fusionando catálogo por código de barra...' });

    // 1. Upsert into local IndexedDB & refresh in-memory RAM maps
    const localResult = await upsertProductsInBatches(formattedProducts, (current, total) => {
      setProgress({
        current,
        total,
        text: `Indexando ${current.toLocaleString()} de ${total.toLocaleString()} productos...`
      });
    });

    setProgress({ current: formattedProducts.length, total: formattedProducts.length, text: 'Sincronizando con el servidor central para todos los usuarios...' });

    // 2. Upsert into server sharedCatalog
    let serverResult = null;
    try {
      serverResult = await uploadCatalogToServer(formattedProducts);
    } catch (uploadErr) {
      console.warn('Advertencia al sincronizar catálogo con servidor:', uploadErr);
    }

    const finalTotal = serverResult?.total || localResult.total;
    const finalUpdated = serverResult?.updated ?? localResult.updated;
    const finalCreated = serverResult?.created ?? localResult.created;

    setSuccessInfo({
      total: finalTotal,
      updated: finalUpdated,
      created: finalCreated,
      fileName
    });

    if (onImportSuccess) {
      onImportSuccess(finalTotal);
    }
    setIsLoading(false);
  };

  // Process CSV file
  const processCsvFile = (file) => {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessInfo(null);
    setProgress({ current: 0, total: 0, text: 'Leyendo archivo CSV...' });

    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      dynamicTyping: false,
      encoding: 'UTF-8',
      complete: async (results) => {
        try {
          if (!results.data || results.data.length === 0) {
            throw new Error('El archivo CSV está vacío o no tiene el formato esperado.');
          }
          await processRowsData(results.data, file.name);
        } catch (err) {
          console.error(err);
          setIsLoading(false);
          setErrorMsg(err.message || 'Error al procesar el archivo CSV');
        }
      },
      error: (err) => {
        setIsLoading(false);
        setErrorMsg('Error al leer el archivo CSV: ' + err.message);
      }
    });
  };

  // Process Excel file (.xlsx / .xls)
  const processExcelFile = (file) => {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessInfo(null);
    setProgress({ current: 0, total: 0, text: 'Leyendo archivo Excel (.xlsx / .xls)...' });

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          throw new Error('El archivo Excel no contiene ninguna hoja de cálculo.');
        }
        const worksheet = workbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        if (!rawRows || rawRows.length === 0) {
          throw new Error('La primera hoja del archivo Excel está vacía.');
        }
        await processRowsData(rawRows, file.name);
      } catch (err) {
        console.error('Error procesando Excel:', err);
        setIsLoading(false);
        setErrorMsg('Error al leer el archivo Excel: ' + (err.message || 'Formato no soportado'));
      }
    };
    reader.onerror = (err) => {
      setIsLoading(false);
      setErrorMsg('Error al abrir el archivo Excel: ' + err.message);
    };
    reader.readAsArrayBuffer(file);
  };

  // Master router to handle either Excel or CSV
  const processFile = (file) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      processExcelFile(file);
    } else {
      processCsvFile(file);
    }
  };

  // Download blank example template
  const handleDownloadTemplate = (format = 'xlsx') => {
    const templateRows = [
      {
        'Codigo': '101',
        'Codigo Interno': 'SKU-001',
        'Codigo Internacional': '7461234567890',
        'Descripcion': 'ARROZ BLANCO SUPERIOR 10 LBS',
        'Unidad': 'UNIDAD',
        'Categoria': 'COMESTIBLES',
        'Departamento': 'GRANOS',
        'Costo': 350.00,
        'Precio1': 450.00,
        'Existencia': 50
      },
      {
        'Codigo': '102',
        'Codigo Interno': 'SKU-002',
        'Codigo Internacional': '7469876543210',
        'Descripcion': 'ACEITE DE MAIZ PURO 1 LITRO',
        'Unidad': 'UNIDAD',
        'Categoria': 'COMESTIBLES',
        'Departamento': 'ACEITES',
        'Costo': 180.00,
        'Precio1': 240.00,
        'Existencia': 30
      },
      {
        'Codigo': '103',
        'Codigo Interno': 'SKU-003',
        'Codigo Internacional': '7465544332211',
        'Descripcion': 'LECHE EVAPORADA ENTERA 315G',
        'Unidad': 'LATA',
        'Categoria': 'LACTEOS',
        'Departamento': 'COMESTIBLES',
        'Costo': 75.00,
        'Precio1': 95.00,
        'Existencia': 120
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateRows);
    ws['!cols'] = [
      { wch: 10 }, // Codigo
      { wch: 16 }, // Codigo Interno
      { wch: 24 }, // Codigo Internacional
      { wch: 38 }, // Descripcion
      { wch: 12 }, // Unidad
      { wch: 16 }, // Categoria
      { wch: 16 }, // Departamento
      { wch: 12 }, // Costo
      { wch: 12 }, // Precio1
      { wch: 12 }, // Existencia
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla_Catalogo');

    if (format === 'csv') {
      XLSX.writeFile(wb, 'Plantilla_Catalogo_Productos.csv', { bookType: 'csv' });
    } else {
      XLSX.writeFile(wb, 'Plantilla_Catalogo_Productos.xlsx', { bookType: 'xlsx' });
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    e.target.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const name = file.name.toLowerCase();
      if (
        name.endsWith('.csv') || 
        name.endsWith('.xlsx') || 
        name.endsWith('.xls') || 
        file.type.includes('csv') || 
        file.type.includes('sheet') || 
        file.type.includes('excel')
      ) {
        processFile(file);
      } else {
        setErrorMsg('Por favor selecciona un archivo con formato .CSV o Excel (.XLSX / .XLS)');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Cargar Catálogo de Productos</h3>
              <p className="text-xs text-slate-500">Soporta archivos CSV y hojas de cálculo Excel (.xlsx, .xls)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          
          {/* Current status */}
          {currentCount > 0 && !successInfo && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <span className="text-slate-600">Catálogo actual en la base de datos:</span>
              <span className="font-bold text-slate-900">{currentCount.toLocaleString()} productos</span>
            </div>
          )}

          {/* Download Template Banner */}
          {!isLoading && !successInfo && (
            <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-indigo-950">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600 shrink-0" />
                <div>
                  <span className="font-bold block">Plantilla con el formato correcto</span>
                  <span className="text-[11px] text-indigo-700">Descarga un archivo con las columnas exactas requeridas</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate('xlsx')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg font-bold text-xs shadow-2xs transition-colors"
                  title="Descargar plantilla formato Excel (.xlsx)"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Excel (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate('csv')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-bold text-xs transition-colors"
                  title="Descargar plantilla formato CSV (.csv)"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV (.csv)</span>
                </button>
              </div>
            </div>
          )}

          {/* Upload Drop Area */}
          {!isLoading && !successInfo && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-indigo-600 bg-indigo-50/50 scale-[1.01]'
                  : 'border-slate-300 hover:border-slate-500 bg-slate-50/60 hover:bg-slate-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .xlsx, .xls, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center mb-3">
                <FileText className="w-6 h-6" />
              </div>

              <h4 className="text-sm font-bold text-slate-900 mb-1">
                Haz clic para seleccionar o arrastra aquí tu archivo CSV o Excel
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                <strong>Actualización Inteligente por Código de Barra:</strong> Los artículos existentes actualizarán su costo, precio y descripción. Los artículos no registrados se agregarán automáticamente.
              </p>

              <div className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-semibold shadow-xs hover:bg-slate-700 transition-colors">
                <UploadCloud className="w-4 h-4" />
                Examinar archivo (.xlsx, .csv)...
              </div>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="p-8 text-center space-y-4">
              <Loader2 className="w-8 h-8 text-slate-700 animate-spin mx-auto" />
              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">Procesando catálogo...</h4>
                <p className="text-xs text-slate-500">{progress.text}</p>
              </div>

              {progress.total > 0 && (
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-slate-800 h-2 rounded-full transition-all duration-150"
                    style={{
                      width: `${Math.min(100, Math.round((progress.current / progress.total) * 100))}%`
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Success state */}
          {successInfo && (
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-4 animate-in zoom-in-95 duration-150">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <div>
                <h4 className="text-base font-bold text-slate-900">¡Catálogo procesado y actualizado con éxito!</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Archivo procesado: <strong className="text-slate-700">{successInfo.fileName}</strong>
                </p>
              </div>

              {/* Stats Breakdown Badges */}
              <div className="grid grid-cols-3 gap-2.5 max-w-md mx-auto text-center pt-1">
                <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">
                    Actualizados
                  </span>
                  <span className="text-lg font-black text-indigo-900">
                    {successInfo.updated.toLocaleString()}
                  </span>
                  <span className="text-[9px] text-indigo-500 block leading-tight">Mismo código barra</span>
                </div>

                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
                    Nuevos Creados
                  </span>
                  <span className="text-lg font-black text-emerald-900">
                    {successInfo.created.toLocaleString()}
                  </span>
                  <span className="text-[9px] text-emerald-500 block leading-tight">No existían</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                    Total Catálogo
                  </span>
                  <span className="text-lg font-black text-slate-900">
                    {successInfo.total.toLocaleString()}
                  </span>
                  <span className="text-[9px] text-slate-500 block leading-tight">En base de datos</span>
                </div>
              </div>

              <button
                onClick={onClose}
                className="mt-2 px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs shadow-sm transition-all"
              >
                Continuar al Inventario
              </button>
            </div>
          )}

          {/* Error message */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block text-rose-900">Error al procesar archivo:</span>
                {errorMsg}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>La base de datos queda sincronizada en el servidor y en tu navegador.</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium transition-colors"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
