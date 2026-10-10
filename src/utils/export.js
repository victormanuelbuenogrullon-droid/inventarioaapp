import * as XLSX from 'xlsx';

/**
 * Format currency helper
 */
export function formatCurrency(value) {
  if (value === undefined || value === null || isNaN(value)) return '$0.00';
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value).replace('DOP', '$');
}

/**
 * Format standard number with commas
 */
export function formatNumber(value) {
  if (value === undefined || value === null || isNaN(value)) return '0';
  return new Intl.NumberFormat('es-DO', {
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Export inventory count to Excel (.xlsx)
 */
export function exportToExcel(items, sessionName = 'Pase_Inventario') {
  if (!items || items.length === 0) {
    alert('No hay productos en el listado para exportar.');
    return;
  }

  // Calculate totals
  let totalQty = 0;
  let totalCost = 0;
  let totalPrice = 0;

  const dataRows = items.map((item, index) => {
    const qty = Number(item.cantidadContada) || 0;
    const cost = Number(item.costo) || 0;
    const price = Number(item.precio) || 0;
    const itemTotalCost = qty * cost;
    const itemTotalPrice = qty * price;

    totalQty += qty;
    totalCost += itemTotalCost;
    totalPrice += itemTotalPrice;

    return {
      '#': index + 1,
      'Código de Barra': item.codigoInternacional || item.codigoInterno || item.codigo || '',
      'Código Interno': item.codigoInterno || '',
      'Descripción del Producto': item.descripcion || '',
      'Unidad': item.unidad || 'UNIDAD',
      'Categoría': item.categoria || '',
      'Departamento': item.departamento || '',
      'Cantidad Contada': qty,
      'Costo Unitario ($)': cost,
      'Inversión Total ($)': itemTotalCost,
      'Precio Unitario ($)': price,
      'Precio Total ($)': itemTotalPrice,
      'Margen Bruto ($)': itemTotalPrice - itemTotalCost,
      'Fecha / Hora Conteo': item.updatedAt ? new Date(item.updatedAt).toLocaleString('es-DO') : ''
    };
  });

  // Append Total Row
  dataRows.push({
    '#': '',
    'Código de Barra': '',
    'Código Interno': '',
    'Descripción del Producto': 'TOTALES GENERALES',
    'Unidad': '',
    'Categoría': '',
    'Departamento': '',
    'Cantidad Contada': totalQty,
    'Costo Unitario ($)': '',
    'Inversión Total ($)': totalCost,
    'Precio Unitario ($)': '',
    'Precio Total ($)': totalPrice,
    'Margen Bruto ($)': totalPrice - totalCost,
    'Fecha / Hora Conteo': ''
  });

  const ws = XLSX.utils.json_to_sheet(dataRows);

  // Set column widths
  ws['!cols'] = [
    { wch: 5 },   // #
    { wch: 18 },  // Código de Barra
    { wch: 15 },  // Código Interno
    { wch: 45 },  // Descripción
    { wch: 10 },  // Unidad
    { wch: 20 },  // Categoría
    { wch: 20 },  // Departamento
    { wch: 16 },  // Cantidad Contada
    { wch: 16 },  // Costo Unitario
    { wch: 18 },  // Inversión Total
    { wch: 16 },  // Precio Unitario
    { wch: 18 },  // Precio Total
    { wch: 16 },  // Margen Bruto
    { wch: 20 }   // Fecha
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pase de Inventario');

  const nowStr = new Date().toISOString().slice(0, 10);
  const cleanSessionName = (sessionName || 'Inventario').replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(wb, `${cleanSessionName}_${nowStr}.xlsx`);
}

/**
 * Export inventory count to CSV
 */
export function exportToCSV(items, sessionName = 'Pase_Inventario') {
  if (!items || items.length === 0) {
    alert('No hay productos en el listado para exportar.');
    return;
  }

  const headers = [
    '#',
    'Codigo_Barra',
    'Codigo_Interno',
    'Descripcion',
    'Unidad',
    'Categoria',
    'Cantidad_Contada',
    'Costo_Unitario',
    'Inversion_Total',
    'Precio_Unitario',
    'Precio_Total'
  ];

  const csvRows = [headers.join(',')];

  items.forEach((item, index) => {
    const qty = Number(item.cantidadContada) || 0;
    const cost = Number(item.costo) || 0;
    const price = Number(item.precio) || 0;
    const itemTotalCost = (qty * cost).toFixed(2);
    const itemTotalPrice = (qty * price).toFixed(2);

    const desc = `"${(item.descripcion || '').replace(/"/g, '""')}"`;
    const row = [
      index + 1,
      `"${item.codigoInternacional || item.codigoInterno || ''}"`,
      `"${item.codigoInterno || ''}"`,
      desc,
      `"${item.unidad || 'UNIDAD'}"`,
      `"${item.categoria || ''}"`,
      qty,
      cost.toFixed(2),
      itemTotalCost,
      price.toFixed(2),
      itemTotalPrice
    ];
    csvRows.push(row.join(','));
  });

  const csvContent = '\uFEFF' + csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const nowStr = new Date().toISOString().slice(0, 10);
  link.setAttribute('download', `${sessionName}_${nowStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
