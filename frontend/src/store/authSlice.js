import { createSlice } from '@reduxjs/toolkit';
import { setAccessToken } from '../services/api';

const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  loading: true, // Start as true during initial session check on app mount
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    loginSuccess: (state, action) => {
      state.loading = false;
      state.token = action.payload.token;
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.error = null;
      setAccessToken(action.payload.token);
    },
    loginFailure: (state, action) => {
      state.loading = false;
      state.error = action.payload;
      state.isAuthenticated = false;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.loading = false;
      state.error = null;
      setAccessToken(null);
    },
    refreshTokenSuccess: (state, action) => {
      state.token = action.payload;
      state.isAuthenticated = true;
      setAccessToken(action.payload);
    },
    enableMfaSuccess: (state) => {
      if (state.user) {
        state.user.mfaEnabled = true;
      }
    },
    clearError: (state) => {
      state.error = null;
    }
  }
});

export const {
  loginStart,
  loginSuccess,
  loginFailure,
  logout,
  refreshTokenSuccess,
  enableMfaSuccess,
  clearError
} = authSlice.actions;

export default authSlice.reducer;
