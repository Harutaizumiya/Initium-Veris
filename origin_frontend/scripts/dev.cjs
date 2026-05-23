const { spawn } = require("node:child_process");
const path = require("node:path");

const frontendRoot = path.resolve(__dirname, "..");
const backendRoot = process.env.ORIGIN_DJANGO_PATH || "C:\\Users\\Haruta\\Documents\\code\\python\\origin_django";
const backendPython = path.join(backendRoot, ".venv", "Scripts", "python.exe");
const backendManagePy = path.join(backendRoot, "manage.py");
const viteBin = path.join(frontendRoot, "node_modules", "vite", "bin", "vite.js");

const isDebug = process.argv.includes("--debug");
const frontendArgs = [viteBin, ...(isDebug ? ["--mode", "debug"] : []), "--port=3000", "--host=0.0.0.0"];
const processes = [];

function spawnProcess(label, command, args, cwd) {
  let child;

  try {
    child = spawn(command, args, {
      cwd,
      stdio: ["inherit", "pipe", "pipe"],
      env: process.env,
    });
  } catch (error) {
    console.error(`[${label}] failed to start: ${error.message}`);
    shutdown(1);
    return null;
  }

  processes.push(child);

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[${label}] ${chunk}`);
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[${label}] ${chunk}`);
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    console.log(`[${label}] exited with ${signal || code}`);
    shutdown(code || 1);
  });

  child.on("error", (error) => {
    console.error(`[${label}] failed to start: ${error.message}`);
    shutdown(1);
  });

  return child;
}

let shuttingDown = false;

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of processes) {
    if (!child.killed) {
      child.kill();
    }
  }

  process.exitCode = exitCode;
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log(`Starting Django backend from ${backendRoot}`);
spawnProcess("backend", backendPython, [backendManagePy, "runserver"], backendRoot);

console.log(`Starting Vite frontend from ${frontendRoot}`);
spawnProcess("frontend", process.execPath, frontendArgs, frontendRoot);
