import axios from 'axios';

// L'adresse de votre Backend FastAPI
// L'adresse de votre Backend FastAPI (dynamique pour supporter le réseau local)
const API_URL = `http://${window.location.hostname}:8000/api/v1`;

const api = axios.create({
  baseURL: API_URL,
  // ON RETIRE 'headers' ICI. Laissez Axios décider du Content-Type.
});

// Intercepteur : Ajoute le token automatiquement à chaque requête si on est connecté
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authApi = {
  login: (data: FormData) => api.post('/auth/login', data),
  signup: (data: any) => api.post('/auth/signup', data),
};

export const chatApi = {
  getHistory: () => api.get('/chat/history'),
  query: (question: string) => api.post('/chat/query', { question }),
};

export const documentApi = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

export default api;