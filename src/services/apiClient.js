const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const apiClient = {
  async get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  },
  async post(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) });
  },
  async put(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) });
  },
  async delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  },
  async request(endpoint, options = {}) {
    const token = localStorage.getItem('zenbet_token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...options.headers,
    };

    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const response = await fetch(`${API_BASE_URL}${cleanEndpoint}`, { ...options, headers });

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const payload = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      const errorMessage = (typeof payload === 'object' && payload?.message)
        ? payload.message
        : `API Error: ${response.status}`;
      const error = new Error(errorMessage);
      error.status = response.status;
      error.data = payload;
      throw error;
    }

    return payload;
  },
};

export default apiClient;
