import type { Request, Response } from "express"
import { verifyFirebaseToken } from "./auth.service.js"
import { signSessionToken, sanitizeUser } from "./auth.utils.js"
import { prisma } from "../../lib/prisma.js"

/* ─── CHECK EMAIL ──────────────────────────────────────
   Determines if an email belongs to an existing user.
   Returns only what the frontend needs: { exists, next }
   Never exposes user details, IDs, names, or roles.        */
export async function checkEmail(req: Request, res: Response) {
  const { email } = req.body as { email?: string }

  // Validate
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Please provide a valid email address.",
      code: "AUTH_INVALID_EMAIL",
    })
  }

  // Normalize — trim + lowercase, consistent with all other queries
  const normalizedEmail = email.trim().toLowerCase()

  try {
    const existingUser = await prisma.user.findFirst({
      where: { email: normalizedEmail },
      select: { id: true, isActive: true, role: true, firebaseUid: true },
    })

    // Deactivated account — block early
    if (existingUser && !existingUser.isActive) {
      return res.status(403).json({
        success: false,
        message: "This account has been deactivated. Please contact an administrator.",
        code: "AUTH_ACCOUNT_DEACTIVATED",
      })
    }

    if (!existingUser) {
      return res.status(403).json({
        success: false,
        message: "This email does not have CRM access. Ask an administrator to add your staff account.",
      })
    }
    if (!['ADMIN', 'MANAGER', 'SALES_PERSON'].includes(existingUser.role)) {
      return res.status(403).json({
        success: false,
        message: "CRM access is limited to approved staff accounts.",
      })
    }
    return res.json({
      success: true,
      data: { exists: Boolean(existingUser.firebaseUid), next: existingUser.firebaseUid ? "signin" : "signup" },
    })
  } catch {
    return res.status(500).json({
      success: false,
      message: "Unable to check this email right now. Please try again.",
      code: "AUTH_EMAIL_CHECK_FAILED",
    })
  }
}

/* ─── SIGN UP (existing — keep as-is) ────────────────── */
export async function signUp(req: Request, res: Response) {
  const { idToken } = req.body as { idToken?: string }
  if (!idToken) return res.status(400).json({ success: false, message: "Missing Firebase ID token" })

  const decoded = await verifyFirebaseToken(idToken)
  if (!decoded?.email) return res.status(401).json({ success: false, message: "Invalid or expired Firebase token" })

  const user = await prisma.user.findUnique({ where: { email: decoded.email.trim().toLowerCase() } })
  if (!user || !user.isActive || !['ADMIN', 'MANAGER', 'SALES_PERSON'].includes(user.role)
    || (user.firebaseUid && user.firebaseUid !== decoded.uid)) {
    return res.status(403).json({ success: false, message: "This email has not been approved for CRM access." })
  }
  if (!user.firebaseUid && !decoded.emailVerified) {
    return res.status(403).json({ success: false, message: "Verify your email address before accessing the CRM." })
  }

  if (!user.firebaseUid) {
    const linked = await prisma.user.updateMany({
      where: { id: user.id, firebaseUid: null },
      data: { firebaseUid: decoded.uid, password: '' },
    })
    if (linked.count !== 1) {
      return res.status(409).json({ success: false, message: "Account setup changed. Please try signing in again." })
    }
  }

  const sessionToken = signSessionToken({ userId: user.id, role: user.role, email: user.email })
  setSessionCookie(res, sessionToken)
  return res.json({ success: true, message: "Staff account activated", data: sanitizeUser(user) })
}

/* ─── SIGN IN (existing — keep as-is) ─────────────────── */
export async function signIn(req: Request, res: Response) {
  const { idToken } = req.body as { idToken?: string }

  if (!idToken) {
    return res.status(400).json({ success: false, message: "Missing Firebase ID token" })
  }

  const decoded = await verifyFirebaseToken(idToken)
  if (!decoded) {
    return res.status(401).json({ success: false, message: "Invalid or expired Firebase token" })
  }

  const email = decoded.email?.trim().toLowerCase()
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null
  if (!user || !user.isActive || (user.firebaseUid && user.firebaseUid !== decoded.uid)) {
    return res.status(403).json({
      success: false,
      message: "This account does not have CRM access. Contact an administrator.",
    })
  }

  if (!['ADMIN', 'MANAGER', 'SALES_PERSON'].includes(user.role)) {
    return res.status(403).json({
      success: false,
      message: "CRM access is limited to approved staff accounts.",
    })
  }

  if (!user.firebaseUid && !decoded.emailVerified) {
    return res.status(403).json({ success: false, message: "Verify your email address before accessing the CRM." })
  }

  if (!user.firebaseUid) {
    const linked = await prisma.user.updateMany({
      where: { id: user.id, firebaseUid: null },
      data: { firebaseUid: decoded.uid, password: '' },
    })
    if (linked.count !== 1) {
      return res.status(409).json({ success: false, message: "Account setup changed. Please try signing in again." })
    }
  }

  const sessionToken = signSessionToken({
    userId: user.id, role: user.role, email: user.email,
  })
  setSessionCookie(res, sessionToken)

  return res.json({
    success: true,
    message: "Signed in successfully",
    data: sanitizeUser(user),
  })
}

/* ─── GET CURRENT USER / SIGN OUT (existing — keep as-is) */
export async function getCurrentUser(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Not authenticated" })
  }
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { id: true, name: true, firstName: true, lastName: true, email: true, role: true, isActive: true, createdAt: true },
  })
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" })
  }
  return res.json({ success: true, data: user })
}

export async function signOut(_req: Request, res: Response) {
  res.clearCookie("lshs_session", { path: "/" })
  return res.json({ success: true, message: "Signed out successfully" })
}

function setSessionCookie(res: Response, token: string) {
  res.cookie("lshs_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  })
}
