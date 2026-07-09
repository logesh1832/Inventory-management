import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Pagination from '../components/Pagination';
import usePersistedSearchParams from '../utils/usePersistedSearchParams';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const stockBadge = (qty, threshold = 50) => {
  if (qty < threshold) return 'bg-red-100 text-red-700';
  if (qty <= threshold * 4) return 'bg-yellow-100 text-yellow-700';
  return 'bg-green-100 text-green-700';
};

const primaryStock = (p) => {
  if (p.sub_unit && p.qty_per_box) return Math.floor(p.total_stock / p.qty_per_box);
  return p.total_stock;
};

// Split a product's stock into whole primary-unit count + loose sub-units.
// For non-boxed products the whole quantity counts as the primary unit.
const boxLoose = (p) => {
  if (p.sub_unit && p.qty_per_box) {
    return { boxes: Math.floor(p.total_stock / p.qty_per_box), loose: p.total_stock % p.qty_per_box };
  }
  return { boxes: p.total_stock, loose: 0 };
};

export default function StockReport() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams, pendingRestore] = usePersistedSearchParams('report_filters');
  const searchTerm = searchParams.get('search') || '';
  const selectedCategory = searchParams.get('category') || '';
  const lowStockOnly = searchParams.get('low_stock') === '1';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const [stock, setStock] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [exporting, setExporting] = useState(false);

  const updateParams = (updates) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(updates).forEach(([k, v]) => {
        if (v) next.set(k, String(v));
        else next.delete(k);
      });
      return next;
    });
  };

  const fetchStock = useCallback(async (pg, lim, lowStock, category, search) => {
    try {
      setLoading(true);
      const params = { page: pg, limit: lim };
      if (lowStock) params.low_stock = true;
      if (category) params.category = category;
      if (search) params.search = search;
      const res = await api.get('/inventory/stock-report', { params });
      setStock(res.data.data);
      setTotal(res.data.total);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api.get('/products/categories').then((res) => setCategories(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (pendingRestore) return; // wait for persisted filters to restore, then fetch once
    fetchStock(page, limit, lowStockOnly, selectedCategory, searchTerm);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, lowStockOnly, selectedCategory, searchTerm, pendingRestore]);

  const handleLowStockToggle = () => {
    updateParams({ low_stock: lowStockOnly ? null : '1', page: null });
  };

  const handleCategoryChange = (e) => {
    updateParams({ category: e.target.value, page: null });
  };

  const handleSearch = (val) => {
    updateParams({ search: val, page: null });
  };

  const handlePageChange = (pg) => {
    updateParams({ page: pg });
  };

  const handleLimitChange = (lim) => {
    updateParams({ limit: lim, page: null });
  };

  const fetchAllForExport = async () => {
    const params = {};
    if (lowStockOnly) params.low_stock = true;
    if (selectedCategory) params.category = selectedCategory;
    if (searchTerm) params.search = searchTerm;
    const res = await api.get('/inventory/stock-report', { params });
    return Array.isArray(res.data) ? res.data : res.data.data;
  };

  const stockStatus = (qty, threshold = 50) => {
    if (qty < threshold) return 'Low';
    if (qty <= threshold * 4) return 'Medium';
    return 'Good';
  };

  const buildRows = (data) =>
    data.map((p) => {
      const qty = primaryStock(p);
      const stockDisplay = p.sub_unit && p.qty_per_box
        ? `${qty} ${p.unit}${p.total_stock % p.qty_per_box > 0 ? ` + ${p.total_stock % p.qty_per_box} ${p.sub_unit}` : ''}`
        : `${qty} ${p.unit}`;
      return {
        'Product Name': p.product_name,
        'Category': p.category || '-',
        'Total Stock': stockDisplay,
        'Unit': p.unit,
        'Threshold': p.low_stock_threshold ?? 50,
        'Status': stockStatus(qty, p.low_stock_threshold ?? 50),
      };
    });

  // Excel rows carry the stock quantities as real numbers (Boxes / Loose /
  // Total Pieces) so Excel can SUM them — a single "10 Box + 1440 Roll" string
  // is text and can't be summed.
  const buildExcelRows = (data) =>
    data.map((p) => {
      const { boxes, loose } = boxLoose(p);
      return {
        'Product Name': p.product_name,
        'Category': p.category || '-',
        'Boxes': boxes,
        'Loose': loose,
        'Total Pieces': p.total_stock,
        'Unit': p.unit,
        'Sub Unit': p.sub_unit || '-',
        'Threshold': p.low_stock_threshold ?? 50,
        'Status': stockStatus(primaryStock(p), p.low_stock_threshold ?? 50),
      };
    });

  const exportExcel = async () => {
    setExporting(true);
    try {
      const data = await fetchAllForExport();
      const rows = buildExcelRows(data);
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }];

      // TOTAL row uses live SUM() formulas (cols C=Boxes, D=Loose, E=Total
      // Pieces) so Excel recalculates when the user adds or deletes rows.
      const n = rows.length;              // data row count
      if (n > 0) {
        const lastDataRow = n + 1;        // Excel row of last data (header = row 1)
        const totalRow = n + 2;           // Excel row of the TOTAL line
        ws[`A${totalRow}`] = { t: 's', v: 'TOTAL' };
        ['C', 'D', 'E'].forEach((col) => {
          ws[`${col}${totalRow}`] = { t: 'n', f: `SUM(${col}2:${col}${lastDataRow})` };
        });
        const range = XLSX.utils.decode_range(ws['!ref']);
        range.e.r = totalRow - 1;         // extend range to include TOTAL (0-based)
        ws['!ref'] = XLSX.utils.encode_range(range);
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Stock Report');
      const fileName = `stock-report${lowStockOnly ? '-low-stock' : ''}${selectedCategory ? `-${selectedCategory}` : ''}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch {
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const exportPDF = async () => {
    setExporting(true);
    try {
      const data = await fetchAllForExport();
      const rows = buildRows(data);
      const doc = new jsPDF({ orientation: 'landscape' });

      doc.setFontSize(14);
      doc.text('Stock Report', 14, 15);
      doc.setFontSize(9);
      doc.setTextColor(120);
      const subtitle = [
        lowStockOnly ? 'Low Stock Only' : 'All Products',
        selectedCategory ? `Category: ${selectedCategory}` : '',
        searchTerm ? `Search: "${searchTerm}"` : '',
      ].filter(Boolean).join('  |  ');
      if (subtitle) doc.text(subtitle, 14, 22);

      autoTable(doc, {
        startY: subtitle ? 27 : 22,
        head: [['Product Name', 'Category', 'Total Stock', 'Unit', 'Threshold', 'Status']],
        body: rows.map((r) => Object.values(r)),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [234, 179, 8], textColor: 30, fontStyle: 'bold' },
        didParseCell: (hookData) => {
          if (hookData.column.index === 5 && hookData.section === 'body') {
            const val = hookData.cell.raw;
            if (val === 'Low') hookData.cell.styles.textColor = [185, 28, 28];
            else if (val === 'Medium') hookData.cell.styles.textColor = [161, 98, 7];
            else hookData.cell.styles.textColor = [21, 128, 61];
          }
        },
      });

      const fileName = `stock-report${lowStockOnly ? '-low-stock' : ''}${selectedCategory ? `-${selectedCategory}` : ''}.pdf`;
      doc.save(fileName);
    } catch {
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-800">Reports</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={handleLowStockToggle}
              className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
            />
            <span className="text-sm font-medium text-gray-700">Low stock only</span>
          </label>
          <button
            onClick={exportExcel}
            disabled={exporting || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-green-600 text-green-700 rounded hover:bg-green-50 disabled:opacity-50 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
            {exporting ? 'Exporting...' : 'Excel'}
          </button>
          <button
            onClick={exportPDF}
            disabled={exporting || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-red-500 text-red-600 rounded hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
            {exporting ? 'Exporting...' : 'PDF'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="w-full sm:w-72">
          <label className="block text-xs font-medium text-gray-500 mb-1">Search Product</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by name..."
            className="border border-gray-300 rounded px-3 py-2 w-full text-sm"
          />
        </div>
        <div className="w-full sm:w-52">
          <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
          <select
            value={selectedCategory}
            onChange={handleCategoryChange}
            className="border border-gray-300 rounded px-3 py-2 w-full text-sm"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : stock.length === 0 ? (
        <p className="text-gray-500">No products found.</p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {stock.map((p) => (
              <div
                key={p.product_id}
                onClick={() => navigate(`/product-report/${p.product_id}`)}
                className="bg-white rounded-lg shadow p-4 space-y-2 cursor-pointer active:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{p.product_name}</span>
                  <span className={`inline-block px-2 py-1 rounded text-sm font-semibold ${stockBadge(primaryStock(p), p.low_stock_threshold)}`}>
                    {primaryStock(p)} {p.unit}
                    {p.sub_unit && p.qty_per_box && p.total_stock % p.qty_per_box > 0 && (
                      <span className="font-normal ml-1">+ {p.total_stock % p.qty_per_box} {p.sub_unit}</span>
                    )}
                  </span>
                </div>
                {p.sub_unit && p.qty_per_box && (
                  <div className="text-xs text-gray-400">{p.total_stock} {p.sub_unit} total</div>
                )}
                <div className="text-sm text-gray-500"><span className="text-gray-400">Unit:</span> {p.unit}</div>
                <div className="text-sm text-gray-500"><span className="text-gray-400">Threshold:</span> {p.low_stock_threshold ?? 50}</div>
                <div className="text-xs text-gray-400">Tap to view movements</div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded shadow overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Stock</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Threshold</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stock.map((p) => (
                  <tr key={p.product_id} onClick={() => navigate(`/product-report/${p.product_id}`)} className="cursor-pointer hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-sm text-gray-800">{p.product_name}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-block px-2 py-1 rounded text-sm font-semibold ${stockBadge(primaryStock(p), p.low_stock_threshold)}`}>
                        {primaryStock(p)} {p.unit}
                        {p.sub_unit && p.qty_per_box && p.total_stock % p.qty_per_box > 0 && (
                          <span className="font-normal ml-1">+ {p.total_stock % p.qty_per_box} {p.sub_unit}</span>
                        )}
                      </span>
                      {p.sub_unit && p.qty_per_box && (
                        <p className="text-xs text-gray-400 mt-0.5">{p.total_stock} {p.sub_unit}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{p.unit}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{p.low_stock_threshold ?? 50}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-blue-500 font-medium">View Details</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={page} total={total} limit={limit} onPageChange={handlePageChange} onLimitChange={handleLimitChange} />
        </>
      )}
    </div>
  );
}
