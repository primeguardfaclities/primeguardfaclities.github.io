function getApiBaseUrl() {
  const configuredBaseUrl = window.PRIME_GUARD_CONFIG && typeof window.PRIME_GUARD_CONFIG.apiBaseUrl === "string"
    ? window.PRIME_GUARD_CONFIG.apiBaseUrl.trim()
    : "";

  const baseUrl = configuredBaseUrl || window.location.origin;
  return baseUrl.replace(/\/+$/, "");
}

window.PrimeGuardApi = {
  async request(path, options = {}) {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      headers: {
        "Content-Type": "application/json"
      },
      ...options
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "Request failed.");
    }
    return payload;
  },

  loginAdmin(username, password) {
    return this.request("/api/auth/admin-login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
  },

  loginManager(username, password) {
    return this.request("/api/auth/manager-login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
  },

  loginEmployee(username, password) {
    return this.request("/api/auth/employee-login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
  },

  getEmployees() {
    return this.request("/api/employees");
  },

  createEmployee(data) {
    return this.request("/api/employees", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  updateEmployee(employeeId, data) {
    return this.request(`/api/employees/${encodeURIComponent(employeeId)}`, {
      method: "PUT",
      body: JSON.stringify(data)
    });
  },

  deleteEmployee(employeeId) {
    return this.request(`/api/employees/${encodeURIComponent(employeeId)}`, {
      method: "DELETE"
    });
  },

  getAttendance(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return this.request(`/api/attendance${suffix}`);
  },

  saveAttendance(data) {
    return this.request("/api/attendance", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  updateAttendance(employeeId, date, data) {
    return this.request(`/api/attendance/${encodeURIComponent(employeeId)}/${encodeURIComponent(date)}`, {
      method: "PUT",
      body: JSON.stringify(data)
    });
  },

  deleteAttendance(employeeId, date) {
    return this.request(`/api/attendance/${encodeURIComponent(employeeId)}/${encodeURIComponent(date)}`, {
      method: "DELETE"
    });
  }
};
