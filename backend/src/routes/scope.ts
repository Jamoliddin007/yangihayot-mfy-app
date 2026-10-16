import type { FastifyInstance } from "fastify";
import { authenticate, requireMember } from "../authPlugin.js";

// Shu plagin ichidagi barcha route'lar: foydalanuvchi aniqlangan + tanlangan tashkilotning faol a'zosi.
// request.currentUser.orgId — ma'lumotlarni cheklash uchun yagona manba.
export function orgScoped(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);
  fastify.addHook("preHandler", requireMember);
}
