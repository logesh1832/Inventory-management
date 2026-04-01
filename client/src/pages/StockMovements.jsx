import { useState, useEffect } from 'react';
import api from '../services/api';
import SearchableSelect from '../components/SearchableSelect';
import { fmtDate } from '../utils/date';

const toISO = (d) => d.toISOString().split('T')[0];

// Both IN and OUT quantities are stored in PCS (sub-unit) for products with sub_unit.
// Converts PCS → "X Box + Y PCS" display.
const formatQtyPCS = (qty, unit, subUnit, qtyPerBox) => {
  if (!subUnit || !qtyPerBox || qtyPerBox <= 0) return { text: `${qty}`, unit: unit || '' };
  const boxes = Math.floor(qty / qtyPerBox);
  const remaining = qty % qtyPerBox;
  if (boxes === 0) return { text: `${remaining}`, unit: subUnit };
  if (remaining === 0) return { text: `${boxes}`, unit };
  return { text: `${boxes} ${unit} + ${remaining}`, unit: subUnit };
};
const formatOutQty = formatQtyPCS;

// Financial year starts April 1
const getFYStart = () => {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(year, 3, 1); // April 1
};

const getFYEnd = () => {
  const start = getFYStart();
  return new Date(start.getFullYear() + 1, 2, 31); // March 31
};

const getQuarterDates = () => {
  const now = new Date();
  const m = now.getMonth();
  let start;
  if (m >= 3 && m <= 5) start = new Date(now.getFullYear(), 3, 1);
  else if (m >= 6 && m <= 8) start = new Date(now.getFullYear(), 6, 1);
  else if (m >= 9 && m <= 11) start = new Date(now.getFullYear(), 9, 1);
  else start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 3, 0);
  return { from: toISO(start), to: toISO(end) };
};

const getMonthDates = () => {
  const now = new Date();
  return {
    from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
    to: toISO(now),
  };
};

const monthNames = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

// Group movements by product
const groupByProduct = (data) => {
  const map = {};
  data.forEach((m) => {
    const key = m.product_id;
    if (!map[key]) map[key] = {
      label: m.product_name, sublabel: m.product_code, sortKey: m.product_name,
      inQty: 0, outQty: 0,
      unit: m.unit, sub_unit: m.sub_unit, qty_per_box: m.qty_per_box,
    };
    if (m.movement_type === 'IN') map[key].inQty += m.quantity;
    else map[key].outQty += m.quantity;
  });
  return Object.values(map).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
};

// Group movements by date
const groupByDate = (data) => {
  const map = {};
  data.forEach((m) => {
    const d = toISO(new Date(m.created_at));
    if (!map[d]) map[d] = { label: fmtDate(d + 'T00:00'), sortKey: d, inQty: 0, outQty: 0 };
    if (m.movement_type === 'IN') map[d].inQty += m.quantity;
    else map[d].outQty += m.quantity;
  });
  return Object.values(map).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
};

// Group movements by week number in financial year
const groupByWeek = (data) => {
  const fyStart = getFYStart();
  const weeks = {};
  // Initialize all 52 weeks
  for (let w = 1; w <= 52; w++) {
    const wStart = new Date(fyStart);
    wStart.setDate(fyStart.getDate() + (w - 1) * 7);
    const wEnd = new Date(wStart);
    wEnd.setDate(wStart.getDate() + 6);
    weeks[w] = {
      label: `Week ${w} (${fmtDate(toISO(wStart) + 'T00:00')} - ${fmtDate(toISO(wEnd) + 'T00:00')})`,
      sortKey: w,
      inQty: 0,
      outQty: 0,
    };
  }
  data.forEach((m) => {
    const d = new Date(m.created_at);
    const diff = Math.floor((d - fyStart) / (1000 * 60 * 60 * 24));
    const week = Math.floor(diff / 7) + 1;
    if (week >= 1 && week <= 52) {
      if (m.movement_type === 'IN') weeks[week].inQty += m.quantity;
      else weeks[week].outQty += m.quantity;
    }
  });
  return Object.values(weeks);
};

// Group movements by month
const groupByMonth = (data, fyBased = false) => {
  const map = {};
  data.forEach((m) => {
    const d = new Date(m.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    if (!map[key]) map[key] = { label: monthLabel, sortKey: key, inQty: 0, outQty: 0 };
    if (m.movement_type === 'IN') map[key].inQty += m.quantity;
    else map[key].outQty += m.quantity;
  });

  if (fyBased) {
    // Fill all 12 months of financial year
    const fyStart = getFYStart();
    for (let i = 0; i < 12; i++) {
      const d = new Date(fyStart.getFullYear(), fyStart.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = d.toLocaleString('default', { month: 'long', year: 'numeric' });
      if (!map[key]) map[key] = { label: monthLabel, sortKey: key, inQty: 0, outQty: 0 };
    }
  }

  return Object.values(map).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
};

export default function StockMovements() {
  const [tab, setTab] = useState('all'); // 'all' | 'in' | 'out'
  const [products, setProducts] = useState([]);
  const [filterProductId, setFilterProductId] = useState('');
  const [period, setPeriod] = useState('monthly');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [rawData, setRawData] = useState([]);
  const [totalIn, setTotalIn] = useState(0);
  const [totalOut, setTotalOut] = useState(0);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    api.get('/products').then((res) => setProducts(res.data)).catch(() => {});
  }, []);

  const fetchMovements = async (productId, movementType, pd) => {
    try {
      setLoading(true);
      let from = '', to = '';
      if (pd === 'monthly') {
        const d = getMonthDates();
        from = d.from; to = d.to;
      } else if (pd === 'quarterly') {
        const d = getQuarterDates();
        from = d.from; to = d.to;
      } else if (pd === 'weekly' || pd === 'yearly') {
        from = toISO(getFYStart());
        to = toISO(new Date()); // up to today
      }

      const params = { page: 1, limit: 5000 };
      if (productId) params.product_id = productId;
      if (movementType && movementType !== 'all') params.movement_type = movementType === 'in' ? 'IN' : 'OUT';
      if (from) params.from_date = from;
      if (to) params.to_date = to;

      const res = await api.get('/inventory', { params });
      setRawData(res.data.data);
      setTotalIn(res.data.total_in);
      setTotalOut(res.data.total_out);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to load movements', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements(filterProductId, tab, period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterProductId, tab, period]);

  // Selected product info (for unit labels in single-product view)
  const selectedProduct = filterProductId ? products.find((p) => p.id === filterProductId) : null;
  const inUnit = selectedProduct?.unit || '';
  const outUnit = selectedProduct?.sub_unit || selectedProduct?.unit || '';

  // Group data based on period
  let grouped = [];
  if (!filterProductId) {
    // No product selected — group by product
    grouped = groupByProduct(rawData);
  } else if (period === 'monthly') {
    grouped = groupByDate(rawData);
  } else if (period === 'weekly') {
    grouped = groupByWeek(rawData);
  } else if (period === 'quarterly') {
    grouped = groupByMonth(rawData, false);
  } else if (period === 'yearly') {
    grouped = groupByMonth(rawData, true);
  }

  // Filter out empty rows for weekly (show only weeks with data)
  const displayData = period === 'weekly' && filterProductId
    ? grouped.filter((r) => r.inQty > 0 || r.outQty > 0)
    : grouped;

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded shadow-lg text-white ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
          {toast.message}
        </div>
      )}

      <h2 className="text-2xl font-bold text-gray-800 mb-6">Stock Movements</h2>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {['all', 'in', 'out'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'all' ? 'All Movements' : t === 'in' ? 'Material In' : 'Material Out'}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div className="w-full sm:w-72">
          <label className="block text-xs font-medium text-gray-500 mb-1">Product</label>
          <SearchableSelect
            options={products.map((p) => ({ value: p.id, label: `${p.product_name} (${p.product_code})` }))}
            value={filterProductId}
            onChange={setFilterProductId}
            placeholder="All Products"
          />
        </div>
        <div className="w-full sm:w-auto">
          <label className="block text-xs font-medium text-gray-500 mb-1">Period</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
      </div>

      {/* Summary cards */}
      {(() => {
        const outFmt = selectedProduct
          ? formatOutQty(totalOut, selectedProduct.unit, selectedProduct.sub_unit, selectedProduct.qty_per_box)
          : { text: `${totalOut}`, unit: outUnit };
        return (
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="bg-green-50 rounded-lg shadow px-4 py-3 min-w-[100px]">
              <p className="text-xs text-green-600">Total In</p>
              <p className="text-xl font-bold text-green-800">
                {(() => {
                  const f = selectedProduct
                    ? formatQtyPCS(totalIn, selectedProduct.unit, selectedProduct.sub_unit, selectedProduct.qty_per_box)
                    : { text: `${totalIn}`, unit: inUnit };
                  return <>{f.text}{f.unit && <span className="text-sm font-normal ml-1">{f.unit}</span>}</>;
                })()}
              </p>
            </div>
            <div className="bg-red-50 rounded-lg shadow px-4 py-3 min-w-[100px]">
              <p className="text-xs text-red-600">Total Out</p>
              <p className="text-xl font-bold text-red-800">
                {outFmt.text}
                {outFmt.unit && <span className="text-sm font-normal ml-1">{outFmt.unit}</span>}
              </p>
            </div>
            <div className="bg-blue-50 rounded-lg shadow px-4 py-3 min-w-[100px]">
              <p className="text-xs text-blue-600">Balance</p>
              <p className="text-xl font-bold text-blue-800">
                {(() => {
                  const bal = totalIn - totalOut;
                  const f = selectedProduct
                    ? formatQtyPCS(Math.abs(bal), selectedProduct.unit, selectedProduct.sub_unit, selectedProduct.qty_per_box)
                    : { text: `${bal}`, unit: inUnit };
                  return <>{bal < 0 ? '-' : ''}{f.text}{f.unit && <span className="text-sm font-normal ml-1">{f.unit}</span>}</>;
                })()}
              </p>
            </div>
          </div>
        );
      })()}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : displayData.length === 0 ? (
        <p className="text-gray-500">No movements found.</p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {displayData.map((r, idx) => {
              const rowInUnit = filterProductId ? inUnit : (r.unit || '');
              const rUnit = filterProductId ? selectedProduct?.unit : r.unit;
              const rSubUnit = filterProductId ? selectedProduct?.sub_unit : r.sub_unit;
              const rQpb = filterProductId ? selectedProduct?.qty_per_box : r.qty_per_box;
              const outFmt = formatOutQty(r.outQty, rUnit, rSubUnit, rQpb);
              return (
                <div key={idx} className="bg-white rounded-lg shadow p-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-800">{r.label}</span>
                  <div className="flex gap-4">
                    <span className={`text-sm font-semibold ${r.inQty > 0 ? 'text-green-700' : 'text-gray-300'}`}>
                      {r.inQty > 0 ? (() => { const f = formatQtyPCS(r.inQty, rUnit, rSubUnit, rQpb); return `+${f.text}${f.unit ? ' ' + f.unit : ''}`; })() : '—'}
                    </span>
                    <span className={`text-sm font-semibold ${r.outQty > 0 ? 'text-red-700' : 'text-gray-300'}`}>
                      {r.outQty > 0 ? `-${outFmt.text}${outFmt.unit ? ' ' + outFmt.unit : ''}` : '—'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto bg-white rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {!filterProductId ? 'Product' : period === 'monthly' ? 'Date' : period === 'weekly' ? 'Week' : 'Month'}
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-green-700 uppercase bg-green-50 w-40">
                    In Qty{inUnit && <span className="normal-case font-normal ml-1">({inUnit})</span>}
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-red-700 uppercase bg-red-50 w-40">
                    Out Qty{outUnit && <span className="normal-case font-normal ml-1">({outUnit})</span>}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {displayData.map((r, idx) => {
                  const rowInUnit = filterProductId ? inUnit : (r.unit || '');
                  const rUnit = filterProductId ? selectedProduct?.unit : r.unit;
                  const rSubUnit = filterProductId ? selectedProduct?.sub_unit : r.sub_unit;
                  const rQpb = filterProductId ? selectedProduct?.qty_per_box : r.qty_per_box;
                  const outFmt = formatOutQty(r.outQty, rUnit, rSubUnit, rQpb);
                  return (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-5 py-2.5 text-sm font-medium text-gray-800">
                        {r.label}
                        {r.sublabel && <span className="text-xs text-gray-400 ml-1">({r.sublabel})</span>}
                      </td>
                      <td className="px-5 py-2.5 text-sm text-right font-semibold bg-green-50/50">
                        {r.inQty > 0 ? (() => {
                          const f = formatQtyPCS(r.inQty, rUnit, rSubUnit, rQpb);
                          return (
                            <span className="text-green-700">
                              {f.text}
                              {f.unit && <span className="text-xs font-normal ml-1 text-green-600">{f.unit}</span>}
                            </span>
                          );
                        })() : (
                          <span className="text-gray-200">—</span>
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-sm text-right font-semibold bg-red-50/50">
                        {r.outQty > 0 ? (
                          <span className="text-red-700">
                            {outFmt.text}
                            {outFmt.unit && <span className="text-xs font-normal ml-1 text-red-600">{outFmt.unit}</span>}
                          </span>
                        ) : (
                          <span className="text-gray-200">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                {(() => {
                  const totOutFmt = selectedProduct
                    ? formatOutQty(totalOut, selectedProduct.unit, selectedProduct.sub_unit, selectedProduct.qty_per_box)
                    : { text: `${totalOut}`, unit: outUnit };
                  return (
                    <tr>
                      <td className="px-5 py-3 text-sm font-bold text-gray-700 text-right">Total</td>
                      <td className="px-5 py-3 text-sm text-right font-bold text-green-700 bg-green-50">
                        {(() => {
                          const f = selectedProduct
                            ? formatQtyPCS(totalIn, selectedProduct.unit, selectedProduct.sub_unit, selectedProduct.qty_per_box)
                            : { text: `${totalIn}`, unit: inUnit };
                          return <>{f.text}{f.unit && <span className="text-xs font-normal ml-1">{f.unit}</span>}</>;
                        })()}
                      </td>
                      <td className="px-5 py-3 text-sm text-right font-bold text-red-700 bg-red-50">
                        {totOutFmt.text}{totOutFmt.unit && <span className="text-xs font-normal ml-1">{totOutFmt.unit}</span>}
                      </td>
                    </tr>
                  );
                })()}
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
