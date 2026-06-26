const BASE_URL = "/api";

// Helper to extract JWT token
const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Generic request helper
async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  
  const headers = {
    ...getAuthHeaders(),
    ...options.headers,
  };
  
  const config = {
    ...options,
    headers,
  };
  
  // Set JSON content-type if body is JSON
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    config.body = JSON.stringify(options.body);
  }
  
  const response = await fetch(url, config);
  
  if (!response.ok) {
    let errorDetail = "API Request failed";
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.detail || errorDetail;
    } catch (e) {
      // Not a JSON response
    }
    throw new Error(errorDetail);
  }
  
  return response.json();
}

export const api = {
  auth: {
    login: (username, password) => 
      request("/auth/login", {
        method: "POST",
        body: { username, password },
      }),
      
    signup: (username, password, role = "user") => 
      request("/auth/signup", {
        method: "POST",
        body: { username, password, role },
      }),
      
    me: () => request("/auth/me"),
  },
  
  dashboard: {
    getStats: () => request("/dashboard/stats"),
  },
  
  predictions: {
    predict: (data) => 
      request("/predictions/predict", {
        method: "POST",
        body: data,
      }),
      
    getHistory: () => request("/predictions/history"),
  },
  
  dataset: {
    upload: (file) => {
      const formData = new FormData();
      formData.append("file", file);
      
      return request("/dataset/upload", {
        method: "POST",
        body: formData,
        // Let fetch set boundary headers automatically for FormData
      });
    },
    
    getStatus: () => request("/dataset/status"),
    
    preprocess: () => 
      request("/dataset/preprocess", {
        method: "POST",
      }),
      
    getEda: () => request("/dataset/eda"),
    
    getFeatures: () => request("/dataset/features"),
    
    getColumnMap: () => request("/dataset/column-map"),
    
    getKaggleSamples: () => request("/dataset/kaggle-samples"),
  },
  
  model: {
    train: (selectedFeatures = null) => 
      request("/model/train", {
        method: "POST",
        body: { selected_features: selectedFeatures },
      }),
      
    getComparisons: () => request("/model/comparison"),
  },
};
