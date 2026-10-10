import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { UploadCloud, CheckCircle2, AlertTriangle, X, FileText, Loader2 } from 'lucide-react';
import { saveProductsInBatches } from '../utils/db';

export default function CsvUploaderModal({ isOpen, onClose, onImportSuccess, currentCount }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, text: '' });
  const [errorMsg, setErrorMsg] = useState(null);
  const [successInfo, setSuccessInfo] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

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

          setProgress({ current: 0, total: results.data.length, text: 'Procesando productos...' });

          const formattedProducts = results.data.map((row) => {
            const rawCost = (row['Costo'] || '0').toString().replace(/,/g, '');
            const rawPrice1 = (row['Precio1'] || '0').toString().replace(/,/g, '');
            const rawPrice2 = (row['Precio2'] || '0').toString().replace(/,/g, '');
            const rawExistencia = (row['Existencia'] || '0').toString().replace(/,/g, '');

            const cost = parseFloat(rawCost) || 0;
            let price = parseFloat(rawPrice1) || 0;
            if (price === 0 && parseFloat(rawPrice2) > 0) {
              price = parseFloat(rawPrice2);
            }

            return {
              codigo: (row['Codigo'] || '').toString().trim(),
              codigoInterno: (row['Codigo Interno'] || row['CodigoInterno'] || '').toString().trim(),
              codigoInternacional: (row['Codigo Internacional'] || row['CodigoInternacional'] || row['Codigo Barra'] || '').toString().trim(),
              descripcion: (row['Descripcion'] || row['Nombre'] || '').toString().trim(),
              marca: (row['Marca'] || '').toString().trim(),
              modelo: (row['Modelo'] || '').toString().trim(),
              unidad: (row['Unidad'] || 'UNIDAD').toString().trim().toUpperCase(),
              categoria: (row['Categoria'] || '').toString().trim(),
              departamento: (row['Departamento'] || '').toString().trim(),
              costo: cost,
              precio: price,
              existencia: parseFloat(rawExistencia) || 0,
            };
          }).filter(p => p.descripcion || p.codigoInternacional || p.codigoInterno);

          if (formattedProducts.length === 0) {
            throw new Error('No se encontraron productos válidos en el archivo.');
          }

          setProgress({ current: 0, total: formattedProducts.length, text: 'Guardando en base de datos local...' });

          await saveProductsInBatches(formattedProducts, (current, total) => {
            setProgress({
              current,
              total,
              text: `Indexando ${current.toLocaleString()} de ${total.toLocaleString()} productos...`
            });
          });

          setSuccessInfo({
            total: formattedProducts.length,
            fileName: file.name
          });

          if (onImportSuccess) {
            onImportSuccess(formattedProducts.length);
          }
        } catch (err) {
          console.error(err);
          setErrorMsg(err.message || 'Error al procesar el archivo CSV');
        } finally {
          setIsLoading(false);
        }
      },
      error: (err) => {
        setIsLoading(false);
        setErrorMsg('Error al leer el archivo: ' + err.message);
      }
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processCsvFile(file);
    }
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
    if (file && (file.name.endsWith('.csv') || file.type.includes('csv') || file.type.includes('text'))) {
      processCsvFile(file);
    } else {
      setErrorMsg('Por favor selecciona un archivo con formato .CSV');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl shadow-xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Cargar Base de Datos de Productos</h3>
              <p className="text-xs text-slate-500">Archivo CSV exportado de MariaDB / Sistema POS</p>
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
        <div className="p-6 space-y-4">
          
          {/* Current status */}
          {currentCount > 0 && !successInfo && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <span className="text-slate-600">Catálogo actual en memoria:</span>
              <span className="font-bold text-slate-900">{currentCount.toLocaleString()} productos</span>
            </div>
          )}

          {/* Upload Area */}
          {!isLoading && !successInfo && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-slate-800 bg-slate-50 scale-[1.01]'
                  : 'border-slate-300 hover:border-slate-500 bg-slate-50/60 hover:bg-slate-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,application/vnd.ms-excel"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center mb-3">
                <FileText className="w-6 h-6" />
              </div>

              <h4 className="text-sm font-bold text-slate-900 mb-1">
                Haz clic para seleccionar o arrastra aquí tu CSV
              </h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Soporta archivos exportados de MariaDB (como <code className="text-slate-800 font-semibold">actual_mariadb.csv</code>).
              </p>

              <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-semibold shadow-xs">
                <UploadCloud className="w-3.5 h-3.5" />
                Examinar archivo...
              </div>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="p-8 text-center space-y-4">
              <Loader2 className="w-8 h-8 text-slate-700 animate-spin mx-auto" />
              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">Cargando base de datos...</h4>
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
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <div>
                <h4 className="text-base font-bold text-slate-900">¡Base de datos cargada con éxito!</h4>
                <p className="text-xs text-slate-600 mt-1">
                  Se indexaron <strong className="text-slate-900 font-bold">{successInfo.total.toLocaleString()}</strong> productos listos para usar.
                </p>
              </div>
              <button
                onClick={onClose}
                className="mt-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs shadow-sm transition-all"
              >
                Comenzar Pase de Inventario
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
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>La base de datos queda guardada en tu navegador.</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
