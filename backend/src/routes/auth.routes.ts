import type { FastifyInstance } from "fastify";
import { authenticate } from "../authPlugin.js";

export async function authRoutes(fastify: FastifyInstance) {
  fastify.get("/api/me", { preHandler: authenticate }, async (request) => {
    return request.currentUser;
  });
}
