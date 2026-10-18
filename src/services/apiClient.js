const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost/zenbet/backend';
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

    const response = await fetch(API_BASE_URL + endpoint, { ...options, headers });

    if (!response.ok) {
      const error = new Error('API Error: ' + response.status);
      error.status = response.status;
      throw error;
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return response.json();
    }
    return response.text();
  },
};

export default apiClient;
