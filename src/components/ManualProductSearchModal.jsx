import React, { useState, useEffect, useRef } from 'react';
import { Search, X, ArrowRight } from 'lucide-react';
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
        const found = await searchProducts(searchTerm, 30);
        setResults(found);
        setSelectedIndex(0);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 150);

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
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
        
        {/* Search header */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/60">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Escribe el nombre del producto, marca o código para buscar en el catálogo..."
            className="w-full bg-transparent text-slate-900 placeholder-slate-400 text-sm sm:text-base focus:outline-none font-medium"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded bg-slate-200"
            >
              Borrar
            </button>
          )}
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-100">
          {isSearching && (
            <div className="p-8 text-center text-xs text-slate-400">
              Buscando en más de 20,000 productos...
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
                className={`p-3 rounded-xl cursor-pointer flex items-center justify-between gap-3 transition-colors ${
                  isSelected ? 'bg-slate-100' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm truncate">
                      {product.descripcion}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-bold shrink-0">
                      {product.unidad || 'UNIDAD'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <span className="font-mono text-slate-600">
                      {product.codigoInternacional || product.codigoInterno || product.codigo}
                    </span>
                    {product.categoria && (
                      <span>• {product.categoria}</span>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs text-slate-500">
                    Costo: <strong className="text-slate-800">{formatCurrency(product.costo)}</strong>
                  </div>
                  <div className="text-xs text-slate-500">
                    Precio: <strong className="text-slate-800">{formatCurrency(product.precio)}</strong>
                  </div>
                </div>

                <div className="pl-2">
                  <button
                    className={`p-2 rounded-xl transition-all ${
                      isSelected
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

              </div>
            );
          })}
        </div>

        {/* Footer shortcuts */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>Usa <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700">↑</kbd> <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700">↓</kbd> para navegar</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700">Enter</kbd> para seleccionar</span>
          </div>
          <span><kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700">Esc</kbd> para cerrar</span>
        </div>

      </div>
    </div>
  );
}
