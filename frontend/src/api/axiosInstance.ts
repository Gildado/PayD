import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';

type ApiErrorPayload = {
  message?: string;
};

/**
 * Centralized Axios instance for PayD frontend.
 * Provides consistent error handling and base configuration.
 */
const axiosInstance = axios.create({
  baseURL: (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:3000',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // You can add auth tokens here if needed
    // const token = localStorage.getItem('token');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error: Error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: AxiosError) => {
    const status = error.response?.status;
    const data = error.response?.data;
    const message =
      typeof data === 'object' && data !== null && 'message' in data
        ? (data as ApiErrorPayload).message || error.message || 'An unexpected error occurred'
        : error.message || 'An unexpected error occurred';

    // Handle specific error codes
    switch (status) {
      case 401:
        console.error('Unauthorized access. Redirecting to login...');
        // Optional: Trigger logout or redirect
        break;
      case 403:
        toast.error('Permission denied. You do not have access to this resource.');
        break;
      case 404:
        console.warn('Resource not found:', error.config?.url);
        break;
      case 429:
        toast.error('Too many requests. Please try again later.');
        break;
      case 500:
        toast.error('Server error. Our team has been notified.');
        break;
      default:
        // For other errors, we might not want a toast for every single one
        // but it's good to log them
        console.error(`API Error [${status || 'Network'}]:`, message);
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
