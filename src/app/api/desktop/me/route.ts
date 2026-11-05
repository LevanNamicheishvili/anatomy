import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

/*
 * For the desktop application: who is signed in. It keeps this answer, so that without internet the person still has
 * their own role (a pupil stays a pupil) and an account that was closed stops working once the computer is next online.
 */
export async function GET() {
  const user = await getCurrentUser();
  const headers = { "Cache-Control": "no-store" };
  if (!user || user.mustChangePassword) return NextResponse.json(null, { status: 401, headers });
  const { id, role, fullName, username, classLabel, school } = user;
  return NextResponse.json({ id, role, fullName, username, classLabel, school }, { headers });
}
