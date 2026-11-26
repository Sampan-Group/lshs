import { Router, type Request } from 'express'
import { z } from 'zod'
import { prisma as basePrisma } from '../../lib/prisma.js'
import { requireRole } from '../auth/auth.middleware.js'

const prisma = basePrisma as any

const leadFieldsSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().max(100).or(z.literal('')).nullable().optional(),
  phone: z.string().trim().min(1).max(50),
  email: z.string().trim().email().or(z.literal('')).nullable().optional(),
  country: z.string().trim().max(100).or(z.literal('')).nullable().optional(),
  city: z.string().trim().max(100).or(z.literal('')).nullable().optional(),
  company: z.string().trim().max(200).nullable().optional(),
  jobTitle: z.string().trim().max(200).nullable().optional(),
  workExperienceYears: z.coerce.number().int().min(0).max(80).nullable().optional(),
  highestEducation: z.enum(['HIGH_SCHOOL', 'DIPLOMA', 'BACHELORS', 'MASTERS', 'PHD', 'OTHER']).nullable().optional(),
  externalLeadId: z.string().trim().max(200).nullable().optional(),
  sourceId: z.coerce.number().int().positive().optional(),
  assignedToId: z.coerce.number().int().positive().nullable().optional(),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW']).nullable().optional(),
  temperature: z.enum(['HOT', 'WARM', 'COLD']).nullable().optional(),
  quality: z.enum(['TOP_QUALITY', 'HIGH_QUALITY', 'MEDIUM_QUALITY', 'LOW_QUALITY', 'IRRELEVANT']).nullable().optional(),
})

const createLeadSchema = leadFieldsSchema.extend({
  programIds: z.array(z.coerce.number().int().positive()).default([]),
  notes: z.string().trim().max(5000).optional(),
})

const updateLeadSchema = leadFieldsSchema
  .partial()
  .extend({
    stage: z.enum(['NEW', 'INITIAL_CONTACT', 'FOLLOW_UP', 'QUALIFIED', 'INTERESTED', 'APPLICATION', 'BOOKING', 'WON', 'LOST']).optional(),
    status: z.enum(['ACTIVE', 'CONVERTED', 'LOST', 'NO_RESPONSE', 'NOT_INTERESTED', 'INVALID']).optional(),
  })
  .refine((fields) => Object.keys(fields).length > 0, {
    message: 'At least one field must be provided',
  })

const followUpTypeSchema = z.enum(['CALL', 'WHATSAPP', 'EMAIL', 'SMS', 'MEETING', 'OTHER'])
const followUpStatusSchema = z.enum(['PENDING', 'COMPLETED', 'MISSED', 'CANCELLED'])
const followUpListSchema = z.object({
  status: z.enum(['PENDING', 'COMPLETED', 'MISSED', 'CANCELLED', 'OVERDUE']).optional(),
  search: z.string().trim().max(200).default(''),
})
const createFollowUpSchema = z.object({
  type: followUpTypeSchema,
  scheduledAt: z.coerce.date(),
  nextFollowUpAt: z.coerce.date().nullable().optional(),
  assignedToId: z.coerce.number().int().positive().nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
}).refine((fields) => !fields.nextFollowUpAt || fields.nextFollowUpAt > fields.scheduledAt, {
  path: ['nextFollowUpAt'],
  message: 'The next follow-up must be scheduled after this follow-up',
})
const updateFollowUpSchema = z.object({
  type: followUpTypeSchema.optional(),
  scheduledAt: z.coerce.date().optional(),
  nextFollowUpAt: z.coerce.date().nullable().optional(),
  assignedToId: z.coerce.number().int().positive().nullable().optional(),
  status: followUpStatusSchema.optional(),
  outcome: z.string().trim().max(5000).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
}).refine((fields) => Object.keys(fields).length > 0, {
  message: 'At least one follow-up field must be provided',
})

const idSchema = z.coerce.number().int().positive()
const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().max(200).default(''),
  status: z.enum(['ACTIVE', 'CONVERTED', 'LOST', 'NO_RESPONSE', 'NOT_INTERESTED', 'INVALID']).optional(),
  stage: z.enum(['NEW', 'INITIAL_CONTACT', 'FOLLOW_UP', 'QUALIFIED', 'INTERESTED', 'APPLICATION', 'BOOKING', 'WON', 'LOST']).optional(),
  temperature: z.enum(['HOT', 'WARM', 'COLD']).optional(),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  source: z.string().trim().max(100).optional(),
  sortBy: z.enum(['firstName', 'stage', 'status', 'temperature', 'priority', 'source', 'assignedTo', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

const router = Router()

const leadScope = (req: Request) =>
  req.user?.role === 'SALES_PERSON' ? { assignedToId: req.user.userId } : {}

const isSales = (req: Request) => req.user?.role === 'SALES_PERSON'

router.get('/dashboard-summary', async (req, res) => {
  const activeLeads = { deletedAt: null, ...leadScope(req) }
  const [total, hot, newThisWeek, converted, stageCounts, sourceCounts, recentLeads, activities] =
    await Promise.all([
      prisma.lead.count({ where: activeLeads }),
      prisma.lead.count({ where: { ...activeLeads, temperature: 'HOT' } }),
      prisma.lead.count({
        where: {
          ...activeLeads,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.lead.count({ where: { ...activeLeads, status: 'CONVERTED' } }),
      prisma.lead.groupBy({
        by: ['stage'],
        where: activeLeads,
        _count: { _all: true },
      }),
      prisma.lead.groupBy({
        by: ['sourceId'],
        where: { ...activeLeads, sourceId: { not: null } },
        _count: { _all: true },
      }),
      prisma.lead.findMany({
        where: activeLeads,
        include: {
          source: { select: { name: true } },
          assignedTo: { select: { id: true, name: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
      prisma.leadActivity.findMany({
        where: { lead: activeLeads },
        include: {
          user: { select: { name: true } },
          lead: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ])

  const sources = await prisma.leadSource.findMany({
    where: { id: { in: sourceCounts.map((item: { sourceId: number | null }) => item.sourceId).filter(Boolean) } },
    select: { id: true, name: true },
  })
  const sourceNames = new Map(sources.map((source: { id: number; name: string }) => [source.id, source.name]))
  const sourceBreakdown = sourceCounts.map((item: { sourceId: number | null; _count: { _all: number } }) => ({
    name: item.sourceId ? sourceNames.get(item.sourceId) ?? 'Other' : 'Other',
    count: item._count._all,
  }))

  return res.json({
    success: true,
    data: {
      stats: {
        total,
        newThisWeek,
        hot,
        converted,
        conversionRate: total ? Number(((converted / total) * 100).toFixed(1)) : 0,
      },
      pipeline: stageCounts.map((item: { stage: string; _count: { _all: number } }) => ({
        stage: item.stage,
        count: item._count._all,
      })),
      sources: sourceBreakdown,
      recentLeads,
      activities: activities.map((activity: {
        id: number
        type: string
        description: string | null
        durationSeconds: number | null
        createdAt: Date
        user: { name: string } | null
        lead: { id: number; firstName: string; lastName: string | null }
      }) => ({
        id: activity.id,
        type: activity.type,
        description: activity.description ?? 'Activity recorded',
        duration: activity.durationSeconds,
        createdAt: activity.createdAt,
        userName: activity.user?.name ?? 'System',
        leadName: [activity.lead.firstName, activity.lead.lastName].filter(Boolean).join(' '),
        leadId: activity.lead.id,
      })),
    },
  })
})

router.get('/metadata', async (req, res) => {
  const [sources, programs, users] = await Promise.all([
    prisma.leadSource.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.course.findMany({
      where: { isActive: true },
      select: { id: true, title: true, code: true },
      orderBy: { title: 'asc' },
    }),
    prisma.user.findMany({
      where: { isActive: true, role: { in: ['ADMIN', 'MANAGER', 'SALES_PERSON'] }, ...(isSales(req) ? { id: req.user!.userId } : {}) },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    }),
  ])
  return res.json({ success: true, data: { sources, programs, users } })
})

router.post('/', async (req, res) => {
  const parsed = createLeadSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    })
  }

  const { programIds, notes, sourceId, assignedToId, ...leadData } = parsed.data
  if (isSales(req) && assignedToId && assignedToId !== req.user!.userId) {
    return res.status(403).json({ success: false, message: 'You can only assign leads to yourself' })
  }
  const ownerId = isSales(req) || assignedToId === undefined ? req.user!.userId : assignedToId
  if (ownerId) {
    const assignee = await prisma.user.findFirst({
      where: { id: ownerId, isActive: true, role: { in: ['ADMIN', 'MANAGER', 'SALES_PERSON'] } },
      select: { id: true },
    })
    if (!assignee) return res.status(422).json({ success: false, message: 'Choose an active staff member' })
  }
  const lead = await (prisma as any).lead.create({
    data: {
      ...leadData,
      ...(sourceId ? { source: { connect: { id: sourceId } } } : {}),
      ...(ownerId ? { assignedTo: { connect: { id: ownerId } } } : {}),
      ...(ownerId ? { assignments: { create: { assignedToId: ownerId, assignedById: req.user!.userId } } } : {}),
      ...(programIds.length
        ? {
            programInterests: {
              create: programIds.map((courseId) => ({
                course: { connect: { id: courseId } },
              })),
            },
          }
        : {}),
      ...(notes ? { notes: { create: { content: notes, userId: req.user!.userId } } } : {}),
      activities: {
        create: {
          type: 'NOTE',
          description: 'Lead created',
          userId: req.user!.userId,
        },
      },
      stageHistory: {
        create: {
          newStage: 'NEW',
          reason: 'Lead created',
          changedById: req.user!.userId,
        },
      },
      statusHistory: {
        create: {
          newStatus: 'ACTIVE',
          reason: 'Lead created',
          changedById: req.user!.userId,
        },
      },
    },
  })
  return res.status(201).json({
    success: true,
    message: 'Lead created successfully',
    data: lead,
  })
})

router.get('/', async (req, res) => {
  const parsed = paginationSchema.safeParse(req.query)
  if (!parsed.success) {
    return res.status(422).json({
      success: false,
      message: 'Invalid pagination parameters',
      errors: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    })
  }

  const { page, limit, search, status, stage, temperature, priority, source, sortBy, sortOrder } = parsed.data
  const where: Record<string, unknown> = { deletedAt: null, ...leadScope(req) }
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { country: { contains: search, mode: 'insensitive' } },
      { city: { contains: search, mode: 'insensitive' } },
    ]
  }
  if (status) where.status = status
  if (stage) where.stage = stage
  if (temperature) where.temperature = temperature
  if (priority) where.priority = priority
  if (source) where.source = { is: { name: source } }

  const orderBy =
    sortBy === 'source'
      ? { source: { name: sortOrder } }
      : sortBy === 'assignedTo'
        ? { assignedTo: { name: sortOrder } }
        : { [sortBy]: sortOrder }

  const activeLeads = { deletedAt: null, ...leadScope(req) }
  const [leads, total, allLeads, hotLeads, newLeads, convertedLeads, sources] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: {
        source: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true, firstName: true, lastName: true } },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.lead.count({ where }),
    prisma.lead.count({ where: activeLeads }),
    prisma.lead.count({ where: { ...activeLeads, temperature: 'HOT' } }),
    prisma.lead.count({ where: { ...activeLeads, stage: 'NEW' } }),
    prisma.lead.count({ where: { ...activeLeads, status: 'CONVERTED' } }),
    prisma.leadSource.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return res.json({
    success: true,
    data: leads,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    stats: {
      total: allLeads,
      hot: hotLeads,
      new: newLeads,
      converted: convertedLeads,
    },
    sources,
  })
})

router.get('/follow-ups', async (req, res) => {
  const parsed = followUpListSchema.safeParse(req.query)
  if (!parsed.success) {
    return res.status(422).json({
      success: false,
      message: 'Invalid follow-up filters',
      errors: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    })
  }

  const { status, search } = parsed.data
  const accessibleLead = { deletedAt: null, ...leadScope(req) }
  const where: Record<string, unknown> = { lead: accessibleLead }
  if (status === 'OVERDUE') {
    where.status = 'PENDING'
    where.scheduledAt = { lt: new Date() }
  } else if (status === 'PENDING') {
    where.status = 'PENDING'
    where.scheduledAt = { gte: new Date() }
  } else if (status) {
    where.status = status
  }
  if (search) {
    where.AND = [
      {
        OR: [
          { notes: { contains: search, mode: 'insensitive' } },
          { outcome: { contains: search, mode: 'insensitive' } },
          { lead: { firstName: { contains: search, mode: 'insensitive' } } },
          { lead: { lastName: { contains: search, mode: 'insensitive' } } },
          { lead: { email: { contains: search, mode: 'insensitive' } } },
          { lead: { phone: { contains: search, mode: 'insensitive' } } },
        ],
      },
    ]
  }

  const [followUps, pending, overdue, completed, missed] = await Promise.all([
    prisma.leadFollowUp.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, name: true } },
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            stage: true,
            assignedTo: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { scheduledAt: status === 'PENDING' || status === 'OVERDUE' ? 'asc' : 'desc' },
      take: 200,
    }),
    prisma.leadFollowUp.count({
      where: { status: 'PENDING', scheduledAt: { gte: new Date() }, lead: accessibleLead },
    }),
    prisma.leadFollowUp.count({
      where: { status: 'PENDING', scheduledAt: { lt: new Date() }, lead: accessibleLead },
    }),
    prisma.leadFollowUp.count({
      where: { status: 'COMPLETED', lead: accessibleLead },
    }),
    prisma.leadFollowUp.count({
      where: { status: 'MISSED', lead: accessibleLead },
    }),
  ])

  return res.json({
    success: true,
    data: followUps,
    stats: { pending, overdue, completed, missed },
    limit: 200,
  })
})

router.get('/:id', async (req, res) => {
  const parsedId = idSchema.safeParse(req.params.id)
  if (!parsedId.success) {
    return res.status(400).json({
      success: false,
      message: 'Invalid lead ID',
    })
  }

  const lead = await prisma.lead.findFirst({
    where: { id: parsedId.data, deletedAt: null, ...leadScope(req) },
    include: {
      source: true,
      assignedTo: { select: { id: true, name: true, email: true, firstName: true, lastName: true, role: true } },
      programInterests: { include: { course: { select: { id: true, title: true, code: true } } } },
      assignments: {
        include: {
          assignedTo: { select: { name: true } },
          assignedBy: { select: { name: true } },
        },
        orderBy: { assignedAt: 'desc' },
      },
      activities: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      },
      followUps: {
        include: { assignedTo: { select: { id: true, name: true } } },
        orderBy: { scheduledAt: 'asc' },
      },
      notes: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      },
      statusHistory: {
        include: { changedBy: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      },
      stageHistory: {
        include: { changedBy: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
  if (!lead) {
    return res.status(404).json({ success: false, message: 'Lead not found' })
  }

  return res.json({ success: true, data: lead })
})

const updateLead = async (
  req: import('express').Request,
  res: import('express').Response
) => {
  const parsedId = idSchema.safeParse(req.params.id)
  if (!parsedId.success) {
    return res.status(400).json({
      success: false,
      message: 'Invalid lead ID',
    })
  }

  const parsedBody = updateLeadSchema.safeParse(req.body)
  if (!parsedBody.success) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: parsedBody.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    })
  }

  if (isSales(req) && parsedBody.data.assignedToId !== undefined) {
    return res.status(403).json({ success: false, message: 'Only a manager can reassign leads' })
  }
  if (parsedBody.data.assignedToId) {
    const assignee = await prisma.user.findFirst({
      where: { id: parsedBody.data.assignedToId, isActive: true, role: { in: ['ADMIN', 'MANAGER', 'SALES_PERSON'] } },
      select: { id: true },
    })
    if (!assignee) return res.status(422).json({ success: false, message: 'Choose an active staff member' })
  }

  const existingLead = await prisma.lead.findFirst({
    where: { id: parsedId.data, deletedAt: null, ...leadScope(req) },
    select: { id: true, stage: true, status: true, assignedToId: true },
  })
  if (!existingLead) {
    return res.status(404).json({ success: false, message: 'Lead not found' })
  }

  const lead = await prisma.lead.update({
    where: { id: existingLead.id },
    data: parsedBody.data,
  })
  if (parsedBody.data.assignedToId && parsedBody.data.assignedToId !== existingLead.assignedToId) {
    await prisma.leadAssignment.create({
      data: { leadId: existingLead.id, assignedToId: parsedBody.data.assignedToId, assignedById: req.user!.userId },
    })
  }
  if (parsedBody.data.stage && parsedBody.data.stage !== existingLead.stage) {
    await prisma.leadStageHistory.create({
      data: {
        leadId: existingLead.id,
        oldStage: existingLead.stage,
        newStage: parsedBody.data.stage,
        changedById: req.user!.userId,
      },
    })
  }
  if (parsedBody.data.status && parsedBody.data.status !== existingLead.status) {
    await prisma.leadStatusHistory.create({
      data: {
        leadId: existingLead.id,
        oldStatus: existingLead.status,
        newStatus: parsedBody.data.status,
        changedById: req.user!.userId,
      },
    })
  }
  if (parsedBody.data.stage || parsedBody.data.status) {
    await prisma.leadActivity.create({
      data: {
        leadId: existingLead.id,
        type: parsedBody.data.stage ? 'STAGE_CHANGE' : 'STATUS_CHANGE',
        userId: req.user!.userId,
        description: parsedBody.data.stage
          ? `Stage changed to ${parsedBody.data.stage}`
          : `Status changed to ${parsedBody.data.status}`,
      },
    })
  }
  return res.json({
    success: true,
    message: 'Lead updated successfully',
    data: lead,
  })
}

router.put('/:id', updateLead)
router.patch('/:id', updateLead)

router.post('/:id/notes', async (req, res) => {
  const parsedId = idSchema.safeParse(req.params.id)
  const parsedBody = z.object({ content: z.string().trim().min(1).max(5000) }).safeParse(req.body)
  if (!parsedId.success) {
    return res.status(400).json({ success: false, message: 'Invalid lead ID' })
  }
  if (!parsedBody.success) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: parsedBody.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    })
  }
  const lead = await prisma.lead.findFirst({
    where: { id: parsedId.data, deletedAt: null, ...leadScope(req) },
    select: { id: true },
  })
  if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' })
  const note = await prisma.leadNote.create({
    data: { leadId: lead.id, content: parsedBody.data.content, userId: req.user!.userId },
    include: { user: { select: { name: true } } },
  })
  return res.status(201).json({ success: true, data: note })
})

router.post('/:id/follow-ups', async (req, res) => {
  const parsedId = idSchema.safeParse(req.params.id)
  const parsedBody = createFollowUpSchema.safeParse(req.body)
  if (!parsedId.success) {
    return res.status(400).json({ success: false, message: 'Invalid lead ID' })
  }
  if (!parsedBody.success) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: parsedBody.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    })
  }

  const lead = await prisma.lead.findFirst({
    where: { id: parsedId.data, deletedAt: null, ...leadScope(req) },
    select: { id: true },
  })
  if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' })

  if (isSales(req) && parsedBody.data.assignedToId && parsedBody.data.assignedToId !== req.user!.userId) {
    return res.status(403).json({ success: false, message: 'You can only assign follow-ups to yourself' })
  }
  if (!isSales(req) && parsedBody.data.assignedToId) {
    const assignee = await prisma.user.findFirst({
      where: { id: parsedBody.data.assignedToId, isActive: true, role: { in: ['ADMIN', 'MANAGER', 'SALES_PERSON'] } },
      select: { id: true },
    })
    if (!assignee) return res.status(422).json({ success: false, message: 'Choose an active staff member' })
  }

  const followUp = await prisma.$transaction(async (tx: typeof prisma) => {
    const latest = await tx.leadFollowUp.aggregate({
      where: { leadId: lead.id },
      _max: { followUpNumber: true },
    })
    const created = await tx.leadFollowUp.create({
      data: {
        leadId: lead.id,
        followUpNumber: (latest._max.followUpNumber ?? 0) + 1,
        type: parsedBody.data.type,
        scheduledAt: parsedBody.data.scheduledAt,
        nextFollowUpAt: parsedBody.data.nextFollowUpAt ?? null,
        assignedToId: isSales(req) ? req.user!.userId : (parsedBody.data.assignedToId ?? null),
        notes: parsedBody.data.notes || null,
      },
      include: { assignedTo: { select: { id: true, name: true } } },
    })
    await tx.leadActivity.create({
      data: {
        leadId: lead.id,
        type: 'OTHER',
        description: `Follow-up #${created.followUpNumber} scheduled (${created.type})`,
        userId: req.user!.userId,
      },
    })
    return created
  })
  return res.status(201).json({ success: true, data: followUp })
})

router.patch('/:id/follow-ups/:followUpId', async (req, res) => {
  const parsedId = idSchema.safeParse(req.params.id)
  const parsedFollowUpId = idSchema.safeParse(req.params.followUpId)
  const parsedBody = updateFollowUpSchema.safeParse(req.body)
  if (!parsedId.success || !parsedFollowUpId.success) {
    return res.status(400).json({ success: false, message: 'Invalid lead or follow-up ID' })
  }
  if (!parsedBody.success) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: parsedBody.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    })
  }

  const existing = await prisma.leadFollowUp.findFirst({
    where: {
      id: parsedFollowUpId.data,
      leadId: parsedId.data,
      lead: { deletedAt: null, ...leadScope(req) },
    },
  })
  if (!existing) {
    return res.status(404).json({ success: false, message: 'Follow-up not found' })
  }
  if (isSales(req) && parsedBody.data.assignedToId !== undefined && parsedBody.data.assignedToId !== req.user!.userId) {
    return res.status(403).json({ success: false, message: 'You can only assign follow-ups to yourself' })
  }
  if (!isSales(req) && parsedBody.data.assignedToId) {
    const assignee = await prisma.user.findFirst({
      where: { id: parsedBody.data.assignedToId, isActive: true, role: { in: ['ADMIN', 'MANAGER', 'SALES_PERSON'] } },
      select: { id: true },
    })
    if (!assignee) return res.status(422).json({ success: false, message: 'Choose an active staff member' })
  }
  const scheduledAt = parsedBody.data.scheduledAt ?? existing.scheduledAt
  const nextFollowUpAt = parsedBody.data.nextFollowUpAt === undefined
    ? existing.nextFollowUpAt
    : parsedBody.data.nextFollowUpAt
  if (nextFollowUpAt && nextFollowUpAt <= scheduledAt) {
    return res.status(422).json({
      success: false,
      message: 'The next follow-up must be scheduled after this follow-up',
    })
  }

  const data = {
    ...parsedBody.data,
    ...(parsedBody.data.status
      ? { completedAt: parsedBody.data.status === 'COMPLETED' ? new Date() : null }
      : {}),
  }
  const updated = await prisma.$transaction(async (tx: typeof prisma) => {
    const result = await tx.leadFollowUp.update({
      where: { id: existing.id },
      data,
      include: { assignedTo: { select: { id: true, name: true } } },
    })
    const scheduledChanged = parsedBody.data.scheduledAt !== undefined
    const statusChanged = parsedBody.data.status && parsedBody.data.status !== existing.status
    const details = statusChanged
      ? `Follow-up #${result.followUpNumber} marked ${result.status.toLowerCase()}`
      : scheduledChanged
        ? `Follow-up #${result.followUpNumber} rescheduled`
        : `Follow-up #${result.followUpNumber} updated`
    await tx.leadActivity.create({
      data: { leadId: parsedId.data, type: 'OTHER', description: details, userId: req.user!.userId },
    })
    return result
  })

  return res.json({ success: true, data: updated })
})

router.delete('/:id', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const parsedId = idSchema.safeParse(req.params.id)
  if (!parsedId.success) {
    return res.status(400).json({
      success: false,
      message: 'Invalid lead ID',
    })
  }

  const existingLead = await prisma.lead.findFirst({
    where: { id: parsedId.data, deletedAt: null },
    select: { id: true },
  })
  if (!existingLead) {
    return res.status(404).json({ success: false, message: 'Lead not found' })
  }

  await prisma.lead.update({
    where: { id: existingLead.id },
    data: { deletedAt: new Date() },
  })
  return res.json({ success: true, message: 'Lead deleted successfully' })
})

export default router
