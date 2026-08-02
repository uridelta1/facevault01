import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api'
});

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('fv_token', token);
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    localStorage.removeItem('fv_token');
    delete api.defaults.headers.common.Authorization;
  }
}

const existing = localStorage.getItem('fv_token');
if (existing) api.defaults.headers.common.Authorization = `Bearer ${existing}`;

export default api;
