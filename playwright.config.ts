import { defineConfig } from "@playwright/test";

// Osobny serwer na 5174 z udawanym Supabase (https://sync.test, przechwytywany w testach), żeby testy nigdy
// nie dotykały prawdziwej bazy z .env.
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000, // testy przechodzą całe zestawy zadań
  use: { baseURL: "http://localhost:5174", viewport: { width: 1080, height: 800 } },
  webServer: {
    command: "npm run dev -- --port 5174 --strictPort",
    url: "http://localhost:5174",
    reuseExistingServer: false,
    env: { VITE_SUPABASE_URL: "https://sync.test", VITE_SUPABASE_ANON_KEY: "test-anon-key" },
  },
});
