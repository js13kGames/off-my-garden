// Runs scripts/gameplay-check.ts (the gameplay regression check) in Node via
// Vite's SSR loader, so the real TypeScript modules execute without a build
// step or a test framework.
import { createServer } from "vite";

const server = await createServer({
  configFile: false,
  logLevel: "error",
  server: { middlewareMode: true },
});
try {
  await server.ssrLoadModule("/scripts/gameplay-check.ts");
} finally {
  await server.close();
}
