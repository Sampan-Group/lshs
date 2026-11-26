import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { requireAuth, requireRole } from './auth.middleware.js'

const router = Router()
router.use(requireAuth, requireRole('ADMIN'))

const createStaffSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  role: z.enum(['MANAGER', 'SALES_PERSON']),
})

router.get('/', async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'MANAGER', 'SALES_PERSON'] } },
    select: { id: true, name: true, email: true, role: true, isActive: true, firebaseUid: true },
    orderBy: { createdAt: 'desc' },
  })
  return res.json({
    success: true,
    data: users.map(({ firebaseUid, ...user }) => ({ ...user, activated: Boolean(firebaseUid) })),
  })
})

router.post('/', async (req, res) => {
  const parsed = createStaffSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(422).json({ success: false, message: 'Enter a name, valid email, and staff role.' })
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } })
  if (existing) {
    return res.status(409).json({ success: false, message: 'An account already exists for this email.' })
  }

  const [firstName, ...lastNameParts] = parsed.data.name.split(/\s+/)
  try {
    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        role: parsed.data.role,
        firstName,
        lastName: lastNameParts.join(' ') || null,
        password: '',
      },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    })
    return res.status(201).json({ success: true, data: { ...user, activated: false } })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'An account already exists for this email.' })
    }
    throw error
  }
})

export default router
