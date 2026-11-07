import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const recordsPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "data",
  "records.json",
);
const maxRequestSize = 1024 * 1024;

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function readRequestBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;

    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxRequestSize) {
        tooLarge = true;
        rejectBody(new ApiError(413, "Request body exceeds 1 MB."));
        return;
      }
      chunks.push(chunk);
    });

    request.on("end", () => {
      if (tooLarge) return;

      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        rejectBody(new ApiError(400, "Request body must be valid JSON."));
      }
    });

    request.on("error", rejectBody);
  });
}

function readStore() {
  if (!existsSync(recordsPath)) return { collections: {} };

  const store = JSON.parse(readFileSync(recordsPath, "utf8"));
  if (
    store === null ||
    typeof store !== "object" ||
    store.collections === null ||
    typeof store.collections !== "object" ||
    Array.isArray(store.collections)
  ) {
    throw new Error("The local records store has an invalid format.");
  }

  return store;
}

function writeStore(store) {
  mkdirSync(dirname(recordsPath), { recursive: true });
  writeFileSync(recordsPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function requireRecordArgs(args) {
  if (
    args === null ||
    typeof args !== "object" ||
    typeof args.collection !== "string" ||
    args.collection.trim() === ""
  ) {
    throw new ApiError(400, "A collection name is required.");
  }

  return args;
}

function runAction(action, rawArgs) {
  const args = requireRecordArgs(rawArgs);
  const store = readStore();
  const records = store.collections[args.collection] ?? [];

  if (!Array.isArray(records)) {
    throw new Error(`The "${args.collection}" collection is invalid.`);
  }

  if (action === "records.list") {
    if (
      args.limit !== undefined &&
      (!Number.isSafeInteger(args.limit) || args.limit < 0)
    ) {
      throw new ApiError(400, "The list limit must be a non-negative integer.");
    }

    return { records: records.slice(0, args.limit ?? 100) };
  }

  if (
    (action === "records.create" || action === "records.replace") &&
    (args.value === null ||
      typeof args.value !== "object" ||
      Array.isArray(args.value))
  ) {
    throw new ApiError(400, "A record value object is required.");
  }

  if (action === "records.create") {
    const record = { id: randomUUID(), value: args.value };
    store.collections[args.collection] = [...records, record];
    writeStore(store);
    return { record };
  }

  if (action === "records.replace") {
    if (typeof args.id !== "string" || args.id === "") {
      throw new ApiError(400, "A record ID is required.");
    }

    const index = records.findIndex((record) => record.id === args.id);
    if (index === -1) {
      throw new ApiError(404, `Record "${args.id}" was not found.`);
    }

    const record = { id: args.id, value: args.value };
    records[index] = record;
    store.collections[args.collection] = records;
    writeStore(store);
    return { record };
  }

  throw new ApiError(400, `Unsupported action "${action}".`);
}

async function handleActionsRequest(request, response) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.writeHead(405);
    response.end(JSON.stringify({ error: "Only POST is supported." }));
    return;
  }

  try {
    const body = await readRequestBody(request);
    if (
      body === null ||
      typeof body !== "object" ||
      typeof body.action !== "string"
    ) {
      throw new ApiError(400, "An action name is required.");
    }

    const data = runAction(body.action, body.args);
    response.writeHead(200);
    response.end(JSON.stringify({ data }));
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    if (status === 500) {
      console.error("Local records API failed:", error);
    }
    response.writeHead(status);
    response.end(
      JSON.stringify({
        error: status === 500 ? "The local records API failed." : error.message,
      }),
    );
  }
}

function localRecordsApi() {
  return {
    name: "d365fo-local-records-api",
    configureServer(server) {
      server.middlewares.use("/actions", handleActionsRequest);
    },
    configurePreviewServer(server) {
      server.middlewares.use("/actions", handleActionsRequest);
    },
  };
}

export default defineConfig({
  plugins: [react(), localRecordsApi()],
  server: { port: 5173 },
  preview: { port: 4173 },
});
