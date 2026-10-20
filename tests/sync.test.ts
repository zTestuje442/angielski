import { describe, expect, it } from "vitest";
import { activeReviews, addReviews, emptyProgress, recordSet } from "../src/lib/progress.ts";
import { getSyncKey, isSyncKey, setSyncKey, syncProgress } from "../src/lib/sync.ts";

const cfg = { url: "https://example.supabase.co/", anonKey: "eyJtest" };

/** Udawany Supabase: dwie funkcje RPC na wspólnej mapie. */
function fakeSupabase() {
  const db = new Map<string, unknown>();
  const calls: { url: string; headers: Record<string, string>; body: { k: string; d?: unknown } }[] = [];
  const fetchFn = (async (url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    calls.push({ url, headers: init.headers as Record<string, string>, body });
    if (url.endsWith("/get_progress")) return new Response(JSON.stringify(db.get(body.k) ?? null));
    db.set(body.k, body.d);
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  return { db, calls, fetchFn };
}

const storage = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } as Storage;
};

describe("kod synchronizacji", () => {
  it("powstaje raz i się nie zmienia", () => {
    const s = storage();
    const key = getSyncKey(s);
    expect(isSyncKey(key)).toBe(true);
    expect(getSyncKey(s)).toBe(key);
  });

  it("wpisany kod musi być UUID", () => {
    const s = storage();
    expect(() => setSyncKey(s, "abc")).toThrow();
    setSyncKey(s, " 3F2504E0-4F89-41D3-9A0C-0305E82C3301 ");
    expect(getSyncKey(s)).toBe("3f2504e0-4f89-41d3-9a0c-0305e82c3301");
  });
});

describe("[Synchronizacja] syncProgress", () => {
  const key = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
  const t = (d: number) => new Date(`2026-10-0${d}T10:00:00Z`);

  it("dwa komputery z rozbieżnym postępem kończą z tym samym, połączonym postępem", async () => {
    const { fetchFn } = fakeSupabase();
    const work = addReviews(recordSet(emptyProgress(), "a-1", 90, t(1)), ["e1"], t(1));
    const home = recordSet(recordSet(emptyProgress(), "a-1", 70, t(2)), "b-1", 100, t(2));

    const afterWork = await syncProgress(cfg, key, work, fetchFn);
    const afterHome = await syncProgress(cfg, key, home, fetchFn);
    const workAgain = await syncProgress(cfg, key, afterWork, fetchFn);

    expect(afterHome).toEqual(workAgain);
    expect(afterHome.sets["a-1"].bestScore).toBe(90);
    expect(afterHome.sets["b-1"].bestScore).toBe(100);
    expect(activeReviews(afterHome)).toEqual(["e1"]);
  });

  it("wysyła kod w treści żądania, nie w URL-u, z kluczem anon w nagłówkach", async () => {
    const { calls, fetchFn } = fakeSupabase();
    await syncProgress(cfg, key, emptyProgress(), fetchFn);
    expect(calls.map(c => c.url)).toEqual([
      "https://example.supabase.co/rest/v1/rpc/get_progress",
      "https://example.supabase.co/rest/v1/rpc/save_progress",
    ]);
    expect(calls.every(c => !c.url.includes(key) && c.body.k === key)).toBe(true);
    expect(calls[0].headers).toMatchObject({ apikey: "eyJtest", Authorization: "Bearer eyJtest" });
  });

  it("akceptuje URL projektu także w postaci „API URL” z /rest/v1/", async () => {
    const { calls, fetchFn } = fakeSupabase();
    await syncProgress({ ...cfg, url: "https://example.supabase.co/rest/v1/" }, key, emptyProgress(), fetchFn);
    expect(calls[0].url).toBe("https://example.supabase.co/rest/v1/rpc/get_progress");
  });

  it("nowy klucz publishable idzie tylko w nagłówku apikey", async () => {
    const { calls, fetchFn } = fakeSupabase();
    await syncProgress({ ...cfg, anonKey: "sb_publishable_x" }, key, emptyProgress(), fetchFn);
    expect(calls[0].headers).toEqual({ apikey: "sb_publishable_x", "Content-Type": "application/json" });
  });

  it("błąd serwera przerywa synchronizację, zanim cokolwiek zapisze", async () => {
    const failing = (async () => new Response("nope", { status: 500 })) as typeof fetch;
    await expect(syncProgress(cfg, key, emptyProgress(), failing)).rejects.toThrow("HTTP 500");
  });
});
