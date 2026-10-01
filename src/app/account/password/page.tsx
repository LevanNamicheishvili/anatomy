import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/Shell";
import { Card, Logo, PORTAL_NAME } from "@/components/portal/ui";
import { getCurrentUser } from "@/lib/auth";
import { PasswordForm } from "./PasswordForm";

export const metadata: Metadata = { title: `პაროლის შეცვლა — ${PORTAL_NAME}` };

export default async function PasswordPage() {
  // Not requireUser(): that would send a first-time user straight back here.
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const form = (
    <Card className="w-full max-w-md p-6 sm:p-8">
      <h1 className="text-2xl font-semibold">{user.mustChangePassword ? "შექმენი საკუთარი პაროლი" : "პაროლის შეცვლა"}</h1>
      <p className="mt-2 text-[15px] leading-7 text-[#66736f]">
        {user.mustChangePassword
          ? `გამარჯობა, ${user.fullName}! დროებითი პაროლი შეცვალე ისეთით, რომელსაც მხოლოდ შენ გეცოდინება.`
          : "ახალი პაროლი ძველის ნაცვლად იმოქმედებს."}
      </p>
      <div className="mt-6">
        <PasswordForm />
      </div>
    </Card>
  );

  // First sign-in: no navigation until the temporary password is replaced.
  if (user.mustChangePassword)
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-[#f4f6f5] px-4 py-10 font-sans text-[#111a18]">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="text-[17px] font-heading">{PORTAL_NAME}</span>
        </div>
        {form}
      </div>
    );
  return (
    <PortalShell user={user} active="/account/password">
      <div className="flex justify-center">{form}</div>
    </PortalShell>
  );
}
