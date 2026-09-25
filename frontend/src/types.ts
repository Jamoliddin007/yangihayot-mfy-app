export type Role = "BOSS" | "EMPLOYEE";

export type CallStatus = "PENDING" | "IN_PROGRESS" | "REACHED" | "NO_ANSWER" | "PHONE_OFF";

export interface CurrentUser {
  id: string;
  telegramId: string;
  fullName: string;
  role: Role;
}

export interface Mahalla {
  id: string;
  name: string;
  chairmanName: string;
  phone: string;
  sortOrder: number;
  isActive: boolean;
}

export interface AssignedUser {
  id: string;
  fullName: string;
}

export interface CallTask {
  id: string;
  campaignId: string;
  mahallaId: string;
  mahalla: Mahalla;
  status: CallStatus;
  assignedToId: string | null;
  assignedTo: AssignedUser | null;
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
}

export const STATUS_LABEL: Record<CallStatus, string> = {
  PENDING: "Kutilmoqda",
  IN_PROGRESS: "Qo'ng'iroq qilinmoqda",
  REACHED: "Bog'landi",
  NO_ANSWER: "Ko'tarmadi",
  PHONE_OFF: "Telefon o'chiq",
};

export const STATUS_STYLE: Record<CallStatus, { dot: string; card: string; badge: string }> = {
  PENDING: {
    dot: "bg-red-500",
    card: "border-l-4 border-l-red-400 bg-white",
    badge: "bg-red-100 text-red-700",
  },
  IN_PROGRESS: {
    dot: "bg-amber-500",
    card: "border-l-4 border-l-amber-400 bg-amber-50/40",
    badge: "bg-amber-100 text-amber-700",
  },
  REACHED: {
    dot: "bg-emerald-500",
    card: "border-l-4 border-l-emerald-400 bg-emerald-50/40",
    badge: "bg-emerald-100 text-emerald-700",
  },
  NO_ANSWER: {
    dot: "bg-orange-500",
    card: "border-l-4 border-l-orange-400 bg-orange-50/40",
    badge: "bg-orange-100 text-orange-700",
  },
  PHONE_OFF: {
    dot: "bg-gray-400",
    card: "border-l-4 border-l-gray-300 bg-gray-50",
    badge: "bg-gray-100 text-gray-600",
  },
};
