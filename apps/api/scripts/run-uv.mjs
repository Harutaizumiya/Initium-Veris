import { spawnSync } from "node:child_process";

const commands = {
  dev: ["python", "manage.py", "runserver"],
  test: ["python", "manage.py", "test"],
  check: ["python", "manage.py", "check"],
};

const mode = process.argv[2];
const command = commands[mode];

if (!command) {
  console.error(`Unknown command mode: ${mode}`);
  process.exit(1);
}

const env = {
  ...process.env,
  UV_CACHE_DIR: process.env.UV_CACHE_DIR || ".uv-cache",
};

if (mode === "dev" || mode === "check") {
  env.DJANGO_DEBUG = process.env.DJANGO_DEBUG || "1";
}

const result = spawnSync("uv", ["run", ...command], {
  env,
  shell: process.platform === "win32",
  stdio: "inherit",
});

process.exit(result.status ?? 1);
