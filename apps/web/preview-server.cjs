const http = require("http");
const fs = require("fs");
const path = require("path");

const base = path.resolve(__dirname, "dist");
const host = "127.0.0.1";
const port = 4173;

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

http
  .createServer((req, res) => {
    const requestPath = decodeURIComponent((req.url || "/").split("?")[0]);
    let filePath = path.join(base, requestPath);

    if (requestPath === "/" || !path.extname(filePath)) {
      filePath = path.join(base, "index.html");
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        fs.readFile(path.join(base, "index.html"), (fallbackError, fallback) => {
          if (fallbackError) {
            res.writeHead(404);
            res.end("Not found");
            return;
          }

          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(fallback);
        });
        return;
      }

      res.writeHead(200, {
        "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
      });
      res.end(data);
    });
  })
  .listen(port, host);
