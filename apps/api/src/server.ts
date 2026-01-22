import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { healthRoutes } from "./routes/health.js";
import { walletSeedlessRoutes } from "./routes/walletSeedless.js";
import { passkeyRoutes } from "./routes/passkey.js";
import { truelayerRoutes } from "./routes/truelayer.js";

const app = Fastify({
  logger: true,
});

await app.register(cors, {
  origin: true,
});

await app.register(healthRoutes);
await app.register(walletSeedlessRoutes);
await app.register(passkeyRoutes);
await app.register(truelayerRoutes);

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

