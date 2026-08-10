export function formatUzs(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(num) + " UZS";
}

export function formatDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export const driverStatusLabels: Record<string, string> = {
  ACTIVE: "FAOL",
  PENDING: "KUTILMOQDA",
  BLOCKED: "BLOKLANGAN",
};

export const deviceStatusLabels: Record<string, string> = {
  ONLINE: "ONLAYN",
  OFFLINE: "OFLAYN",
  MAINTENANCE: "TA'MIRDA",
  ERROR: "XATOLIK",
};

export const visitStatusLabels: Record<string, string> = {
  PROCESSED: "Pechat",
  IGNORED_COOLDOWN: "Cooldown",
  UNMATCHED: "Noma'lum",
  ERROR: "Xato",
};

export const feedbackStatusLabels: Record<string, string> = {
  OPEN: "Yangi",
  READ: "Ko'rilgan",
  RESOLVED: "Yechilgan",
};

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
