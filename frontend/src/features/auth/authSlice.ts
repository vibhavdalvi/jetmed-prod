import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../services/api';

interface User {
  id: string;
  email: string;
  role: string;
  profile?: {
    firstName: string;
    lastName: string;
    avatar?: string;
  };
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

// Check if user is authenticated on app load
export const checkAuth = createAsyncThunk('auth/checkAuth', async (_, { rejectWithValue }) => {
  try {
    // Only check if we have a token
    const token = localStorage.getItem('accessToken');
    if (!token) {
      return rejectWithValue('No token');
    }
    
    const response = await api.get('/auth/me');
    return response.data.data.user;
  } catch (error: any) {
    // Don't clear tokens here - the API interceptor will handle refresh
    return rejectWithValue(error.response?.data?.message || 'Authentication failed');
  }
});

// Login
export const login = createAsyncThunk(
  'auth/login',
  async (credentials: { email: string; password: string; rememberMe?: boolean }, { rejectWithValue }) => {
    try {
      const response = await api.post('/auth/login', credentials);
      const { user, tokens } = response.data.data;
      
      // Save BOTH tokens to localStorage
      if (tokens?.accessToken) {
        localStorage.setItem('accessToken', tokens.accessToken);
      }
      if (tokens?.refreshToken) {
        localStorage.setItem('refreshToken', tokens.refreshToken);
      }
      
      return { user, tokens };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Login failed');
    }
  }
);

// Register
export const register = createAsyncThunk(
  'auth/register',
  async (data: { email: string; password: string; firstName: string; lastName: string; phone?: string }, { rejectWithValue }) => {
    try {
      const response = await api.post('/auth/register', data);
      const { user, tokens } = response.data.data;
      
      // Save BOTH tokens to localStorage
      if (tokens?.accessToken) {
        localStorage.setItem('accessToken', tokens.accessToken);
      }
      if (tokens?.refreshToken) {
        localStorage.setItem('refreshToken', tokens.refreshToken);
      }
      
      return { user, tokens };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Registration failed');
    }
  }
);

// Logout
export const logout = createAsyncThunk('auth/logout', async (_, { rejectWithValue }) => {
  try {
    await api.post('/auth/logout');
  } catch (error: any) {
    // Continue with logout even if API call fails
    console.error('Logout API error:', error);
  } finally {
    // Always clear tokens
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }
  return null;
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    clearAuth: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.error = null;
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    },
  },
  extraReducers: (builder) => {
    builder
      // Check Auth
      .addCase(checkAuth.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(checkAuth.fulfilled, (state, action) => {
        state.user = action.payload;
        state.isAuthenticated = true;
        state.isLoading = false;
        state.error = null;
      })
      .addCase(checkAuth.rejected, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.isLoading = false;
        // Don't set error for checkAuth failures (normal for logged out users)
      })
      // Login
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.isLoading = false;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Register
      .addCase(register.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.isLoading = false;
        state.error = null;
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Logout
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.isLoading = false;
      })
      .addCase(logout.rejected, (state) => {
        // Still clear auth state even if logout API fails
        state.user = null;
        state.isAuthenticated = false;
        state.isLoading = false;
      });
  },
});

export const { setUser, clearError, clearAuth } = authSlice.actions;
export default authSlice.reducer;