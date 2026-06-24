import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import type { JWTPayload } from "@/types";

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || "crm-secret-key-placeholder"
);

export async function signToken(payload: Omit<JWTPayload, "iat" | "exp">) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRES_IN || "7d")
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, secret);
  return payload as unknown as JWTPayload;
}

export async function getTokenFromRequest(
  request: NextRequest
): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  const cookieStore = cookies();
  return cookieStore.get("token")?.value || null;
}

export async function getCurrentUser(request: NextRequest) {
  const token = await getTokenFromRequest(request);
  if (!token) return null;

  try {
    return await verifyToken(token);
  } catch {
    return null;
  }
}

export function setAuthCookie(token: string) {
  const cookieStore = cookies();
  cookieStore.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
}

export function clearAuthCookie() {
  const cookieStore = cookies();
  cookieStore.delete("token");
}

export async function requireAuth(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    throw new Error("Não autenticado");
  }
  return user;
}
