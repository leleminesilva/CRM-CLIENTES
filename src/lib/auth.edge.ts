import { SignJWT, jwtVerify } from "jose";
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
