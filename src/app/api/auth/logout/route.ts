import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ message: "Logout realizado" });
  response.cookies.delete("token");
  return response;
}
