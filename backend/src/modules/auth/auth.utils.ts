import jwt from "jsonwebtoken"

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set to a random value of at least 32 characters')
  }
  return secret
}
const JWT_SECRET = getJwtSecret()
const JWT_EXPIRES_IN = "7d"

export interface SessionPayload {
  userId: number
  role: string
  email: string
}

export function signSessionToken(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionPayload
  } catch {
    return null
  }
}

export function sanitizeUser(user: any) {
  const { password, firebaseUid, ...safe } = user
  return safe
}
