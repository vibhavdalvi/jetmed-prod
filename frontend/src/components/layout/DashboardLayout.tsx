import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  HomeIcon,
  ClipboardDocumentListIcon,
  UserGroupIcon,
  CubeIcon,
  TruckIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  CurrencyDollarIcon,
  BeakerIcon,
  ArchiveBoxIcon,
  BuildingStorefrontIcon,
} from '@heroicons/react/24/outline';
import { useAppDispatch, useAppSelector } from '../../features/hooks';
import { logout } from '../../features/auth/authSlice';

interface DashboardLayoutProps {
  type: 'pharmacist' | 'delivery' | 'warehouse' | 'admin';
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

const navigationConfig: Record<string, NavItem[]> = {
  admin: [
    { name: 'Dashboard', href: '/admin', icon: HomeIcon },
    { name: 'Users', href: '/admin/users', icon: UserGroupIcon },
    { name: 'Medicines', href: '/admin/medicines', icon: BeakerIcon },
    { name: 'Orders', href: '/admin/orders', icon: ClipboardDocumentListIcon },
    { name: 'Analytics', href: '/admin/analytics', icon: ChartBarIcon },
    { name: 'Settings', href: '/admin/settings', icon: Cog6ToothIcon },
  ],
  pharmacist: [
    { name: 'Dashboard', href: '/pharmacist', icon: HomeIcon },
    { name: 'Review queue', href: '/pharmacist/queue', icon: ClipboardDocumentListIcon },
  ],
  delivery: [
    { name: 'Dashboard', href: '/delivery', icon: HomeIcon },
    { name: 'Available Orders', href: '/delivery/available', icon: CubeIcon },
    { name: 'My Deliveries', href: '/delivery', icon: TruckIcon },
    { name: 'Earnings', href: '/delivery/earnings', icon: CurrencyDollarIcon },
    { name: 'History', href: '/delivery/history', icon: ClipboardDocumentListIcon },
  ],
  warehouse: [
    { name: 'Dashboard', href: '/warehouse', icon: HomeIcon },
    { name: 'Pack Orders', href: '/warehouse/pack', icon: ArchiveBoxIcon },
    { name: 'Inventory', href: '/warehouse/inventory', icon: CubeIcon },
  ],
};

const dashboardTitles: Record<string, string> = {
  admin: 'Admin Portal',
  pharmacist: 'Pharmacist Portal',
  delivery: 'Delivery Portal',
  warehouse: 'Warehouse Portal',
};

const dashboardColors: Record<string, string> = {
  admin: 'from-purple-600 to-indigo-600',
  pharmacist: 'from-teal-600 to-cyan-600',
  delivery: 'from-orange-500 to-amber-500',
  warehouse: 'from-blue-600 to-sky-500',
};

export default function DashboardLayout({ type }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  const navigation = navigationConfig[type] || [];
  const title = dashboardTitles[type] || 'Dashboard';
  const gradientColor = dashboardColors[type] || 'from-gray-600 to-gray-700';

  const handleLogout = async () => {
    await dispatch(logout());
    navigate('/login');
  };

  const isNavActive = (item: NavItem) => {
    const path = location.pathname;
    if (type === 'pharmacist') {
      if (item.href === '/pharmacist') return path === '/pharmacist';
      if (item.href === '/pharmacist/queue') {
        return path === '/pharmacist/queue' || path.startsWith('/pharmacist/review/');
      }
    }
    if (item.href === `/${type}`) {
      return path === item.href;
    }
    return path.startsWith(item.href);
  };

  const pageTitle = (() => {
    if (type === 'pharmacist' && location.pathname.startsWith('/pharmacist/review')) {
      return 'Review order';
    }
    const match = navigation.find((n) => isNavActive(n));
    return match?.name || 'Dashboard';
  })();

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo Header */}
          <div className={`p-4 bg-gradient-to-r ${gradientColor}`}>
            <div className="flex items-center justify-between">
              <Link to="/" className="flex items-center gap-2">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <BuildingStorefrontIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-white font-bold text-lg">JetMed</h1>
                  <p className="text-white/70 text-xs">{title}</p>
                </div>
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden text-white/80 hover:text-white"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const active = isNavActive(item);
              return (
                <Link
                  key={`${item.href}-${item.name}`}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                    active
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <item.icon className={`w-5 h-5 ${active ? 'text-primary-600 dark:text-primary-400' : ''}`} />
                  <span>{item.name}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User Profile & Logout */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            {/* Quick Stats */}
            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Logged in as</p>
              <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                {user?.profile?.firstName} {user?.profile?.lastName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="lg:pl-64">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Bars3Icon className="w-6 h-6" />
            </button>

            <div className="min-w-0 flex-1 px-2 lg:flex-none lg:px-0">
              <h2 className="truncate text-center text-base font-semibold text-gray-900 dark:text-white lg:text-left lg:text-lg">
                {pageTitle}
              </h2>
            </div>

            {/* Right side actions */}
            <div className="flex items-center gap-3">
              {/* Notifications placeholder */}
              <button className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 relative">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>

              {/* User Avatar */}
              <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-gray-200 dark:border-gray-700">
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {user?.profile?.firstName?.[0]}{user?.profile?.lastName?.[0]}
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {user?.profile?.firstName}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}