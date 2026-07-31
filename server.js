const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const PORT = Number(process.env.PORT || 8080);
const ROOT = __dirname;
const STATE_FILE = path.join(ROOT, "tournament-state.json");
const clients = new Set();

let currentState = readSavedState();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && url.pathname === "/api/state") {
    sendJson(response, currentState || {});
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/state") {
    readRequestBody(request, response, (body) => {
      try {
        const nextState = JSON.parse(body);
        if (!isValidState(nextState)) {
          sendJson(response, { error: "Estado invalido" }, 400);
          return;
        }

        currentState = {
          ...nextState,
          updatedAt: new Date().toISOString()
        };
        fs.writeFileSync(STATE_FILE, JSON.stringify(currentState, null, 2));
        broadcastState();
        sendJson(response, { ok: true });
      } catch {
        sendJson(response, { error: "JSON invalido" }, 400);
      }
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/events") {
    response.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*"
    });
    response.write("\n");
    clients.add(response);

    if (currentState) {
      response.write(`event: state\ndata: ${JSON.stringify(currentState)}\n\n`);
    }

    request.on("close", () => {
      clients.delete(response);
    });
    return;
  }

  if (request.method !== "GET") {
    response.writeHead(405);
    response.end("Metodo nao permitido");
    return;
  }

  serveStaticFile(url.pathname, response);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor do torneio rodando em http://localhost:${PORT}`);
  getLocalAddresses().forEach((address) => {
    console.log(`Acesse em outro dispositivo: http://${address}:${PORT}`);
  });
});

function serveStaticFile(urlPathname, response) {
  const safePathname = urlPathname === "/" ? "/index.html" : decodeURIComponent(urlPathname);
  const filePath = path.normalize(path.join(ROOT, safePathname));

  if (!filePath.startsWith(ROOT)) {
    response.writeHead(403);
    response.end("Acesso negado");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Arquivo nao encontrado");
      return;
    }

    const type = mimeTypes[path.extname(filePath)] || "application/octet-stream";
    response.writeHead(200, { "Content-Type": type });
    response.end(content);
  });
}

function readSavedState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readRequestBody(request, response, callback) {
  let body = "";
  request.on("data", (chunk) => {
    body += chunk;
    if (body.length > 1_000_000) {
      response.writeHead(413);
      response.end("Payload muito grande");
      request.destroy();
    }
  });
  request.on("end", () => callback(body));
}

function sendJson(response, data, status = 200) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-cache"
  });
  response.end(JSON.stringify(data));
}

function broadcastState() {
  if (!currentState) return;
  const payload = `event: state\ndata: ${JSON.stringify(currentState)}\n\n`;
  clients.forEach((client) => client.write(payload));
}

function isValidState(value) {
  return Boolean(
    value &&
    Array.isArray(value.players) &&
    Array.isArray(value.rounds) &&
    typeof value.drawn === "boolean" &&
    typeof value.champion === "string"
  );
}

function getLocalAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((info) => info && info.family === "IPv4" && !info.internal)
    .map((info) => info.address);
}
