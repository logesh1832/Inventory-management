import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import SearchableSelect from '../components/SearchableSelect';
import { fmtDate } from '../utils/date';
import DateInput from '../components/DateInput';

const nf = (n) => Number(n || 0).toLocaleString('en-IN');

const COL_HEADER = {
  daily: 'Date', weekly: 'Week', monthly: 'Month',
  quarterly: 'Quarter', half_yearly: 'Half Year', yearly: 'Financial Year',
};

// India FY starts Apr 1: months Apr–Dec belong to that calendar year's FY, Jan–Mar to prev.
const parseDay = (s) => new Date(s + 'T00:00:00');
const fyOf = (d) => (d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1);
const fyLabel = (fy) => `${fy}-${String(fy + 1).slice(-2)}`;
const fmtISO = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

// day string + period → { key, sortKey, label, from, to } for the bucket it
// belongs to. `from`/`to` are the bucket's date range (used for the drill-down).
const periodKey = (dayStr, period) => {
  const d = parseDay(dayStr);
  const fy = fyOf(d);
  const y = d.getFullYear();
  const m = d.getMonth();
  if (period === 'daily') {
    return { key: dayStr, sortKey: dayStr, label: fmtDate(dayStr + 'T00:00'), from: dayStr, to: dayStr };
  }
  if (period === 'monthly') {
    const key = `${y}-${String(m + 1).padStart(2, '0')}`;
    return { key, sortKey: key, label: d.toLocaleString('default', { month: 'long', year: 'numeric' }),
      from: `${key}-01`, to: fmtISO(new Date(y, m + 1, 0)) };
  }
  if (period === 'yearly') {
    return { key: `${fy}`, sortKey: `${fy}`, label: `FY ${fyLabel(fy)}`, from: `${fy}-04-01`, to: `${fy + 1}-03-31` };
  }
  if (period === 'quarterly') {
    const q = m >= 3 && m <= 5 ? 1 : m >= 6 && m <= 8 ? 2 : m >= 9 && m <= 11 ? 3 : 4;
    const names = { 1: 'Apr–Jun', 2: 'Jul–Sep', 3: 'Oct–Dec', 4: 'Jan–Mar' };
    const ranges = {
      1: [`${fy}-04-01`, `${fy}-06-30`], 2: [`${fy}-07-01`, `${fy}-09-30`],
      3: [`${fy}-10-01`, `${fy}-12-31`], 4: [`${fy + 1}-01-01`, `${fy + 1}-03-31`],
    };
    return { key: `${fy}-Q${q}`, sortKey: `${fy}-Q${q}`, label: `Q${q} ${names[q]} · FY ${fyLabel(fy)}`,
      from: ranges[q][0], to: ranges[q][1] };
  }
  if (period === 'half_yearly') {
    const h = m >= 3 && m <= 8 ? 1 : 2;
    const range = h === 1 ? [`${fy}-04-01`, `${fy}-09-30`] : [`${fy}-10-01`, `${fy + 1}-03-31`];
    return { key: `${fy}-H${h}`, sortKey: `${fy}-H${h}`, label: `H${h} ${h === 1 ? 'Apr–Sep' : 'Oct–Mar'} · FY ${fyLabel(fy)}`,
      from: range[0], to: range[1] };
  }
  // weekly
  const fyStart = new Date(fy, 3, 1);
  const wk = Math.floor((d - fyStart) / (1000 * 60 * 60 * 24 * 7)) + 1;
  const wkStart = new Date(fy, 3, 1 + (wk - 1) * 7);
  const wkEnd = new Date(wkStart);
  wkEnd.setDate(wkStart.getDate() + 6);
  const wkKey = `${fy}-W${String(wk).padStart(2, '0')}`;
  return { key: wkKey, sortKey: wkKey, label: `Week ${wk} · FY ${fyLabel(fy)}`, from: fmtISO(wkStart), to: fmtISO(wkEnd) };
};

// Aggregate carton count over a set of per-product totals:
// boxes = Σ floor(qty / qty_per_box), loose = Σ leftover; no box config ⇒ all loose.
const cartonize = (products) => {
  let inBoxes = 0, inLoose = 0, outBoxes = 0, outLoose = 0, inPcs = 0, outPcs = 0;
  Object.values(products).forEach((p) => {
    inPcs += p.in; outPcs += p.out;
    if (p.sub && p.qpb > 0) {
      inBoxes += Math.floor(p.in / p.qpb); inLoose += p.in % p.qpb;
      outBoxes += Math.floor(p.out / p.qpb); outLoose += p.out % p.qpb;
    } else {
      inLoose += p.in; outLoose += p.out;
    }
  });
  return { inBoxes, inLoose, outBoxes, outLoose, inPcs, outPcs };
};

// Roll per-(day, product) rows into period buckets, each with aggregate box+loose.
// Newest bucket first.
const bucketize = (rows, period) => {
  const buckets = {};
  rows.forEach((r) => {
    const { key, sortKey, label, from, to } = periodKey(r.day, period);
    if (!buckets[key]) buckets[key] = { label, sortKey, from, to, prods: {} };
    const prods = buckets[key].prods;
    if (!prods[r.product_id]) prods[r.product_id] = { qpb: r.qty_per_box, sub: r.sub_unit, in: 0, out: 0 };
    prods[r.product_id].in += r.in_qty;
    prods[r.product_id].out += r.out_qty;
  });
  return Object.values(buckets)
    .map((b) => ({ label: b.label, sortKey: b.sortKey, from: b.from, to: b.to, ...cartonize(b.prods) }))
    .sort((a, b) => String(b.sortKey).localeCompare(String(a.sortKey)));
};

export default function StockMovements() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const productId = searchParams.get('product_id') || '';
  const type = searchParams.get('type') || 'all';
  const period = searchParams.get('period') || 'yearly';
  const fromDate = searchParams.get('from_date') || '';
  const toDate = searchParams.get('to_date') || '';

  const [products, setProducts] = useState([]);
  const [days, setDays] = useState([]);
  const [product, setProduct] = useState(null);
  const [totalIn, setTotalIn] = useState(0);
  const [totalOut, setTotalOut] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (msg, t = 'success') => {
    setToast({ message: msg, type: t });
    setTimeout(() => setToast(null), 3000);
  };

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

  useEffect(() => {
    api.get('/products').then((res) => setProducts(res.data)).catch(() => {});
  }, []);

  // Auto-load: fetch day/product totals whenever the data scope changes (NOT on
  // period — period is a pure client-side re-grouping of the same rows).
  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setLoading(true);
        const params = {};
        if (productId) params.product_id = productId;
        if (type !== 'all') params.movement_type = type;
        if (fromDate) params.from_date = fromDate;
        if (toDate) params.to_date = toDate;

        const res = await api.get('/inventory/movements-summary', { params });
        setDays(res.data.days);
        setProduct(res.data.product);
        setTotalIn(res.data.total_in);
        setTotalOut(res.data.total_out);
      } catch (err) {
        showToast((err.response?.data?.error?.message || err.response?.data?.error) || 'Failed to load movements', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, [productId, type, fromDate, toDate]);

  const grouped = useMemo(() => bucketize(days, period), [days, period]);

  // Aggregate box+loose across the whole loaded scope (for the cards / Total row).
  const scope = useMemo(() => {
    const prods = {};
    days.forEach((r) => {
      if (!prods[r.product_id]) prods[r.product_id] = { qpb: r.qty_per_box, sub: r.sub_unit, in: 0, out: 0 };
      prods[r.product_id].in += r.in_qty;
      prods[r.product_id].out += r.out_qty;
    });
    return cartonize(prods);
  }, [days]);

  const colHeader = COL_HEADER[period] || 'Period';

  // Render an aggregate box+loose value as "X Box + Y Pcs". Uses the product's
  // own unit names when a single product is selected, generic labels otherwise.
  const boxLabel = product?.sub_unit && product?.qty_per_box ? product.unit : null;
  const looseLabel = product
    ? (product.sub_unit && product.qty_per_box ? product.sub_unit : (product.unit || 'Pcs'))
    : 'Pcs';
  const renderQty = (boxes, loose) => {
    const parts = [];
    if (boxes > 0) parts.push(`${nf(boxes)} ${boxLabel || 'Box'}`);
    if (loose > 0 || boxes === 0) parts.push(`${nf(loose)} ${looseLabel}`);
    return parts.join(' + ');
  };

  // Balance stays a net figure: box+loose for a single product, plain pcs when mixed.
  const balancePcs = totalIn - totalOut;
  const renderBalance = () => {
    if (product?.sub_unit && product?.qty_per_box) {
      const a = Math.abs(balancePcs);
      return `${balancePcs < 0 ? '-' : ''}${renderQty(Math.floor(a / product.qty_per_box), a % product.qty_per_box)}`;
    }
    return `${nf(balancePcs)} pcs`;
  };

  // Drill down: In → Material In (Batches), Out → Material Out (Orders),
  // filtered to this bucket's date range (+ the selected product).
  const drillTo = (base, r) => {
    const params = new URLSearchParams();
    if (productId) params.set('product_id', productId);
    if (r.from) params.set('from_date', r.from);
    if (r.to) params.set('to_date', r.to);
    navigate(`${base}?${params.toString()}`);
  };

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded shadow-lg text-white ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
          {toast.message}
        </div>
      )}

      <h2 className="text-2xl font-bold text-gray-800 mb-6">Stock Movements</h2>

      {/* Type tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {[['all', 'All Movements'], ['IN', 'Material In'], ['OUT', 'Material Out']].map(([t, label]) => (
          <button
            key={t}
            onClick={() => updateParams({ type: t === 'all' ? null : t })}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              type === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div className="w-full sm:w-64">
          <label className="block text-xs font-medium text-gray-500 mb-1">Product</label>
          <SearchableSelect
            options={products.map((p) => ({ value: p.id, label: p.product_name }))}
            value={productId}
            onChange={(val) => updateParams({ product_id: val || null })}
            placeholder="All Products"
          />
        </div>

        <div className="w-full sm:w-auto">
          <label className="block text-xs font-medium text-gray-500 mb-1">Period</label>
          <select
            value={period}
            onChange={(e) => updateParams({ period: e.target.value })}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="half_yearly">Half Yearly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>

        <div className="w-full sm:w-auto">
          <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
          <DateInput
            value={fromDate}
            onChange={(e) => updateParams({ from_date: e.target.value || null })}
            className="border border-gray-300 rounded px-3 py-2 w-full sm:w-36 text-sm"
          />
        </div>
        <div className="w-full sm:w-auto">
          <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
          <DateInput
            value={toDate}
            onChange={(e) => updateParams({ to_date: e.target.value || null })}
            className="border border-gray-300 rounded px-3 py-2 w-full sm:w-36 text-sm"
          />
        </div>

        {(fromDate || toDate) && (
          <button
            onClick={() => updateParams({ from_date: null, to_date: null })}
            className="text-sm text-gray-500 hover:text-gray-700 underline self-end pb-2"
          >
            Clear dates
          </button>
        )}
      </div>

      {/* Summary cards (aggregate box + loose across the whole loaded scope) */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="bg-green-50 rounded-lg shadow px-4 py-3 min-w-[130px]">
          <p className="text-xs text-green-600">Total In</p>
          <p className="text-xl font-bold text-green-800">{renderQty(scope.inBoxes, scope.inLoose)}</p>
        </div>
        <div className="bg-red-50 rounded-lg shadow px-4 py-3 min-w-[130px]">
          <p className="text-xs text-red-600">Total Out</p>
          <p className="text-xl font-bold text-red-800">{renderQty(scope.outBoxes, scope.outLoose)}</p>
        </div>
        <div className="bg-blue-50 rounded-lg shadow px-4 py-3 min-w-[130px]">
          <p className="text-xs text-blue-600">Balance</p>
          <p className="text-xl font-bold text-blue-800">{renderBalance()}</p>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : grouped.length === 0 ? (
        <p className="text-gray-500">No movements found.</p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {grouped.map((r) => (
              <div key={r.sortKey} className="bg-white rounded-lg shadow p-3 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-800">{r.label}</span>
                <div className="flex gap-4 text-right">
                  <span
                    onClick={r.inPcs > 0 ? () => drillTo('/batches', r) : undefined}
                    className={`text-sm font-semibold ${r.inPcs > 0 ? 'text-green-700 underline' : 'text-gray-300'}`}
                  >
                    {r.inPcs > 0 ? renderQty(r.inBoxes, r.inLoose) : '—'}
                  </span>
                  <span
                    onClick={r.outPcs > 0 ? () => drillTo('/orders', r) : undefined}
                    className={`text-sm font-semibold ${r.outPcs > 0 ? 'text-red-700 underline' : 'text-gray-300'}`}
                  >
                    {r.outPcs > 0 ? renderQty(r.outBoxes, r.outLoose) : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto bg-white rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">{colHeader}</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-green-700 uppercase bg-green-50 w-52">In Qty</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-red-700 uppercase bg-red-50 w-52">Out Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {grouped.map((r) => (
                  <tr key={r.sortKey} className="hover:bg-gray-50">
                    <td className="px-5 py-2.5 text-sm font-medium text-gray-800">{r.label}</td>
                    <td
                      onClick={r.inPcs > 0 ? () => drillTo('/batches', r) : undefined}
                      title={r.inPcs > 0 ? 'View Material In for this period' : undefined}
                      className={`px-5 py-2.5 text-sm text-right font-semibold bg-green-50/50 ${r.inPcs > 0 ? 'cursor-pointer hover:bg-green-100 hover:underline' : ''}`}
                    >
                      {r.inPcs > 0 ? <span className="text-green-700">{renderQty(r.inBoxes, r.inLoose)}</span> : <span className="text-gray-200">—</span>}
                    </td>
                    <td
                      onClick={r.outPcs > 0 ? () => drillTo('/orders', r) : undefined}
                      title={r.outPcs > 0 ? 'View Material Out for this period' : undefined}
                      className={`px-5 py-2.5 text-sm text-right font-semibold bg-red-50/50 ${r.outPcs > 0 ? 'cursor-pointer hover:bg-red-100 hover:underline' : ''}`}
                    >
                      {r.outPcs > 0 ? <span className="text-red-700">{renderQty(r.outBoxes, r.outLoose)}</span> : <span className="text-gray-200">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                <tr>
                  <td className="px-5 py-3 text-sm font-bold text-gray-700 text-right">Total</td>
                  <td className="px-5 py-3 text-sm text-right font-bold text-green-700 bg-green-50">{renderQty(scope.inBoxes, scope.inLoose)}</td>
                  <td className="px-5 py-3 text-sm text-right font-bold text-red-700 bg-red-50">{renderQty(scope.outBoxes, scope.outLoose)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
