import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const kv = vi.hoisted(() => ({
  loadRefreshToken: vi.fn(),
  saveRefreshToken: vi.fn(),
}));

vi.mock("../src/lib/kv", () => kv);

import {
  fetchLatestRecovery,
  fetchTodaysBiometrics,
  refreshAccessToken,
} from "../src/lib/whoop";

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

describe("fetchLatestRecovery", () => {
  it("returns null when the cycle lookup only returns yesterday", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-26T10:00:00.000Z"));

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        records: [
          {
            id: 123,
            start: "2026-04-25T07:00:00.000Z",
            score_state: "SCORED",
            score: {
              strain: 7,
              kilojoule: 1200,
              average_heart_rate: 68,
              max_heart_rate: 130,
            },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchLatestRecovery("access-token")).resolves.toBeNull();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/cycle?");
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "start=2026-04-26T00%3A00%3A00.000Z",
    );
  });
});

describe("fetchTodaysBiometrics", () => {
  it("does not use yesterday's cycle or recovery as today's snapshot", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-26T10:00:00.000Z"));

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/cycle?")) {
        return {
          ok: true,
          json: vi.fn().mockResolvedValue({
            records: [
              {
                id: 123,
                start: "2026-04-25T07:00:00.000Z",
                score_state: "SCORED",
                score: {
                  strain: 7,
                  kilojoule: 1200,
                  average_heart_rate: 68,
                  max_heart_rate: 130,
                },
              },
            ],
          }),
        };
      }
      if (
        url.includes("/activity/sleep?limit=1") ||
        url.includes("/activity/workout?limit=1")
      ) {
        return {
          ok: true,
          json: vi.fn().mockResolvedValue({ records: [] }),
        };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const snapshot = await fetchTodaysBiometrics("access-token");

    expect(snapshot.date).toBe("2026-04-26");
    expect(snapshot.recovery).toEqual({ status: "no_record" });
    expect(snapshot.cycle).toBeUndefined();
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes("/cycle/123/recovery"),
      ),
    ).toBe(false);
  });
});
