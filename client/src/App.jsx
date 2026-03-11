import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
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
              <Route path="/" element={<Dashboard />} />
              <Route path="/products" element={<Products />} />
              <Route path="/products/new" element={<ProductForm />} />
              <Route path="/products/:id/edit" element={<ProductForm />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/customers/new" element={<CustomerForm />} />
              <Route path="/customers/:id/edit" element={<CustomerForm />} />
              <Route path="/batches" element={<Batches />} />
              <Route path="/batches/view" element={<MaterialInDetail />} />
              <Route path="/batches/new" element={<BatchForm />} />
              <Route path="/batches/stock-entries/:id/edit" element={<StockEntryEdit />} />
              <Route path="/orders/new" element={<OrderForm />} />
              <Route path="/orders/:id/edit" element={<OrderForm />} />
              <Route path="/orders/:id" element={<OrderDetail />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/stock-movements" element={<StockMovements />} />
              <Route path="/stock-report" element={<StockReport />} />
              <Route path="/product-report" element={<ProductReport />} />
              <Route path="/product-report/:id" element={<ProductMovementDetail />} />

              {/* Admin-only route */}
              <Route element={<ProtectedRoute roles={['admin']} />}>
                <Route path="/users" element={<UserManagement />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
