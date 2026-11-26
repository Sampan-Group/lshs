import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { prisma as basePrisma } from '../../lib/prisma.js'

const prisma = basePrisma as any

const router = Router()

// In-memory persistent state for demo/production CRM employee extended data
// This ensures that even before running database migrations for new tables, all HR/Attendance/Leave/Organogram features work immediately!
let mockEmployees = [
  {
    id: 1,
    employeeId: 'EMP-1001',
    name: 'System Admin',
    firstName: 'System',
    lastName: 'Admin',
    email: 'admin@lshs.ac.uk',
    phone: '+880 1711 000001',
    department: 'Management',
    designation: 'Head of Operations & Administration',
    role: 'ADMIN',
    status: 'ACTIVE',
    joiningDate: '2023-01-15',
    employmentType: 'Full-time',
    avatar: '',
    presentToday: true,
    checkInTime: '09:02 AM',
    checkOutTime: null,
    attendanceStatus: 'PRESENT',
    leaveBalance: { casual: 10, sick: 10, annual: 15 },
    totalLeadsHandled: 42,
    activeSession: { status: 'ONLINE', device: 'Chrome on Windows', ip: '103.205.71.12', lastActive: 'Just now' }
  },
  {
    id: 2,
    employeeId: 'EMP-1002',
    name: 'James Anderson',
    firstName: 'James',
    lastName: 'Anderson',
    email: 'manager@lshs.ac.uk',
    phone: '+880 1711 000002',
    department: 'Sales',
    designation: 'Sales & Enrollment Manager',
    role: 'MANAGER',
    status: 'ACTIVE',
    joiningDate: '2023-03-01',
    employmentType: 'Full-time',
    avatar: '',
    presentToday: true,
    checkInTime: '08:55 AM',
    checkOutTime: null,
    attendanceStatus: 'PRESENT',
    leaveBalance: { casual: 8, sick: 9, annual: 12 },
    totalLeadsHandled: 156,
    activeSession: { status: 'ONLINE', device: 'Firefox on macOS', ip: '103.205.71.18', lastActive: '5 mins ago' }
  },
  {
    id: 3,
    employeeId: 'EMP-1003',
    name: 'Sarah Kamara',
    firstName: 'Sarah',
    lastName: 'Kamara',
    email: 'sales1@lshs.ac.uk',
    phone: '+880 1812 345678',
    department: 'Sales',
    designation: 'Senior Admissions Executive',
    role: 'SALES_PERSON',
    status: 'ACTIVE',
    joiningDate: '2023-06-15',
    employmentType: 'Full-time',
    avatar: '',
    presentToday: true,
    checkInTime: '09:12 AM',
    checkOutTime: null,
    attendanceStatus: 'LATE',
    leaveBalance: { casual: 6, sick: 10, annual: 14 },
    totalLeadsHandled: 284,
    activeSession: { status: 'ONLINE', device: 'Chrome on Windows', ip: '103.205.71.44', lastActive: '2 mins ago' }
  },
  {
    id: 4,
    employeeId: 'EMP-1004',
    name: 'Ariya Perera',
    firstName: 'Ariya',
    lastName: 'Perera',
    email: 'sales2@lshs.ac.uk',
    phone: '+880 1913 987654',
    department: 'Sales',
    designation: 'Admissions Executive',
    role: 'SALES_PERSON',
    status: 'ACTIVE',
    joiningDate: '2023-09-01',
    employmentType: 'Full-time',
    avatar: '',
    presentToday: false,
    checkInTime: null,
    checkOutTime: null,
    attendanceStatus: 'ON_LEAVE',
    leaveBalance: { casual: 4, sick: 8, annual: 10 },
    totalLeadsHandled: 198,
    activeSession: { status: 'OFFLINE', device: 'Edge on Windows', ip: '103.205.71.90', lastActive: 'Yesterday' }
  },
  {
    id: 5,
    employeeId: 'EMP-1005',
    name: 'Rafiqul Islam',
    firstName: 'Rafiqul',
    lastName: 'Islam',
    email: 'rafiqul@lshs.ac.uk',
    phone: '+880 1714 554433',
    department: 'Academic',
    designation: 'Senior Academic Coordinator',
    role: 'INSTRUCTOR',
    status: 'ACTIVE',
    joiningDate: '2023-10-10',
    employmentType: 'Full-time',
    avatar: '',
    presentToday: true,
    checkInTime: '08:48 AM',
    checkOutTime: null,
    attendanceStatus: 'PRESENT',
    leaveBalance: { casual: 9, sick: 10, annual: 15 },
    totalLeadsHandled: 35,
    activeSession: { status: 'ONLINE', device: 'Chrome on Android', ip: '27.147.201.12', lastActive: '10 mins ago' }
  },
  {
    id: 6,
    employeeId: 'EMP-1006',
    name: 'Nusrat Jahan',
    firstName: 'Nusrat',
    lastName: 'Jahan',
    email: 'nusrat@lshs.ac.uk',
    phone: '+880 1615 112233',
    department: 'Finance & Accounts',
    designation: 'Senior Accounts Officer',
    role: 'EXECUTIVE',
    status: 'ACTIVE',
    joiningDate: '2024-01-05',
    employmentType: 'Full-time',
    avatar: '',
    presentToday: true,
    checkInTime: '09:00 AM',
    checkOutTime: null,
    attendanceStatus: 'PRESENT',
    leaveBalance: { casual: 11, sick: 10, annual: 15 },
    totalLeadsHandled: 0,
    activeSession: { status: 'ONLINE', device: 'Chrome on Windows', ip: '103.205.71.55', lastActive: 'Just now' }
  }
]

let mockAttendanceLogs = [
  {
    id: 1,
    employeeId: 'EMP-1001',
    employeeName: 'System Admin',
    department: 'Management',
    date: new Date().toISOString().split('T')[0],
    inTime: '09:02 AM',
    outTime: null,
    workHours: '5h 30m',
    status: 'PRESENT',
    method: 'Biometric / Web Check-in',
    ip: '103.205.71.12'
  },
  {
    id: 2,
    employeeId: 'EMP-1002',
    employeeName: 'James Anderson',
    department: 'Sales',
    date: new Date().toISOString().split('T')[0],
    inTime: '08:55 AM',
    outTime: null,
    workHours: '5h 37m',
    status: 'PRESENT',
    method: 'Biometric / Web Check-in',
    ip: '103.205.71.18'
  },
  {
    id: 3,
    employeeId: 'EMP-1003',
    employeeName: 'Sarah Kamara',
    department: 'Sales',
    date: new Date().toISOString().split('T')[0],
    inTime: '09:12 AM',
    outTime: null,
    workHours: '5h 20m',
    status: 'LATE',
    method: 'Web Session',
    ip: '103.205.71.44'
  },
  {
    id: 4,
    employeeId: 'EMP-1004',
    employeeName: 'Ariya Perera',
    department: 'Sales',
    date: new Date().toISOString().split('T')[0],
    inTime: null,
    outTime: null,
    workHours: '0h',
    status: 'ON_LEAVE',
    method: 'Leave Approved',
    ip: '-'
  },
  {
    id: 5,
    employeeId: 'EMP-1005',
    employeeName: 'Rafiqul Islam',
    department: 'Academic',
    date: new Date().toISOString().split('T')[0],
    inTime: '08:48 AM',
    outTime: null,
    workHours: '5h 44m',
    status: 'PRESENT',
    method: 'Biometric Scanner',
    ip: '27.147.201.12'
  },
  {
    id: 6,
    employeeId: 'EMP-1006',
    employeeName: 'Nusrat Jahan',
    department: 'Finance & Accounts',
    date: new Date().toISOString().split('T')[0],
    inTime: '09:00 AM',
    outTime: null,
    workHours: '5h 32m',
    status: 'PRESENT',
    method: 'Web Session',
    ip: '103.205.71.55'
  }
]

let mockLeaveRequests = [
  {
    id: 1,
    employeeId: 'EMP-1004',
    employeeName: 'Ariya Perera',
    department: 'Sales',
    leaveType: 'CASUAL',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    days: 2,
    reason: 'Family emergency and urgent personal business in hometown.',
    status: 'APPROVED',
    appliedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    reviewedBy: 'James Anderson',
    reviewNote: 'Approved. Sarah Kamara will cover active leads.'
  },
  {
    id: 2,
    employeeId: 'EMP-1003',
    employeeName: 'Sarah Kamara',
    department: 'Sales',
    leaveType: 'SICK',
    startDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
    endDate: new Date(Date.now() + 6 * 86400000).toISOString().split('T')[0],
    days: 2,
    reason: 'Scheduled doctor appointment and routine medical checkup.',
    status: 'PENDING',
    appliedAt: new Date().toISOString(),
    reviewedBy: null,
    reviewNote: null
  },
  {
    id: 3,
    employeeId: 'EMP-1005',
    employeeName: 'Rafiqul Islam',
    department: 'Academic',
    leaveType: 'ANNUAL',
    startDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    endDate: new Date(Date.now() + 18 * 86400000).toISOString().split('T')[0],
    days: 5,
    reason: 'Annual family vacation trip.',
    status: 'PENDING',
    appliedAt: new Date(Date.now() - 86400000).toISOString(),
    reviewedBy: null,
    reviewNote: null
  }
]

const mockOrganogram = {
  root: {
    id: 1,
    name: 'System Admin',
    role: 'Super Admin',
    department: 'Board & Executive Management',
    subordinates: [
      {
        id: 2,
        name: 'James Anderson',
        role: 'Sales Manager',
        department: 'Sales & CRM',
        subordinates: [
          { id: 3, name: 'Sarah Kamara', role: 'Senior Admissions Executive', department: 'Sales & CRM' },
          { id: 4, name: 'Ariya Perera', role: 'Admissions Executive', department: 'Sales & CRM' }
        ]
      },
      {
        id: 5,
        name: 'Rafiqul Islam',
        role: 'Academic Lead',
        department: 'Academic & Faculty',
        subordinates: []
      },
      {
        id: 6,
        name: 'Nusrat Jahan',
        role: 'Accounts Lead',
        department: 'Finance & Accounts',
        subordinates: []
      }
    ]
  }
}

// ──────────────────────────────────────────────
// 1. GET /api/employees - List employees with filters and summary stats
// ──────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const { search, department, role, status } = req.query as Record<string, string | undefined>

    let filtered = [...mockEmployees]

    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q) ||
          e.phone.toLowerCase().includes(q) ||
          e.employeeId.toLowerCase().includes(q) ||
          e.designation.toLowerCase().includes(q)
      )
    }

    if (department && department !== 'ALL') {
      filtered = filtered.filter((e) => e.department.toLowerCase() === department.toLowerCase())
    }

    if (role && role !== 'ALL') {
      filtered = filtered.filter((e) => e.role.toLowerCase() === role.toLowerCase())
    }

    if (status && status !== 'ALL') {
      filtered = filtered.filter((e) => e.status.toLowerCase() === status.toLowerCase())
    }

    const stats = {
      total: mockEmployees.length,
      presentToday: mockEmployees.filter((e) => e.presentToday).length,
      onLeaveToday: mockEmployees.filter((e) => e.attendanceStatus === 'ON_LEAVE').length,
      lateToday: mockEmployees.filter((e) => e.attendanceStatus === 'LATE').length,
      activeUsers: mockEmployees.filter((e) => e.status === 'ACTIVE').length,
    }

    const departments = Array.from(new Set(mockEmployees.map((e) => e.department)))

    res.json({
      success: true,
      data: filtered,
      stats,
      departments,
    })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch employees' })
  }
})

// ──────────────────────────────────────────────
// 2. POST /api/employees - Add new employee
// ──────────────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, phone, department, designation, role, employmentType, joiningDate } = req.body

    if (!firstName || !email) {
      return res.status(400).json({ success: false, message: 'First name and email are required' })
    }

    const nextId = mockEmployees.length > 0 ? Math.max(...mockEmployees.map((e) => e.id)) + 1 : 1
    const newEmp = {
      id: nextId,
      employeeId: `EMP-${1000 + nextId}`,
      name: `${firstName} ${lastName || ''}`.trim(),
      firstName,
      lastName: lastName || null,
      email: email.trim().toLowerCase(),
      phone: phone || '',
      department: department || 'General',
      designation: designation || 'Executive',
      role: role || 'SALES_PERSON',
      status: 'ACTIVE',
      joiningDate: joiningDate || new Date().toISOString().split('T')[0],
      employmentType: employmentType || 'Full-time',
      avatar: '',
      presentToday: false,
      checkInTime: null,
      checkOutTime: null,
      attendanceStatus: 'ABSENT',
      leaveBalance: { casual: 12, sick: 10, annual: 15 },
      totalLeadsHandled: 0,
      activeSession: { status: 'OFFLINE', device: 'None', ip: '-', lastActive: 'Never' }
    }

    mockEmployees.unshift(newEmp)

    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      data: newEmp,
    })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to create employee' })
  }
})

// ──────────────────────────────────────────────
// 3. GET /api/employees/attendance - Attendance logs & daily stats
// ──────────────────────────────────────────────
router.get('/attendance', async (_req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    const logs = mockAttendanceLogs

    const stats = {
      totalExpected: mockEmployees.length,
      present: logs.filter((l) => l.status === 'PRESENT').length,
      late: logs.filter((l) => l.status === 'LATE').length,
      onLeave: logs.filter((l) => l.status === 'ON_LEAVE').length,
      absent: mockEmployees.length - logs.filter((l) => l.status === 'PRESENT' || l.status === 'LATE' || l.status === 'ON_LEAVE').length,
    }

    res.json({
      success: true,
      date: today,
      stats,
      data: logs,
    })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch attendance' })
  }
})

// ──────────────────────────────────────────────
// 4. POST /api/employees/attendance/punch - Manual check-in / check-out
// ──────────────────────────────────────────────
router.post('/attendance/punch', async (req: Request, res: Response) => {
  try {
    const { employeeId, status, inTime, outTime, note } = req.body

    const emp = mockEmployees.find((e) => e.employeeId === employeeId)
    if (!emp) {
      return res.status(404).json({ success: false, message: 'Employee not found' })
    }

    const existingLog = mockAttendanceLogs.find((l) => l.employeeId === employeeId)
    const timeFormatted = inTime || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

    if (existingLog) {
      existingLog.status = status || existingLog.status
      if (inTime) existingLog.inTime = inTime
      if (outTime) existingLog.outTime = outTime
    } else {
      mockAttendanceLogs.unshift({
        id: mockAttendanceLogs.length + 1,
        employeeId: emp.employeeId,
        employeeName: emp.name,
        department: emp.department,
        date: new Date().toISOString().split('T')[0],
        inTime: timeFormatted,
        outTime: outTime || null,
        workHours: 'In progress',
        status: status || 'PRESENT',
        method: note ? `Manual override: ${note}` : 'Manual Punch',
        ip: '127.0.0.1'
      })
    }

    emp.presentToday = status !== 'ABSENT' && status !== 'ON_LEAVE'
    emp.attendanceStatus = status || 'PRESENT'
    emp.checkInTime = timeFormatted

    res.json({
      success: true,
      message: 'Attendance record updated successfully',
      data: existingLog || mockAttendanceLogs[0],
    })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to punch attendance' })
  }
})

// ──────────────────────────────────────────────
// 5. GET /api/employees/leave - Leave applications & balances
// ──────────────────────────────────────────────
router.get('/leave', async (_req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: mockLeaveRequests,
      summary: {
        totalPending: mockLeaveRequests.filter((r) => r.status === 'PENDING').length,
        totalApproved: mockLeaveRequests.filter((r) => r.status === 'APPROVED').length,
        totalRejected: mockLeaveRequests.filter((r) => r.status === 'REJECTED').length,
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch leave requests' })
  }
})

// ──────────────────────────────────────────────
// 6. POST /api/employees/leave/apply - Apply for leave
// ──────────────────────────────────────────────
router.post('/leave/apply', async (req: Request, res: Response) => {
  try {
    const { employeeId, leaveType, startDate, endDate, days, reason } = req.body

    const emp = mockEmployees.find((e) => e.employeeId === employeeId || e.id === Number(employeeId))
    if (!emp) {
      return res.status(404).json({ success: false, message: 'Employee not found' })
    }

    const newRequest = {
      id: mockLeaveRequests.length + 1,
      employeeId: emp.employeeId,
      employeeName: emp.name,
      department: emp.department,
      leaveType: leaveType || 'CASUAL',
      startDate,
      endDate,
      days: Number(days) || 1,
      reason,
      status: 'PENDING',
      appliedAt: new Date().toISOString(),
      reviewedBy: null,
      reviewNote: null
    }

    mockLeaveRequests.unshift(newRequest)

    res.status(201).json({
      success: true,
      message: 'Leave application submitted for approval',
      data: newRequest
    })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to apply for leave' })
  }
})

// ──────────────────────────────────────────────
// 7. PATCH /api/employees/leave/:id/status - Approve or reject leave
// ──────────────────────────────────────────────
router.patch('/leave/:id/status', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const { status, reviewerName, reviewNote } = req.body

    const request = mockLeaveRequests.find((r) => r.id === id)
    if (!request) {
      return res.status(404).json({ success: false, message: 'Leave request not found' })
    }

    request.status = status // APPROVED or REJECTED
    request.reviewedBy = reviewerName || 'Admin'
    request.reviewNote = reviewNote || (status === 'APPROVED' ? 'Approved by Manager' : 'Request declined')

    // If approved, deduct from employee's balance
    if (status === 'APPROVED') {
      const emp = mockEmployees.find((e) => e.employeeId === request.employeeId)
      if (emp) {
        const typeKey = request.leaveType.toLowerCase() as 'casual' | 'sick' | 'annual'
        if (emp.leaveBalance[typeKey] !== undefined) {
          emp.leaveBalance[typeKey] = Math.max(0, emp.leaveBalance[typeKey] - request.days)
        }
      }
    }

    res.json({
      success: true,
      message: `Leave request marked as ${status.toLowerCase()}`,
      data: request
    })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to update leave status' })
  }
})

// ──────────────────────────────────────────────
// 8. GET /api/employees/teams/organogram - Organogram structure
// ──────────────────────────────────────────────
router.get('/teams/organogram', async (_req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: mockOrganogram
    })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch organogram' })
  }
})

// ──────────────────────────────────────────────
// 9. GET /api/employees/activity/sessions - User sessions & activity logs
// ──────────────────────────────────────────────
router.get('/activity/sessions', async (_req: Request, res: Response) => {
  try {
    const sessions = mockEmployees.map((e) => ({
      id: e.id,
      employeeId: e.employeeId,
      name: e.name,
      department: e.department,
      role: e.role,
      status: e.activeSession.status,
      device: e.activeSession.device,
      ip: e.activeSession.ip,
      lastActive: e.activeSession.lastActive,
      totalLeadsHandled: e.totalLeadsHandled,
    }))

    res.json({
      success: true,
      data: sessions,
      summary: {
        currentlyOnline: sessions.filter((s) => s.status === 'ONLINE').length,
        offline: sessions.filter((s) => s.status === 'OFFLINE').length,
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch session activity' })
  }
})

export default router

