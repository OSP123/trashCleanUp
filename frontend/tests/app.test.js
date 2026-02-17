import { describe, expect, test, vi } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/svelte";
import App from "../src/App.svelte";

function buildFetchMock() {
  return vi.fn(async (url, options = {}) => {
    if (url.endsWith("/health")) {
      return { ok: true, json: async () => ({ ok: true }) };
    }
    if (url.endsWith("/users") && (!options.method || options.method === "GET")) {
      return {
        ok: true,
        json: async () => ({
          users: [{ id: "user-1", username: "eco", level: 2, xp: 120, currency: 40 }]
        })
      };
    }
    if (url.includes("/users/user-1")) {
      return {
        ok: true,
        json: async () => ({
          user: { id: "user-1", username: "eco", level: 2, xp: 120, currency: 40 }
        })
      };
    }
    if (url.startsWith("/api/pins")) {
      return {
        ok: true,
        json: async () => ({
          pins: [
            {
              id: "pin-1",
              severity: "yellow",
              status: "dirty",
              hazardStatus: "clear",
              location: { lat: 10, lng: 10 }
            }
          ]
        })
      };
    }
    if (url.startsWith("/api/cleanups?cleanerId=user-1")) {
      return {
        ok: true,
        json: async () => ({
          cleanups: [
            {
              id: "cleanup-1",
              pinId: "pin-1",
              aiScore: 0.6,
              status: "pending",
              createdAt: new Date().toISOString()
            }
          ]
        })
      };
    }
    if (url.startsWith("/api/cleanups")) {
      return { ok: true, json: async () => ({ cleanups: [] }) };
    }
    if (url.startsWith("/api/collections/user-1")) {
      return {
        ok: true,
        json: async () => ({
          collections: [
            {
              trashTypeName: "Plastic",
              trashTypeCode: "plastic",
              count: 2
            }
          ]
        })
      };
    }
    return { ok: false, json: async () => ({ error: "not_found" }) };
  });
}

describe("frontend app", () => {
  test("loads users and sets active user from dropdown", async () => {
    const fetchMock = buildFetchMock();
    const { getByTestId, getByText } = render(App, {
      props: { fetchOverride: fetchMock, mapEnabled: false }
    });
    await fireEvent.click(getByText("Load Users"));
    const select = getByTestId("user-select");
    await waitFor(() => {
      expect(select.options.length).toBeGreaterThan(1);
    });
    await fireEvent.change(select, { target: { value: "user-1" } });
    expect(getByTestId("active-user").textContent).toContain("eco");
    expect(getByTestId("user-progress").textContent).toContain("XP");
  });

  test("clicking a pin fills cleanup pin id", async () => {
    const fetchMock = buildFetchMock();
    const { getByTestId, getAllByTestId, findByTestId, getAllByText } = render(App, {
      props: { fetchOverride: fetchMock, mapEnabled: false }
    });
    await fireEvent.click(getAllByText("Refresh Pins")[0]);
    const pinItem = await findByTestId("pin-item-pin-1", {}, { timeout: 2000 });
    await fireEvent.click(pinItem);
    const pinInput = getAllByTestId("cleanup-pin-id")[0];
    expect(pinInput.value).toBe("pin-1");
  });
});
