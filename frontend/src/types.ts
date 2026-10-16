export type Role = "BOSS" | "EMPLOYEE";

export type CallStatus = "PENDING" | "IN_PROGRESS" | "REACHED" | "NO_ANSWER" | "PHONE_OFF";
export type ResultStatus = Extract<CallStatus, "REACHED" | "NO_ANSWER" | "PHONE_OFF">;
export type CampaignKind = "MEETING" | "EVENT" | "OTHER";

export interface MembershipInfo {
  orgId: string;
  orgName: string;
  role: Role;
}

export interface MeResponse {
  user: { id: string; fullName: string; isPlatformOwner: boolean };
  memberships: MembershipInfo[];
}

// Joriy tashkilotdagi foydalanuvchi
export interface SessionUser {
  id: string;
  fullName: string;
  role: Role;
  orgId: string;
  orgName: string;
}

export interface UserRef {
  id: string;
  fullName: string;
}

export interface Mahalla {
  id: string;
  name: string;
  chairmanName: string;
  phone: string;
  sector: number | null;
  sortOrder: number;
  isActive: boolean;
  assignedToId: string | null;
  assignedTo?: UserRef | null;
}

export interface CallTask {
  id: string;
  campaignId: string;
  mahallaId: string;
  mahalla: Mahalla;
  status: CallStatus;
  assignedToId: string | null;
  assignedTo: UserRef | null;
  calledById: string | null;
  calledBy: UserRef | null;
  note: string | null;
  calledAt: string | null;
  updatedAt: string;
}

export interface Campaign {
  id: string;
  kind: CampaignKind;
  title: string;
  description: string | null;
  scheduledAt: string | null;
  location: string | null;
  status: "ACTIVE" | "CLOSED";
  createdAt: string;
  closedAt: string | null;
  tasks: CallTask[];
}

export interface CampaignHistoryItem extends Omit<Campaign, "tasks"> {
  total: number;
  reached: number;
}

export interface Member {
  userId: string;
  fullName: string;
  username: string | null;
  phone: string | null;
  role: Role;
  isActive: boolean;
  joined: boolean;
  mahallaCount: number;
  inviteLink: string | null;
}

export const ROLE_LABEL: Record<Role, string> = {
  BOSS: "Boshliq",
  EMPLOYEE: "Xodim",
};

export const KIND_LABEL: Record<CampaignKind, string> = {
  MEETING: "Yig'ilish",
  EVENT: "Tadbir",
  OTHER: "Boshqa",
};

export const STATUS_LABEL: Record<CallStatus, string> = {
  PENDING: "Navbatda",
  IN_PROGRESS: "Qo'ng'iroq qilinmoqda",
  REACHED: "Bog'landi",
  NO_ANSWER: "Ko'tarmadi",
  PHONE_OFF: "Telefon o'chiq",
};

// Ro'yxat qatorlari uchun qisqa nom (rais ismi qisqarib ketmasligi uchun)
export const STATUS_SHORT: Record<CallStatus, string> = {
  PENDING: "Navbatda",
  IN_PROGRESS: "Qo'ng'iroqda",
  REACHED: "Bog'landi",
  NO_ANSWER: "Ko'tarmadi",
  PHONE_OFF: "O'chiq",
};

// Rang — matn rangi va nuqta uchun (Tailwind sinflari)
export const STATUS_TONE: Record<CallStatus, { text: string; dot: string }> = {
  PENDING: { text: "text-hint", dot: "border-[1.5px] border-hint" },
  IN_PROGRESS: { text: "text-live", dot: "bg-live" },
  REACHED: { text: "text-ok", dot: "bg-ok" },
  NO_ANSWER: { text: "text-warn", dot: "bg-warn" },
  PHONE_OFF: { text: "text-off", dot: "bg-off" },
};

// Ro'yxatda qaysi tartibda chiqadi: avval bajarilishi kerak bo'lganlar
export const STATUS_ORDER: Record<CallStatus, number> = {
  IN_PROGRESS: 0,
  PENDING: 1,
  NO_ANSWER: 2,
  PHONE_OFF: 3,
  REACHED: 4,
};
