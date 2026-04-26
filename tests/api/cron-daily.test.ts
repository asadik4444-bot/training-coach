import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";
import { GET } from "../../src/app/api/cron/daily/route";

vi.mock("@/lib/kv", () => ({
  loadRefreshToken: vi.fn().mockResolvedValue("refresh-token"),
  saveRefreshToken: vi.fn().mockResolvedValue(undefined),
  isSkipped: vi.fn().mockResolvedValue(false),
  getSwap: vi.fn().mockResolvedValue(null),
  setRecoverySnapshot: vi.fn().mockResolvedValue(undefined),
  setBiometricSnapshot: vi.fn().mockResolvedValue(undefined),
  listBiometricSnapshots: vi.fn().mockResolvedValue([]),
  getPainEntries: vi.fn().mockResolvedValue([]),
  appendToArchive: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/telegram", () => ({
  sendTelegram: vi.fn().mockResolvedValue(undefined),
  sendTelegramWithButtons: vi.fn().mockResolvedValue(undefined),
}));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = {
    ...ORIGINAL_ENV,
    CRON_SECRET: "test-secret",
    WHOOP_CLIENT_ID: "client-id",
    WHOOP_CLIENT_SECRET: "client-secret",
  };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("daily cron", () => {
  it("does not return raw Whoop upstream bodies", async () => {
    const upstreamBody = "raw-upstream-body secret-request-id=abc123";
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(upstreamBody, { status: 500 })),
    );

    const req = new Request("http://localhost/api/cron/daily", {
      headers: { authorization: "Bearer test-secret" },
    }) as unknown as NextRequest;

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body).toEqual({ error: "whoop upstream error", status: 500 });
    expect(JSON.stringify(body)).not.toContain(upstreamBody);
    expect(consoleError).toHaveBeenCalledWith("whoop upstream error", {
      status: 500,
      bodyPreview: upstreamBody,
    });
  });
});
