const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const errorHandler = require('./middleware/errorHandler');
const { authenticate, requireRole, requireCapability } = require('./middleware/auth');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');
const customerRoutes = require('./routes/customerRoutes');
const batchRoutes = require('./routes/batchRoutes');
const orderRoutes = require('./routes/orderRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const roleRoutes = require('./routes/roleRoutes');
const unitRoutes = require('./routes/unitRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check (no auth)
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Auth routes (no auth required)
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/users', userRoutes);
app.use('/api/products', authenticate, productRoutes);
app.use('/api/customers', authenticate, customerRoutes);
app.use('/api/batches', authenticate, requireCapability('material_in'), batchRoutes);
app.use('/api/orders', authenticate, requireCapability('material_out'), orderRoutes);
app.use('/api/categories', authenticate, categoryRoutes);
app.use('/api/inventory', authenticate, inventoryRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/units', authenticate, unitRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Error handler (must be last)
app.use(errorHandler);

// Hold order expiry scheduler — runs every hour
const { expireHolds } = require('./controllers/orderController');
expireHolds();
setInterval(expireHolds, 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
