import axios from 'axios';

/** Dev: Vite proxies /api → localhost:5000. Prod: must be https://host/api/v1 from Vercel env. */
const raw = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, '') ?? '';
const API_BASE_URL =
  raw.startsWith('https://') || raw.startsWith('http://')
    ? raw
    : import.meta.env.DEV
      ? '/api/v1'
      : raw || '/api/v1';

export { API_BASE_URL };

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send cookies
});

// Request interceptor - attach token from localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Track if we're currently refreshing to prevent multiple refresh calls
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

/** Avoid sync import of store (store → authSlice → api circular dependency). */
async function clearSessionInRedux() {
  const [{ store }, { clearAuth }] = await Promise.all([
    import('../features/store'),
    import('../features/auth/authSlice'),
  ]);
  store.dispatch(clearAuth());
}

// Response interceptor - handle 401 and refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If not 401 or already retried, reject
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Don't retry refresh or login endpoints
    if (originalRequest.url?.includes('/auth/refresh') || 
        originalRequest.url?.includes('/auth/login')) {
      return Promise.reject(error);
    }

    // If we're already refreshing, queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        throw new Error('No refresh token');
      }

      const response = await axios.post(
        `${API_BASE_URL}/auth/refresh`,
        { refreshToken },
        { withCredentials: true }
      );

      const tokens = response.data?.data?.tokens;
      const accessToken = tokens?.accessToken;
      const newRefreshToken = tokens?.refreshToken;
      if (!accessToken || typeof accessToken !== 'string') {
        return Promise.reject(new Error('Refresh response missing access token'));
      }

      localStorage.setItem('accessToken', accessToken);
      if (newRefreshToken) {
        localStorage.setItem('refreshToken', newRefreshToken);
      }

      originalRequest.headers.Authorization = `Bearer ${accessToken}`;

      processQueue(null, accessToken);

      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);

      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      await clearSessionInRedux();

      // Do not force /login: public pages (home, medicines) must work with expired tokens.
      // ProtectedRoute redirects when isAuthenticated becomes false.
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;