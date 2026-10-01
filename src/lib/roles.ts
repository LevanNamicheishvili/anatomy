export type Role = "super_admin" | "school_admin" | "teacher" | "student";

export const ROLE_NAMES: Record<Role, string> = {
  super_admin: "სისტემის ადმინისტრატორი",
  school_admin: "სკოლის ადმინისტრატორი",
  teacher: "მასწავლებელი",
  student: "მოსწავლე",
};
