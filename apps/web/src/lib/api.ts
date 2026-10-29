import axios from 'axios';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000';

export const api = axios.create({
  baseURL: SERVER_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach JWT token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('orbit_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor to force logout if deactivated or unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== 'undefined') {
      const isDeactivated =
        error.response?.status === 403 &&
        error.response?.data?.error === 'Account is deactivated';
      const isUnauthorized = error.response?.status === 401;

      // Only redirect if not already on /login or /register
      const isAuthPage =
        window.location.pathname.startsWith('/login') ||
        window.location.pathname.startsWith('/register');

      if ((isDeactivated || isUnauthorized) && !isAuthPage) {
        localStorage.removeItem('orbit_token');
        if (isDeactivated) {
          alert('Your account has been deactivated. Please contact your administrator.');
        }
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
