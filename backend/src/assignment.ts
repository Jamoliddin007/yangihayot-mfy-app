import type { Prisma } from "@prisma/client";

// MFY mas'uli o'zgarganda faol topshiriqdagi hali bog'lanilmagan vazifalarni ham yangi xodimga o'tkazadi.
// Bog'lanilganlari (REACHED) tarix sifatida kim bajargan bo'lsa o'shanda qoladi.
export function reassignOpenTasks(
  tx: Prisma.TransactionClient,
  filter: Prisma.CallTaskWhereInput,
  assignedToId: string | null,
) {
  return tx.callTask.updateMany({
    where: { ...filter, status: { not: "REACHED" }, campaign: { status: "ACTIVE" } },
    data: { assignedToId },
  });
}
