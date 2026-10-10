import React, { useState, useEffect, useRef } from 'react';
import { Search, X, ArrowRight, Tag, DollarSign } from 'lucide-react';
import { searchProducts } from '../utils/db';
import { formatCurrency } from '../utils/export';

export default function ManualProductSearchModal({
  isOpen,
  onClose,
  onSelectProduct
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const found = await searchProducts(searchTerm, 40);
        setResults(found);
        setSelectedIndex(0);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      onSelectProduct(results[selectedIndex]);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-4 pt-2 sm:pt-14 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[85vh]">
        
        {/* Search header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/80">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Escribe el nombre del producto, marca o código..."
            className="w-full bg-transparent text-slate-900 placeholder-slate-400 text-sm sm:text-base focus:outline-none font-medium"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded bg-slate-200 shrink-0"
            >
              Borrar
            </button>
          )}
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-3 divide-y divide-slate-100 space-y-1">
          {isSearching && (
            <div className="p-8 text-center text-xs text-slate-400">
              Buscando en más de 20,000 productos en memoria...
            </div>
          )}

          {!isSearching && searchTerm.trim() && results.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-400">
              No se encontraron productos con "{searchTerm}".
            </div>
          )}

          {!isSearching && !searchTerm.trim() && (
            <div className="p-8 text-center text-xs text-slate-400">
              Comienza a escribir para buscar productos en el catálogo.
            </div>
          )}

          {results.map((product, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <div
                key={product.id || idx}
                onClick={() => onSelectProduct(product)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`p-3 sm:p-3.5 rounded-xl cursor-pointer transition-all border ${
                  isSelected 
                    ? 'bg-slate-100 border-slate-300 shadow-xs' 
                    : 'bg-white border-transparent hover:bg-slate-50'
                }`}
              >
                {/* Top Row: Full complete description + Unit */}
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-bold text-slate-900 text-sm sm:text-base leading-snug break-words whitespace-normal flex-1">
                    {product.descripcion}
                  </h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 font-bold shrink-0 mt-0.5">
                    {product.unidad || 'UNIDAD'}
                  </span>
                </div>

                {/* Bottom Row: Code, Category, Costs, Prices & Select Action */}
                <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100/80 text-xs">
                  
                  {/* Code & Category info */}
                  <div className="flex items-center gap-2 flex-wrap text-slate-500">
                    <span className="font-mono font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                      {product.codigoInternacional || product.codigoInterno || product.codigo}
                    </span>
                    {product.codigoInterno && product.codigoInterno !== product.codigoInternacional && (
                      <span className="text-[11px] text-slate-400">SKU: {product.codigoInterno}</span>
                    )}
                    {product.categoria && (
                      <span className="text-[11px] text-slate-500">• {product.categoria}</span>
                    )}
                  </div>

                  {/* Pricing & Selection button */}
                  <div className="flex items-center gap-3 shrink-0 ml-auto">
                    <div className="text-right text-xs">
                      <span className="text-slate-400 mr-1">Costo:</span>
                      <strong className="text-slate-700">{formatCurrency(product.costo)}</strong>
                    </div>
                    <div className="text-right text-xs">
                      <span className="text-slate-400 mr-1">Precio:</span>
                      <strong className="text-slate-900 font-bold">{formatCurrency(product.precio)}</strong>
                    </div>

                    <button
                      className={`p-1.5 rounded-lg transition-all ${
                        isSelected
                          ? 'bg-slate-800 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                </div>

              </div>
            );
          })}
        </div>

        {/* Footer shortcuts */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline">Usa <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700">↑</kbd> <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700">↓</kbd> para navegar</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700">Enter</kbd> o toca para seleccionar</span>
          </div>
          <span><kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700">Esc</kbd> cerrar</span>
        </div>

      </div>
    </div>
  );
}
