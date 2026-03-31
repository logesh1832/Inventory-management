import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import ProductForm from './pages/ProductForm';
import Customers from './pages/Customers';
import CustomerForm from './pages/CustomerForm';
import Batches from './pages/Batches';
import BatchForm from './pages/BatchForm';
import StockEntryEdit from './pages/StockEntryEdit';
import Orders from './pages/Orders';
import OrderForm from './pages/OrderForm';
import OrderDetail from './pages/OrderDetail';
import Categories from './pages/Categories';
import MaterialInDetail from './pages/MaterialInDetail';
import StockReport from './pages/StockReport';
import StockMovements from './pages/StockMovements';
import ProductReport from './pages/ProductReport';
import ProductMovementDetail from './pages/ProductMovementDetail';
import UserManagement from './pages/UserManagement';
import RoleManagement from './pages/RoleManagement';
import UnitManagement from './pages/UnitManagement';
import Organizations from './pages/Organizations';
import Customization from './pages/Customization';

// Guard: super admin only
function SuperAdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user || !user.is_super_admin) return <Navigate to="/" replace />;
  return children;
}

// Guard: org users only (not super admin)
function OrgRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.is_super_admin) return <Navigate to="/orgs" replace />;
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public route */}
          <Route path="/login" element={<Login />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              {/* Super admin routes */}
              <Route path="/orgs" element={<SuperAdminRoute><Organizations /></SuperAdminRoute>} />

              {/* Org user routes */}
              <Route path="/" element={<Dashboard />} />
              <Route path="/products" element={<OrgRoute><Products /></OrgRoute>} />
              <Route path="/products/new" element={<OrgRoute><ProductForm /></OrgRoute>} />
              <Route path="/products/:id/edit" element={<OrgRoute><ProductForm /></OrgRoute>} />
              <Route path="/categories" element={<OrgRoute><Categories /></OrgRoute>} />
              <Route path="/customers" element={<OrgRoute><Customers /></OrgRoute>} />
              <Route path="/customers/new" element={<OrgRoute><CustomerForm /></OrgRoute>} />
              <Route path="/customers/:id/edit" element={<OrgRoute><CustomerForm /></OrgRoute>} />
              <Route path="/batches" element={<OrgRoute><Batches /></OrgRoute>} />
              <Route path="/batches/view" element={<OrgRoute><MaterialInDetail /></OrgRoute>} />
              <Route path="/batches/new" element={<OrgRoute><BatchForm /></OrgRoute>} />
              <Route path="/batches/stock-entries/:id/edit" element={<OrgRoute><StockEntryEdit /></OrgRoute>} />
              <Route path="/orders/new" element={<OrgRoute><OrderForm /></OrgRoute>} />
              <Route path="/orders/:id/edit" element={<OrgRoute><OrderForm /></OrgRoute>} />
              <Route path="/orders/:id" element={<OrgRoute><OrderDetail /></OrgRoute>} />
              <Route path="/orders" element={<OrgRoute><Orders /></OrgRoute>} />
              <Route path="/stock-movements" element={<OrgRoute><StockMovements /></OrgRoute>} />
              <Route path="/stock-report" element={<OrgRoute><StockReport /></OrgRoute>} />
              <Route path="/product-report" element={<OrgRoute><ProductReport /></OrgRoute>} />
              <Route path="/product-report/:id" element={<OrgRoute><ProductMovementDetail /></OrgRoute>} />
              <Route path="/users" element={<OrgRoute><UserManagement /></OrgRoute>} />
              <Route path="/roles" element={<OrgRoute><RoleManagement /></OrgRoute>} />
              <Route path="/units" element={<OrgRoute><UnitManagement /></OrgRoute>} />
              <Route path="/customization" element={<OrgRoute><Customization /></OrgRoute>} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
