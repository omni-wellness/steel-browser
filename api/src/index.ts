import fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifySensible from "@fastify/sensible";
import steelBrowserPlugin from "./steel-browser-plugin.js";
import uiPlugin from "./plugins/ui-plugin.js";
import { loggingConfig } from "./config.js";
import { MB } from "./utils/size.js";
import { ShutdownReason } from "./services/cdp/plugins/core/base-plugin.js";
import path from "node:path";

const HOST = process.env.HOST ?? "0.0.0.0";
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

export const server = fastify({
  logger: loggingConfig[process.env.NODE_ENV ?? "development"] ?? true,
  trustProxy: true,
  bodyLimit: 100 * MB,
  disableRequestLogging: true,
});

const setupServer = async () => {
  await server.register(fastifySensible);
  await server.register(fastifyCors, { origin: true });

  // Register UI plugin only in production (when we have built UI files)
  if (process.env.NODE_ENV === "production") {
    await server.register(uiPlugin, {
      uiDistPath: path.join(process.cwd(), "ui/dist"),
      uiPrefix: "/ui",
    });
  }

  await server.register(steelBrowserPlugin, {
    fileStorage: {
      maxSizePerSession: 100 * MB,
    },
  });
};

const startServer = async () => {
  try {
    await setupServer();
    await server.listen({ port: PORT, host: HOST });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};
let shuttingDown = false;

const shutdown = async (signal: NodeJS.Signals) => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  server.log.info({ signal }, "Shutting down Steel Browser API");
  const forcedExit = setTimeout(() => {
    server.log.error({ signal }, "Steel Browser API shutdown timed out");
    process.exit(1);
  }, 25_000);
  forcedExit.unref();

  try {
    if ("cdpService" in server && server.cdpService) {
      await server.cdpService.shutdown(ShutdownReason.SESSION_END);
    }
    await server.close();
    clearTimeout(forcedExit);
    process.exit(0);
  } catch (err) {
    server.log.error({ err, signal }, "Steel Browser API shutdown failed");
    process.exit(1);
  }
};

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
startServer();
