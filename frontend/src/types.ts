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
  // Shaffof (x/10, x/15) fonlar kunduzgi va tungi mavzuda bir xil yaxshi ko'rinadi
  PENDING: {
    dot: "bg-red-500",
    card: "border-l-4 border-l-red-400 bg-surface",
    badge: "bg-red-500/15 text-red-600",
  },
  IN_PROGRESS: {
    dot: "bg-amber-500",
    card: "border-l-4 border-l-amber-400 bg-amber-500/10",
    badge: "bg-amber-500/15 text-amber-600",
  },
  REACHED: {
    dot: "bg-emerald-500",
    card: "border-l-4 border-l-emerald-400 bg-emerald-500/10",
    badge: "bg-emerald-500/15 text-emerald-600",
  },
  NO_ANSWER: {
    dot: "bg-orange-500",
    card: "border-l-4 border-l-orange-400 bg-orange-500/10",
    badge: "bg-orange-500/15 text-orange-600",
  },
  PHONE_OFF: {
    dot: "bg-gray-400",
    card: "border-l-4 border-l-gray-400 bg-surface",
    badge: "bg-gray-500/15 text-muted",
  },
};
