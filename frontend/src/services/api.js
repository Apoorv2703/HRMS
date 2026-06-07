import axios from 'axios';

let accessToken = null;
let storeInstance = null;

export const setAccessToken = (token) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

export const injectStore = (store) => {
  storeInstance = store;
};

// Check if running on localhost to toggle between local API and Render API
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export const BASE_BACKEND_URL = isLocalhost 
  ? 'http://localhost:5000' 
  : 'https://hrms-2-cqdz.onrender.com';

const api = axios.create({
  baseURL: `${BASE_BACKEND_URL}/api/v1`,
  withCredentials: true, // Crucial to send HttpOnly refresh token cookie
});

// Request Interceptor: Attach access token
api.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers['Authorization'] = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let refreshTokenPromise = null;

// Response Interceptor: Handle token expiration and auto-refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Check if error is 401, token is expired, and we haven't retried this request yet
    if (
      error.response &&
      error.response.status === 401 &&
      error.response.data.code === 'TOKEN_EXPIRED' &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;
      try {
        if (!refreshTokenPromise) {
          refreshTokenPromise = axios.post(
            `${BASE_BACKEND_URL}/api/v1/auth/refresh-token`,
            {},
            { withCredentials: true }
          ).then((response) => {
            refreshTokenPromise = null;
            return response.data.token;
          }).catch((err) => {
            refreshTokenPromise = null;
            throw err;
          });
        }

        const newToken = await refreshTokenPromise;
        setAccessToken(newToken);
        
        // Update store state if store instance is injected
        if (storeInstance) {
          storeInstance.dispatch({
            type: 'auth/refreshTokenSuccess',
            payload: newToken
          });
        }
        
        // Retry original request with new token
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        console.error('Session refresh failed. User must log in again:', refreshError);
        
        // Clear tokens and dispatch logout if session refresh fails
        setAccessToken(null);
        if (storeInstance) {
          storeInstance.dispatch({ type: 'auth/logout' });
        }
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
