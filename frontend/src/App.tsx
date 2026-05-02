import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { useAppDispatch, useAppSelector } from './features/hooks';
import { checkAuth } from './features/auth/authSlice';

// Layouts
import MainLayout from './components/layout/MainLayout';
import DashboardLayout from './components/layout/DashboardLayout';
import AuthLayout from './components/layout/AuthLayout';

// Auth Pages
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));

// Customer Pages
const Home = lazy(() => import('./pages/customer/Home'));
const MedicineList = lazy(() => import('./pages/customer/MedicineList'));
const MedicineDetail = lazy(() => import('./pages/customer/MedicineDetail'));
const Cart = lazy(() => import('./pages/customer/Cart'));
const Checkout = lazy(() => import('./pages/customer/Checkout'));
const Orders = lazy(() => import('./pages/customer/Orders'));
const OrderDetail = lazy(() => import('./pages/customer/OrderDetail'));
const Profile = lazy(() => import('./pages/customer/Profile'));
const Prescriptions = lazy(() => import('./pages/customer/Prescriptions'));
const Wallet = lazy(() => import('./pages/customer/Wallet'));

// Pharmacist Pages
const PharmacistDashboard = lazy(() => import('./pages/pharmacist/Dashboard'));
const OrderQueue = lazy(() => import('./pages/pharmacist/OrderQueue'));
const ReviewOrder = lazy(() => import('./pages/pharmacist/ReviewOrder'));

// Delivery Pages
const DeliveryDashboard = lazy(() => import('./pages/delivery/Dashboard'));
const ActiveDelivery = lazy(() => import('./pages/delivery/ActiveDelivery'));
const Earnings = lazy(() => import('./pages/delivery/Earnings'));

// Warehouse Pages
const WarehouseDashboard = lazy(() => import('./pages/warehouse/Dashboard'));
const Inventory = lazy(() => import('./pages/warehouse/Inventory'));
const PackOrders = lazy(() => import('./pages/warehouse/PackOrders'));

// Admin Pages
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const ManageUsers = lazy(() => import('./pages/admin/ManageUsers'));
const ManageMedicines = lazy(() => import('./pages/admin/ManageMedicines'));
const Analytics = lazy(() => import('./pages/admin/Analytics'));
const Settings = lazy(() => import('./pages/admin/Settings'));
const AdminOrders = lazy(() => import('./pages/admin/Orders'));

// Components
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoadingScreen from './components/common/LoadingScreen';

function App() {
  const dispatch = useAppDispatch();
  const { isLoading, isAuthenticated, user } = useAppSelector((state) => state.auth);

  useEffect(() => {
    dispatch(checkAuth());
  }, [dispatch]);

  // Apply dark mode based on system preference or user setting
  useEffect(() => {
    const darkMode = localStorage.getItem('darkMode');
    if (darkMode === 'true' || (!darkMode && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
      {/* Public Auth Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" />} />
        <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to="/dashboard" />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Route>

      {/* Public Customer Routes */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/medicines" element={<MedicineList />} />
        <Route path="/medicines/:slug" element={<MedicineDetail />} />
        <Route path="/cart" element={<Cart />} />
      </Route>

      {/* Protected Customer Routes */}
      <Route element={<ProtectedRoute allowedRoles={['customer']}><MainLayout /></ProtectedRoute>}>
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/orders/:id" element={<OrderDetail />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/prescriptions" element={<Prescriptions />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
      </Route>

      {/* Pharmacist Routes */}
      <Route element={<ProtectedRoute allowedRoles={['pharmacist', 'senior_pharmacist']}><DashboardLayout type="pharmacist" /></ProtectedRoute>}>
        <Route path="/pharmacist" element={<PharmacistDashboard />} />
        <Route path="/pharmacist/queue" element={<OrderQueue />} />
        <Route path="/pharmacist/review/:orderId" element={<ReviewOrder />} />
      </Route>

      {/* Delivery Partner Routes */}
      <Route element={<ProtectedRoute allowedRoles={['delivery_partner']}><DashboardLayout type="delivery" /></ProtectedRoute>}>
        <Route path="/delivery" element={<DeliveryDashboard />} />
        <Route path="/delivery/available" element={<DeliveryDashboard />} />
        <Route path="/delivery/history" element={<DeliveryDashboard />} />
        <Route path="/delivery/active" element={<DeliveryDashboard />} />
        <Route path="/delivery/active/:orderId" element={<ActiveDelivery />} />
        <Route path="/delivery/earnings" element={<Earnings />} />
      </Route>

      {/* Warehouse Routes */}
      <Route element={<ProtectedRoute allowedRoles={['warehouse_staff']}><DashboardLayout type="warehouse" /></ProtectedRoute>}>
        <Route path="/warehouse" element={<WarehouseDashboard />} />
        <Route path="/warehouse/inventory" element={<Inventory />} />
        <Route path="/warehouse/pack" element={<PackOrders />} />
      </Route>

      {/* Admin Routes */}
      <Route element={<ProtectedRoute allowedRoles={['admin_super', 'admin_operations', 'admin_finance', 'admin_content', 'admin_support']}><DashboardLayout type="admin" /></ProtectedRoute>}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<ManageUsers />} />
        <Route path="/admin/medicines" element={<ManageMedicines />} />
        <Route path="/admin/orders" element={<AdminOrders />} />
        <Route path="/admin/analytics" element={<Analytics />} />
        <Route path="/admin/settings" element={<Settings />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Suspense>
  );
}

export default App;
