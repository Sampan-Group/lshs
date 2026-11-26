import { adminAuth } from "../../lib/firebase-admin.js"

interface DecodedFirebaseToken {
  uid: string
  email?: string
  emailVerified: boolean
  name?: string
  picture?: string
}

export async function verifyFirebaseToken(
  idToken: string
): Promise<DecodedFirebaseToken | null> {
  if (!adminAuth) return null

  try {
    const decoded = await adminAuth.verifyIdToken(idToken)
    return {
      uid: decoded.uid,
      email: decoded.email,
      emailVerified: decoded.email_verified === true,
      name: decoded.name,
      picture: decoded.picture,
    }
  } catch {
    return null
  }
}
