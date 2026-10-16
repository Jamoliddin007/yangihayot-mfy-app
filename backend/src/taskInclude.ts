import type { Prisma } from "@prisma/client";

// Frontend'ga yuboriladigan har bir vazifa shu shaklda bo'ladi (REST javobi va socket eventi bir xil)
export const taskInclude = {
  mahalla: true,
  assignedTo: { select: { id: true, fullName: true } },
} satisfies Prisma.CallTaskInclude;
