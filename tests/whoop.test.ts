import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const kv = vi.hoisted(() => ({
  loadRefreshToken: vi.fn(),
  saveRefreshToken: vi.fn(),
}));

vi.mock("../src/lib/kv", () => kv);

import { refreshAccessToken } from "../src/lib/whoop";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("refreshAccessToken", () => {
  it("retries saving a rotated refresh token before completing", async () => {
    vi.useFakeTimers();
    kv.loadRefreshToken.mockResolvedValue("old-refresh");
    kv.saveRefreshToken
      .mockRejectedValueOnce(new Error("redis down 1"))
      .mockRejectedValueOnce(new Error("redis down 2"))
      .mockResolvedValueOnce(undefined);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: "new-access",
          refresh_token: "new-refresh",
          expires_in: 3600,
        }),
      }),
    );

    const result = refreshAccessToken();
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(400);

    await expect(result).resolves.toBe("new-access");
    expect(kv.saveRefreshToken).toHaveBeenCalledTimes(3);
    expect(kv.saveRefreshToken).toHaveBeenNthCalledWith(1, "new-refresh");
    expect(kv.saveRefreshToken).toHaveBeenNthCalledWith(2, "new-refresh");
    expect(kv.saveRefreshToken).toHaveBeenNthCalledWith(3, "new-refresh");
  });
});
