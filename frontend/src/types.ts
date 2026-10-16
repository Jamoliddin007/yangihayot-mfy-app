export type Role = "BOSS" | "EMPLOYEE";

export type CallStatus = "PENDING" | "IN_PROGRESS" | "REACHED" | "NO_ANSWER" | "PHONE_OFF";
export type ResultStatus = Extract<CallStatus, "REACHED" | "NO_ANSWER" | "PHONE_OFF">;

export interface CurrentUser {
  id: string;
  telegramId: string;
  fullName: string;
  role: Role;
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
  calledAt: string | null;
  updatedAt: string;
}

export interface Campaign {
  id: string;
  title: string;
  description: string | null;
  status: "ACTIVE" | "CLOSED";
  createdAt: string;
  tasks: CallTask[];
}

export interface Employee {
  id: string;
  fullName: string;
  phone: string | null;
  isActive: boolean;
  telegramId: string | null;
  inviteCode: string | null;
  linkedAt: string | null;
  createdAt: string;
  inviteLink: string | null;
  _count: { mahallas: number };
}

export const STATUS_LABEL: Record<CallStatus, string> = {
  PENDING: "Navbatda",
  IN_PROGRESS: "Qo'ng'iroq qilinmoqda",
  REACHED: "Bog'landi",
  NO_ANSWER: "Ko'tarmadi",
  PHONE_OFF: "Telefon o'chiq",
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
