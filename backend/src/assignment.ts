import type { Prisma } from "@prisma/client";

// MFY mas'uli o'zgarganda tashkilotning faol topshirig'idagi hali bog'lanilmagan vazifalarni ham
// yangi xodimga o'tkazadi. Bog'lanilganlari (REACHED) tarix sifatida o'zgarmaydi.
export function reassignOpenTasks(
  tx: Prisma.TransactionClient,
  orgId: string,
  filter: Pick<Prisma.CallTaskWhereInput, "mahallaId" | "assignedToId">,
  assignedToId: string | null,
) {
  return tx.callTask.updateMany({
    where: { ...filter, status: { not: "REACHED" }, campaign: { orgId, status: "ACTIVE" } },
    data: { assignedToId },
  });
}
