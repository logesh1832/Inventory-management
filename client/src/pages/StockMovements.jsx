import { useState, useEffect } from 'react';
import api from '../services/api';
import SearchableSelect from '../components/SearchableSelect';
import { fmtDate } from '../utils/date';
import DateInput from '../components/DateInput';

const toISO = (d) => d.toISOString().split('T')[0];

// PCS → "X Box + Y PCS" display
const formatQty = (qty, unit, subUnit, qtyPerBox) => {
  if (!subUnit || !qtyPerBox || qtyPerBox <= 0) return { text: `${qty}`, unit: unit || '' };
  const boxes = Math.floor(qty / qtyPerBox);
  const remaining = qty % qtyPerBox;
  if (boxes === 0) return { text: `${remaining}`, unit: subUnit };
  if (remaining === 0) return { text: `${boxes}`, unit };
  return { text: `${boxes} ${unit} + ${remaining}`, unit: subUnit };
};

// FY helpers
const getFYStart = (fyYear) => {
  const y = fyYear ?? (new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1);
  return new Date(y, 3, 1);
};
const getFYEnd = (fyYear) => new Date(getFYStart(fyYear).getFullYear() + 1, 2, 31);

const currentFYYear = () => {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
};

const generateFYOptions = () => {
  const cur = currentFYYear();
  const opts = [];
  for (let y = 2023; y <= cur; y++) {
    opts.push({ value: y, label: `${y}-${String(y + 1).slice(-2)}` });
  }
  return opts;
};

// ─── Grouping functions ───────────────────────────────────────────────────────

const groupByProduct = (data) => {
  const map = {};
  data.forEach((m) => {
    const key = m.product_id;
    if (!map[key]) map[key] = {
      label: m.product_name, sublabel: m.product_code, sortKey: m.product_name,
      inQty: 0, outQty: 0, unit: m.unit, sub_unit: m.sub_unit, qty_per_box: m.qty_per_box,
    };
    if (m.movement_type === 'IN') map[key].inQty += m.quantity;
    else map[key].outQty += m.quantity;
  });
  return Object.values(map).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
};

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

const groupByWeek = (data, fyYear) => {
  const fyStart = getFYStart(fyYear);
  const weeks = {};
  for (let w = 1; w <= 52; w++) {
    const wStart = new Date(fyStart);
    wStart.setDate(fyStart.getDate() + (w - 1) * 7);
    const wEnd = new Date(wStart);
    wEnd.setDate(wStart.getDate() + 6);
    weeks[w] = {
      label: `Week ${w} (${fmtDate(toISO(wStart) + 'T00:00')} – ${fmtDate(toISO(wEnd) + 'T00:00')})`,
      sortKey: w, inQty: 0, outQty: 0,
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
  return Object.values(weeks).filter((r) => r.inQty > 0 || r.outQty > 0);
};

const groupByMonth = (data, fyYear) => {
  const map = {};
  // Pre-fill all 12 months of the FY
  const fyStart = getFYStart(fyYear);
  for (let i = 0; i < 12; i++) {
    const d = new Date(fyStart.getFullYear(), fyStart.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    map[key] = { label: d.toLocaleString('default', { month: 'long', year: 'numeric' }), sortKey: key, inQty: 0, outQty: 0 };
  }
  data.forEach((m) => {
    const d = new Date(m.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (map[key]) {
      if (m.movement_type === 'IN') map[key].inQty += m.quantity;
      else map[key].outQty += m.quantity;
    }
  });
  return Object.values(map).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
};

const groupByQuarter = (data, fyYear) => {
  const fy = getFYStart(fyYear).getFullYear();
  // Q1: Apr-Jun, Q2: Jul-Sep, Q3: Oct-Dec, Q4: Jan-Mar
  const quarters = [
    { key: 'Q1', label: `Q1 (Apr–Jun ${fy})`,   months: [[fy, 3],[fy, 4],[fy, 5]] },
    { key: 'Q2', label: `Q2 (Jul–Sep ${fy})`,   months: [[fy, 6],[fy, 7],[fy, 8]] },
    { key: 'Q3', label: `Q3 (Oct–Dec ${fy})`,   months: [[fy, 9],[fy, 10],[fy, 11]] },
    { key: 'Q4', label: `Q4 (Jan–Mar ${fy + 1})`, months: [[fy+1, 0],[fy+1, 1],[fy+1, 2]] },
  ];
  const map = {};
  quarters.forEach((q) => { map[q.key] = { label: q.label, sortKey: q.key, inQty: 0, outQty: 0, months: q.months }; });
  data.forEach((m) => {
    const d = new Date(m.created_at);
    const yr = d.getFullYear(); const mo = d.getMonth();
    for (const q of quarters) {
      if (q.months.some(([y, mn]) => y === yr && mn === mo)) {
        if (m.movement_type === 'IN') map[q.key].inQty += m.quantity;
        else map[q.key].outQty += m.quantity;
        break;
      }
    }
  });
  return Object.values(map);
};

const groupByHalfYear = (data, fyYear) => {
  const fy = getFYStart(fyYear).getFullYear();
  const halves = [
    { key: 'H1', label: `H1 (Apr–Sep ${fy})`,     months: [[fy,3],[fy,4],[fy,5],[fy,6],[fy,7],[fy,8]] },
    { key: 'H2', label: `H2 (Oct–Mar ${fy}–${fy+1})`, months: [[fy,9],[fy,10],[fy,11],[fy+1,0],[fy+1,1],[fy+1,2]] },
  ];
  const map = {};
  halves.forEach((h) => { map[h.key] = { label: h.label, sortKey: h.key, inQty: 0, outQty: 0, months: h.months }; });
  data.forEach((m) => {
    const d = new Date(m.created_at);
    const yr = d.getFullYear(); const mo = d.getMonth();
    for (const h of halves) {
      if (h.months.some(([y, mn]) => y === yr && mn === mo)) {
        if (m.movement_type === 'IN') map[h.key].inQty += m.quantity;
        else map[h.key].outQty += m.quantity;
        break;
      }
    }
  });
  return Object.values(map);
};

const groupByFY = (data) => {
  const map = {};
  data.forEach((m) => {
    const d = new Date(m.created_at);
    const fy = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
    const label = `${fy}-${String(fy + 1).slice(-2)}`;
    if (!map[fy]) map[fy] = { label, sortKey: fy, inQty: 0, outQty: 0 };
    if (m.movement_type === 'IN') map[fy].inQty += m.quantity;
    else map[fy].outQty += m.quantity;
  });
  return Object.values(map).sort((a, b) => a.sortKey - b.sortKey);
};

// ─── Component ────────────────────────────────────────────────────────────────

const PERIODS_WITH_FY = ['weekly', 'monthly', 'quarterly', 'half_yearly'];

const COL_HEADER = {
  daily: 'Date', weekly: 'Week', monthly: 'Month',
  quarterly: 'Quarter', half_yearly: 'Half Year', yearly: 'Financial Year',
};

export default function StockMovements() {
  const [tab, setTab] = useState('all');
  const [products, setProducts] = useState([]);
  const [filterProductId, setFilterProductId] = useState('');
  const [period, setPeriod] = useState('');
  const [fyYear, setFyYear] = useState(currentFYYear);
  const [dailyFrom, setDailyFrom] = useState(toISO(new Date()));
  const [dailyTo, setDailyTo] = useState(toISO(new Date()));
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [rawData, setRawData] = useState([]);
  const [totalIn, setTotalIn] = useState(0);
  const [totalOut, setTotalOut] = useState(0);
  const [searched, setSearched] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    api.get('/products').then((res) => setProducts(res.data)).catch(() => {});
  }, []);

  const fetchMovements = async (productId, movementType, pd, fy, dFrom, dTo) => {
    try {
      setLoading(true);
      let from = '', to = '';
      if (pd === 'daily') {
        from = dFrom; to = dTo;
      } else if (pd === 'weekly' || pd === 'monthly' || pd === 'quarterly' || pd === 'half_yearly') {
        from = toISO(getFYStart(fy));
        to = toISO(getFYEnd(fy));
      }
      // yearly: no date filter — fetch all

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

  const handleSearch = () => {
    if (!filterProductId || !period) {
      showToast('Please select a product and period', 'error');
      return;
    }
    setSearched(true);
    fetchMovements(filterProductId, tab, period, fyYear, dailyFrom, dailyTo);
  };

  const selectedProduct = filterProductId ? products.find((p) => p.id === filterProductId) : null;
  const inUnit = selectedProduct?.unit || '';
  const outUnit = selectedProduct?.sub_unit || selectedProduct?.unit || '';

  // Grouping
  let grouped = [];
  if (!filterProductId) {
    grouped = groupByProduct(rawData);
  } else if (period === 'daily') {
    grouped = groupByDate(rawData);
  } else if (period === 'weekly') {
    grouped = groupByWeek(rawData, fyYear);
  } else if (period === 'monthly') {
    grouped = groupByMonth(rawData, fyYear);
  } else if (period === 'quarterly') {
    grouped = groupByQuarter(rawData, fyYear);
  } else if (period === 'half_yearly') {
    grouped = groupByHalfYear(rawData, fyYear);
  } else if (period === 'yearly') {
    grouped = groupByFY(rawData);
  }

  const colHeader = !filterProductId ? 'Product' : (COL_HEADER[period] || 'Period');

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
            options={products.map((p) => ({ value: p.id, label: p.product_name }))}
            value={filterProductId}
            onChange={setFilterProductId}
            placeholder="Select Product"
          />
        </div>

        <div className="w-full sm:w-auto">
          <label className="block text-xs font-medium text-gray-500 mb-1">Period</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="">Select Period</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="half_yearly">Half Yearly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>

        {/* FY dropdown — for all periods except Daily and Yearly */}
        {PERIODS_WITH_FY.includes(period) && (
          <div className="w-full sm:w-auto">
            <label className="block text-xs font-medium text-gray-500 mb-1">Financial Year</label>
            <select
              value={fyYear}
              onChange={(e) => setFyYear(Number(e.target.value))}
              className="border border-gray-300 rounded px-3 py-2 text-sm"
            >
              {generateFYOptions().map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Date range — only for Daily */}
        {period === 'daily' && (
          <>
            <div className="w-full sm:w-auto">
              <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
              <DateInput
                value={dailyFrom}
                onChange={(e) => setDailyFrom(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 w-full sm:w-36 text-sm"
              />
            </div>
            <div className="w-full sm:w-auto">
              <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
              <DateInput
                value={dailyTo}
                onChange={(e) => setDailyTo(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 w-full sm:w-36 text-sm"
              />
            </div>
          </>
        )}

        <div className="w-full sm:w-auto self-end">
          <button
            onClick={handleSearch}
            className="bg-blue-600 text-white px-5 py-2 rounded text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Search
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {searched && (() => {
        const outFmt = selectedProduct
          ? formatQty(totalOut, selectedProduct.unit, selectedProduct.sub_unit, selectedProduct.qty_per_box)
          : { text: `${totalOut}`, unit: outUnit };
        return (
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="bg-green-50 rounded-lg shadow px-4 py-3 min-w-[100px]">
              <p className="text-xs text-green-600">Total In</p>
              <p className="text-xl font-bold text-green-800">
                {(() => {
                  const f = selectedProduct
                    ? formatQty(totalIn, selectedProduct.unit, selectedProduct.sub_unit, selectedProduct.qty_per_box)
                    : { text: `${totalIn}`, unit: inUnit };
                  return <>{f.text}{f.unit && <span className="text-sm font-normal ml-1">{f.unit}</span>}</>;
                })()}
              </p>
            </div>
            <div className="bg-red-50 rounded-lg shadow px-4 py-3 min-w-[100px]">
              <p className="text-xs text-red-600">Total Out</p>
              <p className="text-xl font-bold text-red-800">
                {outFmt.text}{outFmt.unit && <span className="text-sm font-normal ml-1">{outFmt.unit}</span>}
              </p>
            </div>
            <div className="bg-blue-50 rounded-lg shadow px-4 py-3 min-w-[100px]">
              <p className="text-xs text-blue-600">Balance</p>
              <p className="text-xl font-bold text-blue-800">
                {(() => {
                  const bal = totalIn - totalOut;
                  const f = selectedProduct
                    ? formatQty(Math.abs(bal), selectedProduct.unit, selectedProduct.sub_unit, selectedProduct.qty_per_box)
                    : { text: `${Math.abs(bal)}`, unit: inUnit };
                  return <>{bal < 0 ? '-' : ''}{f.text}{f.unit && <span className="text-sm font-normal ml-1">{f.unit}</span>}</>;
                })()}
              </p>
            </div>
          </div>
        );
      })()}

      {!searched ? (
        <p className="text-gray-400 text-sm">Select a product and period, then click Search.</p>
      ) : loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : grouped.length === 0 ? (
        <p className="text-gray-500">No movements found.</p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {grouped.map((r, idx) => {
              const rUnit = filterProductId ? selectedProduct?.unit : r.unit;
              const rSubUnit = filterProductId ? selectedProduct?.sub_unit : r.sub_unit;
              const rQpb = filterProductId ? selectedProduct?.qty_per_box : r.qty_per_box;
              const outFmt = formatQty(r.outQty, rUnit, rSubUnit, rQpb);
              return (
                <div key={idx} className="bg-white rounded-lg shadow p-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-800">{r.label}</span>
                  <div className="flex gap-4">
                    <span className={`text-sm font-semibold ${r.inQty > 0 ? 'text-green-700' : 'text-gray-300'}`}>
                      {r.inQty > 0 ? (() => { const f = formatQty(r.inQty, rUnit, rSubUnit, rQpb); return `${f.text}${f.unit ? ' ' + f.unit : ''}`; })() : '—'}
                    </span>
                    <span className={`text-sm font-semibold ${r.outQty > 0 ? 'text-red-700' : 'text-gray-300'}`}>
                      {r.outQty > 0 ? `${outFmt.text}${outFmt.unit ? ' ' + outFmt.unit : ''}` : '—'}
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
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">{colHeader}</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-green-700 uppercase bg-green-50 w-40">
                    In Qty{inUnit && <span className="normal-case font-normal ml-1">({inUnit})</span>}
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-red-700 uppercase bg-red-50 w-40">
                    Out Qty{outUnit && <span className="normal-case font-normal ml-1">({outUnit})</span>}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {grouped.map((r, idx) => {
                  const rUnit = filterProductId ? selectedProduct?.unit : r.unit;
                  const rSubUnit = filterProductId ? selectedProduct?.sub_unit : r.sub_unit;
                  const rQpb = filterProductId ? selectedProduct?.qty_per_box : r.qty_per_box;
                  const outFmt = formatQty(r.outQty, rUnit, rSubUnit, rQpb);
                  return (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-5 py-2.5 text-sm font-medium text-gray-800">
                        {r.label}
                        {r.sublabel && <span className="text-xs text-gray-400 ml-1">({r.sublabel})</span>}
                      </td>
                      <td className="px-5 py-2.5 text-sm text-right font-semibold bg-green-50/50">
                        {r.inQty > 0 ? (() => {
                          const f = formatQty(r.inQty, rUnit, rSubUnit, rQpb);
                          return <span className="text-green-700">{f.text}{f.unit && <span className="text-xs font-normal ml-1 text-green-600">{f.unit}</span>}</span>;
                        })() : <span className="text-gray-200">—</span>}
                      </td>
                      <td className="px-5 py-2.5 text-sm text-right font-semibold bg-red-50/50">
                        {r.outQty > 0
                          ? <span className="text-red-700">{outFmt.text}{outFmt.unit && <span className="text-xs font-normal ml-1 text-red-600">{outFmt.unit}</span>}</span>
                          : <span className="text-gray-200">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                {(() => {
                  const totOutFmt = selectedProduct
                    ? formatQty(totalOut, selectedProduct.unit, selectedProduct.sub_unit, selectedProduct.qty_per_box)
                    : { text: `${totalOut}`, unit: outUnit };
                  return (
                    <tr>
                      <td className="px-5 py-3 text-sm font-bold text-gray-700 text-right">Total</td>
                      <td className="px-5 py-3 text-sm text-right font-bold text-green-700 bg-green-50">
                        {(() => {
                          const f = selectedProduct
                            ? formatQty(totalIn, selectedProduct.unit, selectedProduct.sub_unit, selectedProduct.qty_per_box)
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
