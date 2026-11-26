import { createHash, randomBytes } from 'node:crypto'
import { Router, type Request } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { requireAuth, requireRole } from '../auth/auth.middleware.js'

const router = Router()
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex')
const gatewayConfigured = () => !!(
  process.env.SSLCOMMERZ_STORE_ID &&
  process.env.SSLCOMMERZ_STORE_PASSWORD &&
  process.env.BACKEND_PUBLIC_URL
)
const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/)
const idSchema = z.string().min(1).max(100)
const amountSchema = z.string().regex(/^\d{1,6}(?:\.\d{1,2})?$/)
const createSchema = z.object({
  leadId: z.number().int().positive(),
  purpose: z.enum(['LEVEL_4_INSTALLMENT', 'EXAM_FEE']),
  amountUsd: amountSchema,
  description: z.string().trim().min(3).max(200).optional(),
}).refine((value) => value.purpose !== 'EXAM_FEE' || !!value.description, {
  path: ['description'], message: 'Describe the exam fee',
})

const staffScope = (req: Request) => req.user?.role === 'SALES_PERSON'
  ? { lead: { assignedToId: req.user.userId } }
  : {}

const publicSelect = {
  id: true, purpose: true, description: true, amountUsd: true,
  status: true, createdAt: true,
} as const

router.post('/requests', requireAuth, requireRole('ADMIN', 'MANAGER', 'SALES_PERSON'), async (req, res) => {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) return res.status(422).json({ success: false, message: parsed.error.issues[0]?.message })
  if (!gatewayConfigured()) return res.status(503).json({ success: false, message: 'Configure the SSLCommerz sandbox before creating payment links' })
  const { leadId, purpose, amountUsd, description } = parsed.data
  const amount = new Prisma.Decimal(amountUsd)
  if (amount.lt('0.01')) return res.status(422).json({ success: false, message: 'Amount must be positive' })
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, deletedAt: null, ...(req.user?.role === 'SALES_PERSON' ? { assignedToId: req.user.userId } : {}) },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true },
  })
  if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' })
  if (!lead.email || !lead.phone) return res.status(422).json({ success: false, message: 'Add the lead’s email and phone before creating a payment link' })

  const token = randomBytes(32).toString('hex')
  let payment
  try {
    payment = await prisma.$transaction(async tx => {
      // A lead row lock serializes simultaneous instalment links for the same customer.
      await tx.$queryRaw`SELECT id FROM leads WHERE id = ${leadId} FOR UPDATE`
      if (purpose === 'LEVEL_4_INSTALLMENT') {
        const paid = await tx.paymentRequest.aggregate({
          where: { leadId, purpose, status: 'PAID' }, _sum: { amountUsd: true },
        })
        const paidAmount = paid._sum.amountUsd ?? new Prisma.Decimal(0)
        if (paidAmount.add(amount).gt('700.00')) throw new Error(`The Level 4 total is $700. Already paid: $${paidAmount.toFixed(2)}.`)
        const open = await tx.paymentRequest.count({ where: { leadId, purpose, status: 'OPEN' } })
        if (open) throw new Error('Cancel the existing open Level 4 link before creating another')
      }
      return tx.paymentRequest.create({
        data: {
          leadId, createdById: req.user!.userId, purpose,
          description: description ?? (purpose === 'LEVEL_4_INSTALLMENT' ? 'CIPS Level 4 instalment' : null),
          amountUsd: amount, tokenHash: tokenHash(token),
        },
        select: publicSelect,
      })
    })
  } catch (error) {
    if (error instanceof Error && (error.message.startsWith('The Level 4 total') || error.message.startsWith('Cancel the existing'))) {
      return res.status(409).json({ success: false, message: error.message })
    }
    throw error
  }
  const frontend = process.env.FRONTEND_PUBLIC_URL || process.env.FRONTEND_URL || 'http://localhost:3000'
  return res.status(201).json({ success: true, data: { ...payment, url: `${frontend.replace(/\/$/, '')}/pay/${token}` } })
})

router.get('/requests', requireAuth, requireRole('ADMIN', 'MANAGER', 'SALES_PERSON'), async (req, res) => {
  const payments = await prisma.paymentRequest.findMany({
    where: staffScope(req),
    include: { lead: { select: { id: true, firstName: true, lastName: true, email: true } }, createdBy: { select: { name: true } } },
    orderBy: { createdAt: 'desc' }, take: 100,
  })
  return res.json({ success: true, data: payments })
})

router.post('/requests/:id/new-link', requireAuth, requireRole('ADMIN', 'MANAGER', 'SALES_PERSON'), async (req, res) => {
  if (!gatewayConfigured()) return res.status(503).json({ success: false, message: 'Online payment is not configured yet' })
  const id = idSchema.safeParse(req.params.id)
  if (!id.success) return res.status(400).json({ success: false, message: 'Invalid request' })
  const payment = await prisma.paymentRequest.findFirst({ where: { id: id.data, ...staffScope(req) } })
  if (!payment) return res.status(404).json({ success: false, message: 'Request not found' })
  if (payment.status !== 'OPEN') return res.status(409).json({ success: false, message: 'Only open requests can get a new link' })
  const token = randomBytes(32).toString('hex')
  const rotated = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM payment_requests WHERE id = ${payment.id} FOR UPDATE`
    const current = await tx.paymentRequest.findUniqueOrThrow({ where: { id: payment.id } })
    const active = await tx.paymentAttempt.count({ where: { requestId: payment.id, status: 'INITIATED' } })
    if (current.status !== 'OPEN' || active) return false
    await tx.paymentRequest.update({ where: { id: payment.id }, data: { tokenHash: tokenHash(token) } })
    return true
  })
  if (!rotated) return res.status(409).json({ success: false, message: 'Checkout has started or the request is no longer open' })
  const frontend = process.env.FRONTEND_PUBLIC_URL || process.env.FRONTEND_URL || 'http://localhost:3000'
  return res.json({ success: true, data: { url: `${frontend.replace(/\/$/, '')}/pay/${token}` } })
})

router.patch('/requests/:id/cancel', requireAuth, requireRole('ADMIN', 'MANAGER', 'SALES_PERSON'), async (req, res) => {
  const id = idSchema.safeParse(req.params.id)
  if (!id.success) return res.status(400).json({ success: false, message: 'Invalid request' })
  const payment = await prisma.paymentRequest.findFirst({ where: { id: id.data, ...staffScope(req) } })
  if (!payment) return res.status(404).json({ success: false, message: 'Request not found' })
  if (payment.status !== 'OPEN') return res.status(409).json({ success: false, message: 'Only open requests can be cancelled' })
  const activeAttempt = await prisma.paymentAttempt.findFirst({ where: { requestId: payment.id, status: 'INITIATED' } })
  if (activeAttempt) {
    try { await reconcileAttempt(activeAttempt.transactionId) }
    catch { return res.status(502).json({ success: false, message: 'Could not verify the transaction with the gateway' }) }
    const currentAttempt = await prisma.paymentAttempt.findUnique({ where: { id: activeAttempt.id } })
    if (currentAttempt?.status === 'INITIATED') return res.status(409).json({ success: false, message: 'Gateway checkout is still active; wait for it to finish before cancelling' })
    const currentRequest = await prisma.paymentRequest.findUnique({ where: { id: payment.id } })
    if (currentRequest?.status !== 'OPEN') return res.status(409).json({ success: false, message: 'Payment has already been received or needs review' })
  }
  const cancelled = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM payment_requests WHERE id = ${payment.id} FOR UPDATE`
    const active = await tx.paymentAttempt.count({ where: { requestId: payment.id, status: 'INITIATED' } })
    if (active) return false
    const changed = await tx.paymentRequest.updateMany({ where: { id: payment.id, status: 'OPEN' }, data: { status: 'CANCELLED' } })
    return changed.count > 0
  })
  if (!cancelled) return res.status(409).json({ success: false, message: 'Checkout is active or payment status changed' })
  return res.json({ success: true })
})

router.get('/public/:token', async (req, res) => {
  const parsed = tokenSchema.safeParse(req.params.token)
  if (!parsed.success) return res.status(404).json({ success: false, message: 'Payment link not found' })
  const payment = await prisma.paymentRequest.findUnique({
    where: { tokenHash: tokenHash(parsed.data) },
    select: { ...publicSelect, lead: { select: { firstName: true, lastName: true } } },
  })
  if (!payment) return res.status(404).json({ success: false, message: 'Payment link not found' })
  return res.json({ success: true, data: payment })
})

const gatewayBase = () => process.env.SSLCOMMERZ_MODE === 'live'
  ? 'https://securepay.sslcommerz.com'
  : 'https://sandbox.sslcommerz.com'

async function reconcileAttempt(transactionId: string) {
  const query = new URLSearchParams({
    tran_id: transactionId, store_id: process.env.SSLCOMMERZ_STORE_ID || '',
    store_passwd: process.env.SSLCOMMERZ_STORE_PASSWORD || '', format: 'json', v: '1',
  })
  const response = await fetch(`${gatewayBase()}/validator/api/merchantTransIDvalidationAPI.php?${query}`, { signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error('Gateway lookup failed')
  const result = await response.json() as { APIConnect?: string; element?: { status?: string; val_id?: string; tran_id?: string }[] }
  if (result.APIConnect !== 'DONE') throw new Error('Gateway lookup unavailable')
  const transactions = result.element || []
  const valid = transactions.find(item => ['VALID', 'VALIDATED'].includes(item.status || '') && item.val_id && item.tran_id === transactionId)
  if (valid) {
    await validateNotification({ val_id: valid.val_id, tran_id: transactionId })
    return
  }
  if (transactions.length && transactions.every(item => item.status === 'FAILED' || item.status === 'CANCELLED')) {
    await prisma.paymentAttempt.updateMany({ where: { transactionId, status: 'INITIATED' }, data: { status: 'FAILED' } })
  }
}

router.post('/public/:token/start', async (req, res) => {
  const parsed = tokenSchema.safeParse(req.params.token)
  if (!parsed.success) return res.status(404).json({ success: false, message: 'Payment link not found' })
  if (!gatewayConfigured()) {
    return res.status(503).json({ success: false, message: 'Online payment is not configured yet' })
  }
  const storeId = process.env.SSLCOMMERZ_STORE_ID!
  const storePassword = process.env.SSLCOMMERZ_STORE_PASSWORD!
  const backendUrl = process.env.BACKEND_PUBLIC_URL!
  const payment = await prisma.paymentRequest.findUnique({
    where: { tokenHash: tokenHash(parsed.data) },
    include: { lead: { select: { firstName: true, lastName: true, email: true, phone: true, city: true, country: true } }, attempts: { orderBy: { createdAt: 'desc' }, take: 1 } },
  })
  if (!payment) return res.status(404).json({ success: false, message: 'Payment link not found' })
  if (payment.status !== 'OPEN') return res.status(409).json({ success: false, message: 'This payment link is no longer open' })
  const existing = payment.attempts[0]
  if (existing?.status === 'INITIATED') {
    if (!existing.gatewayUrl) return res.status(409).json({ success: false, message: 'Checkout is starting. Please wait a moment.' })
    try { await reconcileAttempt(existing.transactionId) }
    catch { return res.status(502).json({ success: false, message: 'Could not verify the previous checkout. Please try again.' }) }
    const current = await prisma.paymentRequest.findUnique({ where: { id: payment.id } })
    if (current?.status !== 'OPEN') return res.status(409).json({ success: false, message: 'This payment is already complete or under review' })
    const currentAttempt = await prisma.paymentAttempt.findUnique({ where: { id: existing.id } })
    if (currentAttempt?.status === 'INITIATED') return res.json({ success: true, data: { url: existing.gatewayUrl } })
  }
  const transactionId = `LSHS${randomBytes(10).toString('hex')}`
  let attempt
  try {
    attempt = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM payment_requests WHERE id = ${payment.id} FOR UPDATE`
      const current = await tx.paymentRequest.findUniqueOrThrow({ where: { id: payment.id } })
      if (current.status !== 'OPEN' || current.tokenHash !== tokenHash(parsed.data)) throw new Error('Payment link changed')
      const active = await tx.paymentAttempt.count({ where: { requestId: payment.id, status: 'INITIATED' } })
      if (active) throw new Error('Checkout is already active')
      return tx.paymentAttempt.create({ data: { requestId: payment.id, transactionId } })
    })
  }
  catch (error) {
    if ((error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') ||
      (error instanceof Error && ['Payment link changed', 'Checkout is already active'].includes(error.message))) {
      return res.status(409).json({ success: false, message: 'Checkout is already starting. Please try again.' })
    }
    throw error
  }
  const callback = `${backendUrl.replace(/\/$/, '')}/api/payments/callback`
  const form = new URLSearchParams({
    store_id: storeId, store_passwd: storePassword,
    total_amount: payment.amountUsd.toFixed(2), currency: 'USD', tran_id: transactionId,
    success_url: `${callback}/success?token=${parsed.data}`,
    fail_url: `${callback}/fail?token=${parsed.data}`,
    cancel_url: `${callback}/cancel?token=${parsed.data}`,
    ipn_url: `${callback}/ipn`,
    product_name: payment.description || 'LSHS payment', product_category: 'Education',
    product_profile: 'non-physical-goods',
    cus_name: [payment.lead.firstName, payment.lead.lastName].filter(Boolean).join(' '),
    cus_email: payment.lead.email || '', cus_phone: payment.lead.phone || '',
    cus_add1: payment.lead.city || 'Not provided', cus_city: payment.lead.city || 'Not provided',
    cus_country: payment.lead.country || 'Bangladesh',
    shipping_method: 'NO', num_of_item: '1', value_a: payment.id,
  })
  try {
    const response = await fetch(`${gatewayBase()}/gwprocess/v4/api.php`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form, signal: AbortSignal.timeout(15000),
    })
    const result = await response.json() as { status?: string; GatewayPageURL?: string; sessionkey?: string }
    if (!response.ok || result.status !== 'SUCCESS' || !result.GatewayPageURL) throw new Error('Gateway initiation failed')
    const gatewayUrl = new URL(result.GatewayPageURL)
    if (gatewayUrl.protocol !== 'https:' || gatewayUrl.hostname !== new URL(gatewayBase()).hostname) throw new Error('Unexpected gateway URL')
    await prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { gatewayUrl: gatewayUrl.toString(), gatewaySessionKey: result.sessionkey } })
    return res.json({ success: true, data: { url: gatewayUrl.toString() } })
  } catch (error) {
    console.error('Payment session initiation failed', error)
    await prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { status: 'FAILED' } })
    return res.status(502).json({ success: false, message: 'Could not start checkout. Please try again.' })
  }
})

async function validateNotification(body: Record<string, unknown>) {
  const validationId = z.string().min(1).max(100).safeParse(body.val_id)
  const transactionId = z.string().min(1).max(30).safeParse(body.tran_id)
  if (!validationId.success || !transactionId.success) return false
  const attempt = await prisma.paymentAttempt.findUnique({
    where: { transactionId: transactionId.data }, include: { request: true },
  })
  if (!attempt) return false
  if (attempt.status === 'PAID') return true
  const query = new URLSearchParams({
    val_id: validationId.data, store_id: process.env.SSLCOMMERZ_STORE_ID || '',
    store_passwd: process.env.SSLCOMMERZ_STORE_PASSWORD || '', format: 'json', v: '1',
  })
  if (!process.env.SSLCOMMERZ_STORE_ID || !process.env.SSLCOMMERZ_STORE_PASSWORD) return false
  const response = await fetch(`${gatewayBase()}/validator/api/validationserverAPI.php?${query}`, { signal: AbortSignal.timeout(15000) })
  if (!response.ok) return false
  const result = await response.json() as Record<string, unknown>
  if (!['VALID', 'VALIDATED'].includes(String(result.status)) ||
    result.tran_id !== attempt.transactionId || result.val_id !== validationId.data ||
    result.currency_type !== 'USD' ||
    !new Prisma.Decimal(String(result.currency_amount || '0')).equals(attempt.request.amountUsd) ||
    result.value_a !== attempt.requestId) return false
  const risky = String(result.risk_level) !== '0'
  await prisma.$transaction(async (tx) => {
    const current = await tx.paymentRequest.findUniqueOrThrow({ where: { id: attempt.requestId } })
    if (current.status === 'PAID') {
      await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: 'REVIEW', validationId: validationId.data } })
      return
    }
    const needsReview = risky || current.status === 'CANCELLED'
    const changed = await tx.paymentRequest.updateMany({
      where: { id: current.id, status: current.status },
      data: { status: needsReview ? 'REVIEW' : 'PAID', paidAt: needsReview ? null : new Date() },
    })
    if (!changed.count) throw new Error('Payment status changed during validation')
    await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: needsReview ? 'REVIEW' : 'PAID', validationId: validationId.data } })
  })
  return true
}

router.post('/callback/ipn', async (req, res) => {
  try {
    if (req.body?.status !== 'VALID') return res.sendStatus(200)
    return res.sendStatus(await validateNotification(req.body) ? 200 : 400)
  } catch (error) {
    console.error('Payment IPN validation failed', error)
    return res.sendStatus(502)
  }
})

router.all('/callback/:outcome', async (req, res) => {
  const outcome = z.enum(['success', 'fail', 'cancel']).safeParse(req.params.outcome)
  const token = tokenSchema.safeParse(req.query.token)
  if (!outcome.success || !token.success) return res.sendStatus(400)
  const notification = req.method === 'GET' ? req.query : req.body
  if (outcome.data === 'success') {
    try { await validateNotification(notification) }
    catch (error) { console.error('Payment return validation failed', error) }
  } else if (typeof notification?.tran_id === 'string') {
    try { await reconcileAttempt(notification.tran_id) }
    catch (error) { console.error('Payment return lookup failed', error) }
  }
  const frontend = process.env.FRONTEND_PUBLIC_URL || process.env.FRONTEND_URL || 'http://localhost:3000'
  return res.redirect(303, `${frontend.replace(/\/$/, '')}/pay/${token.data}`)
})

export default router
