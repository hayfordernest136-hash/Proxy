import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const port = process.env.PORT || "4173";
const viteEntry = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
const child = spawn(process.execPath, [viteEntry, "preview", "--host", "0.0.0.0", "--port", port], {
  stdio: "inherit",
  env: { ...process.env, PORT: port },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});

child.on("error", (error) => {
  console.error("Failed to start preview server:", error);
  process.exit(1);
});
