import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCartIcon,
  UserIcon,
  MagnifyingGlassIcon,
  Bars3Icon,
  XMarkIcon,
  SunIcon,
  MoonIcon,
} from '@heroicons/react/24/outline';
import { useAppSelector, useAppDispatch } from '../../features/hooks';
import { logout } from '../../features/auth/authSlice';
import api from '../../services/api';

interface SearchSuggestion {
  id: string;
  name: string;
  genericName?: string;
  slug?: string;
  category?: string;
}

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestion[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  const { items } = useAppSelector((state) => state.cart);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const cartItemCount = items?.length || 0;

  const closeSearch = () => {
    setIsSearchOpen(false);
    setSearchQuery('');
    setSearchSuggestions([]);
    setSearchLoading(false);
    setActiveSuggestionIndex(-1);
  };

  const toggleDarkMode = () => {
    document.documentElement.classList.toggle('dark');
    setIsDark(!isDark);
    localStorage.setItem('darkMode', (!isDark).toString());
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      activeSuggestionIndex >= 0 &&
      activeSuggestionIndex < scoredSuggestions.length
    ) {
      goToSuggestion(scoredSuggestions[activeSuggestionIndex]);
      return;
    }
    if (searchQuery.trim()) {
      navigate(`/medicines?search=${encodeURIComponent(searchQuery)}`);
      closeSearch();
    }
  };

  useEffect(() => {
    if (!isSearchOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeSearch();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSearchOpen]);

  useEffect(() => {
    if (!isSearchOpen) return;
    const query = searchQuery.trim();
    if (!query) {
      setSearchSuggestions([]);
      setSearchLoading(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        setSearchLoading(true);
        const response = await api.get(`/medicines?search=${encodeURIComponent(query)}&limit=8`);
        const medicines = response.data?.data?.medicines || [];
        const normalized: SearchSuggestion[] = medicines.map((medicine: any) => ({
          id: medicine.id,
          name: medicine.name,
          genericName: medicine.genericName,
          slug: medicine.slug,
          category: medicine.category,
        }));
        setSearchSuggestions(normalized);
      } catch {
        setSearchSuggestions([]);
      } finally {
        setSearchLoading(false);
      }
    }, 180);

    return () => window.clearTimeout(timer);
  }, [isSearchOpen, searchQuery]);

  const scoredSuggestions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];

    const scoreFor = (suggestion: SearchSuggestion) => {
      const name = (suggestion.name || '').toLowerCase();
      const generic = (suggestion.genericName || '').toLowerCase();
      if (name === query || generic === query) return 120;
      if (name.startsWith(query) || generic.startsWith(query)) return 90;
      if (name.includes(query) || generic.includes(query)) return 70;
      if (query.length === 1 && (name.includes(query) || generic.includes(query))) return 55;
      return 0;
    };

    return [...searchSuggestions]
      .map((suggestion) => ({ suggestion, score: scoreFor(suggestion) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((entry) => entry.suggestion);
  }, [searchQuery, searchSuggestions]);

  useEffect(() => {
    if (!searchQuery.trim() || scoredSuggestions.length === 0) {
      setActiveSuggestionIndex(-1);
      return;
    }
    if (activeSuggestionIndex >= scoredSuggestions.length) {
      setActiveSuggestionIndex(0);
    }
  }, [searchQuery, scoredSuggestions, activeSuggestionIndex]);

  const goToSuggestion = (suggestion: SearchSuggestion) => {
    if (suggestion.slug) {
      navigate(`/medicines/${suggestion.slug}`);
    } else {
      navigate(`/medicines?search=${encodeURIComponent(suggestion.name)}`);
    }
    closeSearch();
  };

  const handleSearchInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!searchQuery.trim() || scoredSuggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSuggestionIndex((prev) => {
        if (prev < 0) return 0;
        return prev === scoredSuggestions.length - 1 ? 0 : prev + 1;
      });
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestionIndex((prev) => {
        if (prev < 0) return scoredSuggestions.length - 1;
        return prev === 0 ? scoredSuggestions.length - 1 : prev - 1;
      });
      return;
    }

    if (event.key === 'Tab' && activeSuggestionIndex >= 0) {
      event.preventDefault();
      goToSuggestion(scoredSuggestions[activeSuggestionIndex]);
    }
  };

  const handleLogout = async () => {
    await dispatch(logout());
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 glass border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <svg className="h-8 w-8" viewBox="0 0 40 40">
              <defs>
                <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0066FF" />
                  <stop offset="100%" stopColor="#00D4AA" />
                </linearGradient>
              </defs>
              <circle cx="20" cy="20" r="18" fill="url(#logo-gradient)" />
              <path d="M14 20h12M20 14v12" stroke="white" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <span className="font-display font-bold text-xl text-gradient">JetMed</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {isAuthenticated && (
              <Link to="/orders" className="text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition">
                Orders
              </Link>
            )}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center space-x-4">
            {/* Search */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition"
            >
              <MagnifyingGlassIcon className="h-5 w-5" />
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition"
            >
              {isDark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
            </button>

            {/* Cart */}
            <Link to="/cart" className="relative p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition">
              <ShoppingCartIcon className="h-5 w-5" />
              {cartItemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">
                  {cartItemCount}
                </span>
              )}
            </Link>

            {/* User Menu */}
            {isAuthenticated ? (
              <div className="relative group">
                <button className="flex items-center space-x-2 p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition">
                  <UserIcon className="h-5 w-5" />
                </button>
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                  <div className="min-w-0 p-3 border-b border-gray-200 dark:border-gray-700">
                    <p className="truncate font-medium text-gray-900 dark:text-white">
                      {user?.profile?.firstName} {user?.profile?.lastName}
                    </p>
                    <p className="truncate text-sm text-gray-500 dark:text-gray-400" title={user?.email || ''}>
                      {user?.email}
                    </p>
                  </div>
                  <div className="p-2">
                    <Link to="/orders" className="block px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Orders</Link>
                    <Link to="/prescriptions" className="block px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Prescriptions</Link>
                    <Link to="/profile" className="block px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Profile</Link>
                    <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">Logout</button>
                  </div>
                </div>
              </div>
            ) : (
              <Link to="/login" className="btn-primary btn-sm">
                Sign In
              </Link>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 text-gray-600 dark:text-gray-300"
            >
              {isMenuOpen ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
          >
            <nav className="px-4 py-4 space-y-2">
              {isAuthenticated && (
                <Link onClick={() => setIsMenuOpen(false)} to="/orders" className="block px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">My Orders</Link>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Modal */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20"
            onClick={closeSearch}
          >
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-2xl mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
                <form onSubmit={handleSearch} className="relative border-b border-gray-100 dark:border-gray-700">
                  <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setActiveSuggestionIndex(-1);
                    }}
                    onKeyDown={handleSearchInputKeyDown}
                    placeholder="Search medicines, brands, conditions..."
                    className="w-full rounded-t-2xl bg-transparent py-4 pl-12 pr-24 text-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSearchSuggestions([]);
                        setActiveSuggestionIndex(-1);
                      }}
                      className="absolute right-12 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                      aria-label="Clear search"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closeSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    aria-label="Close search"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </form>

                <div className="max-h-80 overflow-y-auto p-2">
                  {!searchQuery ? (
                    <p className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                      Start typing to search medicines.
                    </p>
                  ) : searchLoading ? (
                    <p className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">Searching...</p>
                  ) : scoredSuggestions.length === 0 ? (
                    <button
                      onClick={() => {
                        navigate(`/medicines?search=${encodeURIComponent(searchQuery)}`);
                        closeSearch();
                      }}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      Search for "{searchQuery}"
                    </button>
                  ) : (
                    scoredSuggestions.map((suggestion, index) => (
                      <button
                        key={suggestion.id}
                        onClick={() => goToSuggestion(suggestion)}
                        onMouseEnter={() => setActiveSuggestionIndex(index)}
                        className={`w-full rounded-lg px-3 py-2 text-left ${
                          activeSuggestionIndex === index
                            ? 'bg-primary-50 dark:bg-primary-900/20'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{suggestion.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {suggestion.genericName || suggestion.category || 'Medicine'}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
