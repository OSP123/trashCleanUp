const DEFAULT_BASE = "/api";

export function normalizeApiBase() {
  const envBase =
    (typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env.VITE_API_BASE) ||
    DEFAULT_BASE;
  if (typeof envBase !== "string" || envBase.length === 0) {
    return DEFAULT_BASE;
  }
  if (envBase.startsWith("http://") || envBase.startsWith("https://")) {
    return envBase.replace(/\/$/, "");
  }
  if (envBase.startsWith("/")) {
    return envBase;
  }
  console.warn("Invalid VITE_API_BASE, falling back to /api");
  return DEFAULT_BASE;
}

export function createApi(fetchFn, apiBase) {
  const base = apiBase || DEFAULT_BASE;

  const request = async (path, options = {}) => {
    const response = await fetchFn(`${base}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options
    });
    const data = await response.json();
    if (!response.ok) {
      const error = data && data.error ? data.error : "request_failed";
      throw new Error(error);
    }
    return data;
  };

  return {
    health: async () => request("/health"),
    listUsers: async () => (await request("/users")).users,
    getUser: async (userId) => (await request(`/users/${userId}`)).user,
    createUser: async (payload) => (await request("/users", {
      method: "POST",
      body: JSON.stringify(payload)
    })).user,
    listPins: async (bbox) => {
      const query = bbox ? `?${new URLSearchParams(bbox).toString()}` : "";
      return (await request(`/pins${query}`)).pins;
    },
    createPin: async (payload) => (await request("/pins", {
      method: "POST",
      body: JSON.stringify(payload)
    })).pin,
    listCleanups: async (filters = {}) => {
      const query = Object.keys(filters).length
        ? `?${new URLSearchParams(filters).toString()}`
        : "";
      return (await request(`/cleanups${query}`)).cleanups;
    },
    createCleanup: async (payload) => (await request("/cleanups", {
      method: "POST",
      body: JSON.stringify(payload)
    })).cleanup,
    voteCleanup: async (cleanupId, payload) => {
      const response = await request(`/cleanups/${cleanupId}/votes`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      return response.cleanup;
    },
    listCollections: async (userId) => (await request(`/collections/${userId}`)).collections,
    listTerritories: async () => request("/territories"),
    createTerritory: async (payload) => (await request("/territories", {
      method: "POST",
      body: JSON.stringify(payload)
    })).territory,
    claimTerritory: async (territoryId, payload) => (await request(`/territories/${territoryId}/claim`, {
      method: "POST",
      body: JSON.stringify(payload)
    })).claim,
    createRaid: async (payload) => (await request("/raids", {
      method: "POST",
      body: JSON.stringify(payload)
    })).raid
  };
}
