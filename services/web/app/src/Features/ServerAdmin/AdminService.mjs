import http from 'node:http'
import logger from '@overleaf/logger'
import redis from '@overleaf/redis-wrapper'
import Settings from '@overleaf/settings'
import crypto from 'node:crypto'
import mongodb from 'mongodb-legacy'
import AsyncLocalStorage from '../../infrastructure/AsyncLocalStorage.mjs'
import mongoose from '../../infrastructure/Mongoose.mjs'
import { sanitizeControlCharacters } from '../../infrastructure/Sanitize.mjs'
import { SystemMessage } from '../../models/SystemMessage.mjs'
import { Project } from '../../models/Project.mjs'
import { User } from '../../models/User.mjs'
import AuthenticationManager from '../Authentication/AuthenticationManager.mjs'
import ProjectAccessPolicyService from '../Authorization/ProjectAccessPolicyService.mjs'
import EditorRealTimeController from '../Editor/EditorRealTimeController.mjs'
import EmailHelper from '../Helpers/EmailHelper.mjs'
import OneTimeTokenHandler from '../Security/OneTimeTokenHandler.mjs'
import SystemMessageManager from '../SystemMessages/SystemMessageManager.mjs'
import UserDeleter from '../User/UserDeleter.mjs'
import UserGetter from '../User/UserGetter.mjs'
import UserRegistrationHandler from '../User/UserRegistrationHandler.mjs'
import UserSessionsManager from '../User/UserSessionsManager.mjs'
import { splitFullName } from '../../../../modules/launchpad/app/src/LaunchpadController.mjs'

const LOCAL_SYNC_SOCKET =
  process.env.LOCAL_SYNC_SOCKET_PATH || '/run/overleaf-local-sync/sync.sock'
const PACKAGE_HUB_SOCKET =
  process.env.PACKAGE_HUB_SOCKET_PATH || '/run/overleaf-package-hub/hub.sock'

function createServiceError(message, statusCode = 400) {
  const err = new Error(message)
  err.statusCode = statusCode
  return err
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function formatUserSummary(userDoc, projectCount = 0) {
  const firstName = userDoc.first_name || ''
  const lastName = userDoc.last_name || ''
  const fullName = [firstName, lastName].filter(Boolean).join(' ')
  return {
    id: String(userDoc._id),
    email: userDoc.email,
    first_name: firstName,
    last_name: lastName,
    fullName,
    role: userDoc.role || '',
    institution: userDoc.institution || '',
    isAdmin: Boolean(userDoc.isAdmin),
    suspended: Boolean(userDoc.suspended),
    loginCount: Number(userDoc.loginCount || 0),
    signUpDate: userDoc.signUpDate || null,
    lastLoggedIn: userDoc.lastLoggedIn || null,
    lastActive: userDoc.lastActive || null,
    projectCount,
  }
}

async function probeUnixSocketHealth(socketPath, timeoutMs = 2000) {
  const startedAt = Date.now()
  return await new Promise(resolve => {
    const req = http.request(
      {
        socketPath,
        path: '/health',
        method: 'GET',
        timeout: timeoutMs,
      },
      res => {
        const chunks = []
        res.on('data', chunk => chunks.push(chunk))
        res.on('end', () => {
          const latencyMs = Date.now() - startedAt
          try {
            const raw = Buffer.concat(chunks).toString('utf8')
            const data = raw ? JSON.parse(raw) : {}
            resolve({
              ok: res.statusCode === 200 && Boolean(data?.ok ?? true),
              latencyMs,
              statusCode: res.statusCode,
              data,
            })
          } catch {
            resolve({
              ok: false,
              latencyMs,
              error: 'Invalid JSON response from service health endpoint',
            })
          }
        })
      }
    )

    req.on('timeout', () => {
      req.destroy(new Error('Health check timed out'))
    })
    req.on('error', err => {
      resolve({
        ok: false,
        latencyMs: Date.now() - startedAt,
        error: err?.code || err?.message || 'Service unavailable',
      })
    })
    req.end()
  })
}

async function probeRedisHealth(timeoutMs = 2000) {
  const startedAt = Date.now()
  const rclient = redis.createClient(Settings.redis.web)
  let timeoutId
  try {
    await Promise.race([
      rclient.ping(),
      new Promise((_resolve, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('Redis health check timed out')),
          timeoutMs
        )
      }),
    ])
    return { ok: true, latencyMs: Date.now() - startedAt }
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: err?.message || 'Redis check failed',
    }
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
    try {
      await rclient.disconnect()
    } catch {
      // ignore disconnect errors during health probe
    }
  }
}

async function probeMongoHealth() {
  const startedAt = Date.now()
  try {
    if (mongoose.connection.readyState !== 1) {
      return { ok: false, error: 'MongoDB disconnected' }
    }
    await mongoose.connection.db?.admin().ping()
    return { ok: true, latencyMs: Date.now() - startedAt }
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: err?.message || 'MongoDB ping failed',
    }
  }
}

async function listSystemMessages() {
  const messages = await SystemMessageManager.promises.getMessagesFromDB()
  return messages.map(m => ({
    id: String(m._id),
    content: m.content || '',
  }))
}

async function getSystemOverview() {
  const [
    totalUsers,
    adminUsers,
    suspendedUsers,
    totalProjects,
    enterpriseSharedProjects,
    userSharedProjects,
    systemMessages,
    mongodb,
    redisHealth,
    localSync,
    packageHub,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ isAdmin: true }),
    User.countDocuments({ suspended: true }),
    Project.countDocuments({}),
    Project.countDocuments({
      'enterpriseAccess.scope': { $in: ['network', 'all_users', 'custom'] },
    }),
    Project.countDocuments({
      $or: [
        { 'collaberator_refs.0': { $exists: true } },
        { 'readOnly_refs.0': { $exists: true } },
        { 'reviewer_refs.0': { $exists: true } },
      ],
    }),
    listSystemMessages(),
    probeMongoHealth(),
    probeRedisHealth(),
    probeUnixSocketHealth(LOCAL_SYNC_SOCKET),
    probeUnixSocketHealth(PACKAGE_HUB_SOCKET),
  ])

  const smtpConfigured = Boolean(
    Settings.email?.fromAddress &&
      (Settings.email?.parameters || Settings.email?.driver)
  )

  const packageHubEnabled =
    Settings.enablePackageHub !== false &&
    process.env.OVERLEAF_ENABLE_PACKAGE_HUB !== 'false'

  return {
    editor: {
      isOpen: Settings.editorIsOpen !== false,
    },
    services: {
      mongodb,
      redis: redisHealth,
      localSync,
      packageHub,
    },
    counts: {
      totalUsers,
      adminUsers,
      suspendedUsers,
      totalProjects,
      enterpriseSharedProjects,
      userSharedProjects,
    },
    runtime: {
      appName: Settings.appName || 'Overleaf',
      env: Settings.env || process.env.NODE_ENV || 'production',
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptimeSeconds: Math.floor(process.uptime()),
      smtpConfigured,
      packageHubEnabled,
    },
    systemMessages,
  }
}

async function createSystemMessage(rawContent) {
  if (typeof rawContent !== 'string') {
    throw createServiceError('Announcement message text is required', 400)
  }
  const content = sanitizeControlCharacters(rawContent).trim()
  if (!content) {
    throw createServiceError('Announcement message cannot be empty', 400)
  }
  if (content.length > 500) {
    throw createServiceError(
      'Announcement message must be 500 characters or fewer',
      400
    )
  }
  await SystemMessageManager.promises.createMessage(content)
  return await listSystemMessages()
}

async function deleteSystemMessage(messageId) {
  const result = await SystemMessage.deleteOne({ _id: messageId }).exec()
  if (!result || result.deletedCount === 0) {
    throw createServiceError('Announcement not found', 404)
  }
  await SystemMessageManager.promises.notifyOtherPods()
  await SystemMessageManager.promises.refreshCache()
  return await listSystemMessages()
}

async function clearSystemMessages() {
  await SystemMessageManager.promises.clearMessages()
  return []
}

function setEditorOpen(isOpen) {
  Settings.editorIsOpen = Boolean(isOpen)
  logger.warn({ isOpen: Settings.editorIsOpen }, 'admin toggled editor status')
  return { isOpen: Settings.editorIsOpen }
}

function disconnectAllUsers(rawDelay = 10) {
  const parsedDelay = Number(rawDelay)
  const delay = Number.isFinite(parsedDelay)
    ? Math.min(300, Math.max(1, Math.round(parsedDelay)))
    : 10
  logger.warn({ delay }, 'admin disconnecting all active editor sessions')
  EditorRealTimeController.emitToAll(
    'forceDisconnect',
    'The administrator is performing maintenance on the editor. Please refresh the page shortly to continue.',
    delay
  )
  return { delay }
}

async function listUsers({
  search = '',
  filter = 'all',
  page = 1,
  limit = 25,
} = {}) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25))
  const safePage = Math.max(1, Number(page) || 1)
  const trimmedSearch =
    typeof search === 'string'
      ? sanitizeControlCharacters(search).trim().slice(0, 120)
      : ''

  const query = {}
  if (trimmedSearch) {
    const regex = new RegExp(escapeRegex(trimmedSearch), 'i')
    query.$or = [
      { email: regex },
      { first_name: regex },
      { last_name: regex },
      { role: regex },
      { institution: regex },
    ]
  }

  if (filter === 'admins') {
    query.isAdmin = true
  } else if (filter === 'suspended') {
    query.suspended = true
  } else if (filter === 'active') {
    query.suspended = { $ne: true }
  }

  const total = await User.countDocuments(query)
  const totalPages = Math.max(1, Math.ceil(total / safeLimit))
  const clampedPage = Math.min(safePage, totalPages)
  const skip = (clampedPage - 1) * safeLimit

  const docs = await User.find(query, {
    _id: 1,
    email: 1,
    first_name: 1,
    last_name: 1,
    role: 1,
    institution: 1,
    isAdmin: 1,
    suspended: 1,
    loginCount: 1,
    signUpDate: 1,
    lastLoggedIn: 1,
    lastActive: 1,
  })
    .sort({ isAdmin: -1, signUpDate: -1 })
    .skip(skip)
    .limit(safeLimit)
    .lean()

  const userIds = docs.map(d => d._id)
  const projectCounts = new Map()
  if (userIds.length > 0) {
    const countsAgg = await Project.aggregate([
      { $match: { owner_ref: { $in: userIds } } },
      { $group: { _id: '$owner_ref', count: { $sum: 1 } } },
    ])
    for (const row of countsAgg) {
      projectCounts.set(String(row._id), Number(row.count || 0))
    }
  }

  return {
    users: docs.map(doc =>
      formatUserSummary(doc, projectCounts.get(String(doc._id)) || 0)
    ),
    total,
    page: clampedPage,
    limit: safeLimit,
    totalPages,
  }
}

async function createUser({
  email,
  password,
  fullName,
  firstName,
  lastName,
  role,
  institution,
  isAdmin = false,
}) {
  const normalizedEmail = EmailHelper.parseEmail(String(email || '').trim())
  if (!normalizedEmail) {
    throw createServiceError('Please enter a valid email address', 400)
  }

  const invalidEmail = AuthenticationManager.validateEmail(normalizedEmail)
  if (invalidEmail) {
    throw createServiceError(
      invalidEmail.message || 'Please enter a valid email address',
      400
    )
  }

  const existing = await UserGetter.promises.getUserByAnyEmail(normalizedEmail)
  if (existing && existing.holdingAccount === false) {
    throw createServiceError('A user with this email already exists', 409)
  }

  const parsedName = splitFullName(fullName, firstName, lastName)
  const cleanRole =
    typeof role === 'string'
      ? sanitizeControlCharacters(role).trim().slice(0, 120)
      : ''
  const cleanInstitution =
    typeof institution === 'string'
      ? sanitizeControlCharacters(institution).trim().slice(0, 160)
      : ''

  let user
  let activationUrl = null

  if (typeof password === 'string' && password.length > 0) {
    const invalidPassword = AuthenticationManager.validatePassword(
      password,
      normalizedEmail
    )
    if (invalidPassword) {
      throw createServiceError(
        invalidPassword.message || 'Password does not meet security policy',
        400
      )
    }
    user = await UserRegistrationHandler.promises.registerNewUser({
      email: normalizedEmail,
      password,
      ...(parsedName.first_name ? { first_name: parsedName.first_name } : {}),
      ...(parsedName.last_name ? { last_name: parsedName.last_name } : {}),
      analyticsId: crypto.randomUUID(),
    })
  } else {
    const regResult =
      await UserRegistrationHandler.promises.registerNewUserAndSendActivationEmail(
        normalizedEmail
      )
    user = regResult.user
    activationUrl = regResult.setNewPasswordUrl || null
  }

  const reversedHostname = user.email
    .split('@')[1]
    .split('')
    .reverse()
    .join('')

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        isAdmin: Boolean(isAdmin),
        first_name: parsedName.first_name || user.first_name || '',
        last_name: parsedName.last_name || '',
        role: cleanRole,
        institution: cleanInstitution,
        emails: [{ email: user.email, reversedHostname }],
      },
    }
  ).exec()

  const saved = await User.findById(user._id, {
    _id: 1,
    email: 1,
    first_name: 1,
    last_name: 1,
    role: 1,
    institution: 1,
    isAdmin: 1,
    suspended: 1,
    loginCount: 1,
    signUpDate: 1,
    lastLoggedIn: 1,
    lastActive: 1,
  }).lean()

  return {
    user: formatUserSummary(saved, 0),
    activationUrl,
  }
}

async function updateUser(targetUserId, actingAdminId, updates = {}) {
  const user = await User.findById(targetUserId).exec()
  if (!user) {
    throw createServiceError('User not found', 404)
  }

  const isSelf = String(targetUserId) === String(actingAdminId)
  if (isSelf && updates.isAdmin === false) {
    throw createServiceError(
      'You cannot remove your own administrator privileges',
      400
    )
  }
  if (isSelf && updates.suspended === true) {
    throw createServiceError('You cannot suspend your own account', 400)
  }

  const nextIsAdmin =
    typeof updates.isAdmin === 'boolean' ? updates.isAdmin : Boolean(user.isAdmin)
  const nextSuspended =
    typeof updates.suspended === 'boolean'
      ? updates.suspended
      : Boolean(user.suspended)

  const wasActiveAdmin = Boolean(user.isAdmin) && !user.suspended
  const willBeActiveAdmin = nextIsAdmin && !nextSuspended
  if (wasActiveAdmin && !willBeActiveAdmin) {
    const otherActiveAdmins = await User.countDocuments({
      _id: { $ne: user._id },
      isAdmin: true,
      suspended: { $ne: true },
    })
    if (otherActiveAdmins === 0) {
      throw createServiceError(
        'Cannot demote or suspend the last active administrator',
        409
      )
    }
  }

  if (typeof updates.first_name === 'string') {
    user.first_name = sanitizeControlCharacters(updates.first_name)
      .trim()
      .slice(0, 255)
  }
  if (typeof updates.last_name === 'string') {
    user.last_name = sanitizeControlCharacters(updates.last_name)
      .trim()
      .slice(0, 255)
  }
  if (typeof updates.role === 'string') {
    user.role = sanitizeControlCharacters(updates.role).trim().slice(0, 120)
  }
  if (typeof updates.institution === 'string') {
    user.institution = sanitizeControlCharacters(updates.institution)
      .trim()
      .slice(0, 160)
  }
  if (typeof updates.isAdmin === 'boolean') {
    user.isAdmin = updates.isAdmin
  }
  if (typeof updates.suspended === 'boolean') {
    user.suspended = updates.suspended
  }

  if (typeof updates.password === 'string' && updates.password.length > 0) {
    const invalidPassword = AuthenticationManager.validatePassword(
      updates.password,
      user.email
    )
    if (invalidPassword) {
      throw createServiceError(
        invalidPassword.message || 'Password does not meet security policy',
        400
      )
    }
  }

  await user.save()

  if (typeof updates.password === 'string' && updates.password.length > 0) {
    try {
      await AuthenticationManager.promises.setUserPassword(user, updates.password)
    } catch (err) {
      throw createServiceError(
        err?.message || 'Password could not be updated',
        400
      )
    }
  }

  if (updates.suspended === true) {
    await UserSessionsManager.promises
      .removeSessionsFromRedis(user, null)
      .catch(err => {
        logger.warn({ err, userId: targetUserId }, 'failed to clear sessions on suspend')
      })
  }

  const projectCount = await Project.countDocuments({ owner_ref: user._id })
  return formatUserSummary(user, projectCount)
}

async function generatePasswordResetLink(targetUserId) {
  const user = await User.findById(targetUserId, { _id: 1, email: 1 }).lean()
  if (!user) {
    throw createServiceError('User not found', 404)
  }

  const ONE_WEEK = 7 * 24 * 60 * 60
  const token = await OneTimeTokenHandler.promises.getNewToken(
    'password',
    { user_id: user._id.toString(), email: user.email },
    { expiresIn: ONE_WEEK }
  )

  return {
    email: user.email,
    resetUrl: `${Settings.siteUrl}/user/password/set?passwordResetToken=${token}&email=${encodeURIComponent(user.email)}`,
  }
}

async function deleteUser(targetUserId, actingAdmin, ipAddress) {
  if (String(targetUserId) === String(actingAdmin._id)) {
    throw createServiceError('You cannot delete your own account', 400)
  }

  const target = await User.findById(targetUserId, {
    _id: 1,
    email: 1,
    isAdmin: 1,
    suspended: 1,
  }).lean()
  if (!target) {
    throw createServiceError('User not found', 404)
  }

  if (target.isAdmin && !target.suspended) {
    const otherActiveAdmins = await User.countDocuments({
      _id: { $ne: target._id },
      isAdmin: true,
      suspended: { $ne: true },
    })
    if (otherActiveAdmins === 0) {
      throw createServiceError(
        'Cannot delete the last active administrator',
        409
      )
    }
  }

  await UserDeleter.promises.deleteUser(targetUserId, {
    deleterUser: actingAdmin,
    ipAddress,
    skipEmail: true,
    force: true,
  })
}

const { ObjectId } = mongodb

const PROJECT_ADMIN_PROJECTION = {
  _id: 1,
  name: 1,
  lastUpdated: 1,
  owner_ref: 1,
  publicAccesLevel: 1,
  collaberator_refs: 1,
  reviewer_refs: 1,
  readOnly_refs: 1,
  copyDisabled_refs: 1,
  enterpriseAccess: 1,
}

function sanitizeStringList(values, maxLen = 120, maxItems = 50) {
  if (!Array.isArray(values)) return []
  const seen = new Set()
  const out = []
  for (const raw of values) {
    const cleaned = sanitizeControlCharacters(String(raw || ''))
      .trim()
      .slice(0, maxLen)
    if (!cleaned) continue
    const key = cleaned.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(cleaned)
    if (out.length >= maxItems) break
  }
  return out
}

function formatMiniUser(userDoc) {
  if (!userDoc) return null
  const firstName = userDoc.first_name || ''
  const lastName = userDoc.last_name || ''
  return {
    id: String(userDoc._id),
    email: userDoc.email || '',
    fullName: [firstName, lastName].filter(Boolean).join(' '),
    role: userDoc.role || '',
    institution: userDoc.institution || '',
  }
}

function formatAdminProjectRecord(project, usersById) {
  const ownerDoc = project.owner_ref
    ? usersById.get(String(project.owner_ref))
    : null
  const owner = formatMiniUser(ownerDoc)

  const copyDisabledSet = new Set((project.copyDisabled_refs || []).map(String))
  const roleByUserId = new Map()
  for (const id of project.readOnly_refs || []) {
    const idStr = String(id)
    roleByUserId.set(
      idStr,
      copyDisabledSet.has(idStr) ? 'view_only' : 'copy'
    )
  }
  for (const id of project.reviewer_refs || []) {
    roleByUserId.set(String(id), 'copy')
  }
  for (const id of project.collaberator_refs || []) {
    roleByUserId.set(String(id), 'edit')
  }
  if (project.owner_ref) {
    roleByUserId.delete(String(project.owner_ref))
  }

  const collaborators = []
  for (const [idStr, permissionMode] of roleByUserId.entries()) {
    const u = usersById.get(idStr)
    if (!u) continue
    const mapped = ProjectAccessPolicyService.permissionModeToPolicy(permissionMode)
    collaborators.push({
      userId: idStr,
      email: u.email || '',
      fullName: [u.first_name, u.last_name].filter(Boolean).join(' '),
      role: u.role || '',
      institution: u.institution || '',
      permissionMode,
      allowCopy: mapped.allowCopy,
    })
  }
  collaborators.sort((a, b) =>
    (a.fullName || a.email).localeCompare(b.fullName || b.email)
  )

  const rawPolicy = project.enterpriseAccess || {}
  const scope = ProjectAccessPolicyService.VALID_ENTERPRISE_SCOPES.includes(
    rawPolicy.scope
  )
    ? rawPolicy.scope
    : 'private'
  const permissionMode = ProjectAccessPolicyService.policyToPermissionMode(
    rawPolicy.privilegeLevel,
    rawPolicy.allowCopy !== false
  )
  const targetUsers = (rawPolicy.targetUserIds || [])
    .map(id => formatMiniUser(usersById.get(String(id))))
    .filter(Boolean)

  const hasEnterprise = scope !== 'private'
  const hasDirect = collaborators.length > 0
  const sharingKind =
    hasEnterprise && hasDirect
      ? 'both'
      : hasEnterprise
        ? 'enterprise'
        : hasDirect
          ? 'user_shared'
          : 'private'

  return {
    id: String(project._id),
    name: project.name || 'Untitled Project',
    lastUpdated: project.lastUpdated
      ? new Date(project.lastUpdated).toISOString()
      : null,
    publicAccessLevel: project.publicAccesLevel || 'private',
    owner,
    enterpriseAccess: {
      scope,
      permissionMode,
      allowCopy: permissionMode !== 'view_only',
      networkOnly: scope === 'network' || Boolean(rawPolicy.networkOnly),
      allowedCidrs: Array.isArray(rawPolicy.allowedCidrs)
        ? rawPolicy.allowedCidrs
        : [],
      targetRoles: Array.isArray(rawPolicy.targetRoles)
        ? rawPolicy.targetRoles
        : [],
      targetInstitutions: Array.isArray(rawPolicy.targetInstitutions)
        ? rawPolicy.targetInstitutions
        : [],
      targetUsers,
      updatedAt: rawPolicy.updatedAt
        ? new Date(rawPolicy.updatedAt).toISOString()
        : null,
    },
    collaborators,
    collaboratorCount: collaborators.length,
    sharingKind,
  }
}

async function batchLoadUsersForProjects(projects) {
  const userIds = new Set()
  for (const p of projects) {
    if (p.owner_ref) userIds.add(String(p.owner_ref))
    for (const id of p.collaberator_refs || []) userIds.add(String(id))
    for (const id of p.reviewer_refs || []) userIds.add(String(id))
    for (const id of p.readOnly_refs || []) userIds.add(String(id))
    for (const id of p.enterpriseAccess?.targetUserIds || []) {
      userIds.add(String(id))
    }
  }
  const objectIds = Array.from(userIds)
    .filter(id => ObjectId.isValid(id))
    .map(id => new ObjectId(id))

  const usersById = new Map()
  if (objectIds.length > 0) {
    const docs = await User.find(
      { _id: { $in: objectIds } },
      { _id: 1, email: 1, first_name: 1, last_name: 1, role: 1, institution: 1 }
    ).lean()
    for (const u of docs) {
      usersById.set(String(u._id), u)
    }
  }
  return usersById
}

async function getFormattedProjectRecord(projectId) {
  const project = await Project.findById(
    projectId,
    PROJECT_ADMIN_PROJECTION
  ).lean()
  if (!project) {
    throw createServiceError('Project not found', 404)
  }
  const usersById = await batchLoadUsersForProjects([project])
  return formatAdminProjectRecord(project, usersById)
}

async function loadProjectAccessFacets() {
  const [distinctRoles, distinctInstitutions] = await Promise.all([
    User.distinct('role', { role: { $exists: true, $ne: '' } }),
    User.distinct('institution', { institution: { $exists: true, $ne: '' } }),
  ])
  return {
    roles: distinctRoles
      .map(r => String(r || '').trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b)),
    institutions: distinctInstitutions
      .map(inst => String(inst || '').trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b)),
    defaultNetworkCidrs: ProjectAccessPolicyService.getDefaultNetworkCidrs(),
  }
}

async function getProjectAccessDetails(projectId) {
  if (!ObjectId.isValid(String(projectId))) {
    throw createServiceError('Invalid project id', 400)
  }
  const [project, facets] = await Promise.all([
    getFormattedProjectRecord(projectId),
    loadProjectAccessFacets(),
  ])
  return { project, facets }
}

async function listProjectsWithAccess({
  search = '',
  filter = 'all',
  page = 1,
  limit = 20,
} = {}) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20))
  const safePage = Math.max(1, Number(page) || 1)
  const trimmedSearch =
    typeof search === 'string'
      ? sanitizeControlCharacters(search).trim().slice(0, 120)
      : ''

  const conditions = []

  if (trimmedSearch) {
    const regex = new RegExp(escapeRegex(trimmedSearch), 'i')
    const matchedOwners = await User.find(
      {
        $or: [{ email: regex }, { first_name: regex }, { last_name: regex }],
      },
      { _id: 1 }
    )
      .limit(200)
      .lean()
    const ownerIds = matchedOwners.map(u => u._id)
    conditions.push({
      $or: [
        { name: regex },
        ...(ownerIds.length > 0 ? [{ owner_ref: { $in: ownerIds } }] : []),
      ],
    })
  }

  const enterpriseFilter = {
    'enterpriseAccess.scope': { $in: ['network', 'all_users', 'custom'] },
  }
  const userSharedFilter = {
    $or: [
      { 'collaberator_refs.0': { $exists: true } },
      { 'readOnly_refs.0': { $exists: true } },
      { 'reviewer_refs.0': { $exists: true } },
    ],
  }

  if (filter === 'enterprise') {
    conditions.push(enterpriseFilter)
  } else if (filter === 'user_shared') {
    conditions.push(userSharedFilter)
  } else if (filter === 'private') {
    conditions.push({
      'enterpriseAccess.scope': { $nin: ['network', 'all_users', 'custom'] },
      collaberator_refs: { $size: 0 },
      readOnly_refs: { $size: 0 },
      reviewer_refs: { $size: 0 },
    })
  }

  const query =
    conditions.length === 0
      ? {}
      : conditions.length === 1
        ? conditions[0]
        : { $and: conditions }

  const [
    total,
    totalProjects,
    enterpriseShared,
    userShared,
    baseFacets,
  ] = await Promise.all([
    Project.countDocuments(query),
    Project.countDocuments({}),
    Project.countDocuments(enterpriseFilter),
    Project.countDocuments(userSharedFilter),
    loadProjectAccessFacets(),
  ])

  const totalPages = Math.max(1, Math.ceil(total / safeLimit))
  const clampedPage = Math.min(safePage, totalPages)
  const skip = (clampedPage - 1) * safeLimit

  const projectDocs = await Project.find(query, PROJECT_ADMIN_PROJECTION)
    .sort({ lastUpdated: -1 })
    .skip(skip)
    .limit(safeLimit)
    .lean()

  const usersById = await batchLoadUsersForProjects(projectDocs)
  const projects = projectDocs.map(doc =>
    formatAdminProjectRecord(doc, usersById)
  )

  const privateProjects = await Project.countDocuments({
    'enterpriseAccess.scope': { $nin: ['network', 'all_users', 'custom'] },
    collaberator_refs: { $size: 0 },
    readOnly_refs: { $size: 0 },
    reviewer_refs: { $size: 0 },
  })

  return {
    projects,
    total,
    page: clampedPage,
    limit: safeLimit,
    totalPages,
    facets: {
      roles: baseFacets.roles,
      institutions: baseFacets.institutions,
      defaultNetworkCidrs: baseFacets.defaultNetworkCidrs,
      counts: {
        totalProjects,
        enterpriseShared,
        userShared,
        privateProjects,
      },
    },
  }
}

async function updateProjectAccessPolicy(
  projectId,
  actingAdminId,
  payload = {}
) {
  if (!ObjectId.isValid(String(projectId))) {
    throw createServiceError('Invalid project id', 400)
  }

  const project = await Project.findById(projectId, { _id: 1, name: 1 }).lean()
  if (!project) {
    throw createServiceError('Project not found', 404)
  }

  const scope = ProjectAccessPolicyService.VALID_ENTERPRISE_SCOPES.includes(
    payload.scope
  )
    ? payload.scope
    : 'private'

  const permissionMode =
    ProjectAccessPolicyService.VALID_PERMISSION_MODES.includes(
      payload.permissionMode
    )
      ? payload.permissionMode
      : 'copy'

  const { privilegeLevel, allowCopy } =
    ProjectAccessPolicyService.permissionModeToPolicy(permissionMode)

  const networkOnly =
    scope === 'network' ||
    (scope !== 'private' && Boolean(payload.networkOnly))

  const allowedCidrs = ProjectAccessPolicyService.validateCidrs(
    Array.isArray(payload.allowedCidrs) ? payload.allowedCidrs : []
  )

  const targetRoles =
    scope === 'custom' ? sanitizeStringList(payload.targetRoles, 120, 50) : []
  const targetInstitutions =
    scope === 'custom'
      ? sanitizeStringList(payload.targetInstitutions, 160, 50)
      : []

  let targetUserIds = []
  if (scope === 'custom' && Array.isArray(payload.targetUserIds)) {
    const validIds = Array.from(
      new Set(
        payload.targetUserIds
          .map(id => String(id || '').trim())
          .filter(id => ObjectId.isValid(id))
      )
    ).slice(0, 100)

    if (validIds.length > 0) {
      const existingUsers = await User.find(
        { _id: { $in: validIds.map(id => new ObjectId(id)) } },
        { _id: 1 }
      ).lean()
      targetUserIds = existingUsers.map(u => u._id)
    }
  }

  if (
    scope === 'custom' &&
    targetRoles.length === 0 &&
    targetInstitutions.length === 0 &&
    targetUserIds.length === 0
  ) {
    throw createServiceError(
      'Select at least one profession, organization, or user for custom access',
      400
    )
  }

  const policyDoc = {
    scope,
    privilegeLevel,
    allowCopy,
    networkOnly,
    allowedCidrs,
    targetRoles,
    targetInstitutions,
    targetUserIds,
    updatedBy: ObjectId.isValid(String(actingAdminId))
      ? new ObjectId(String(actingAdminId))
      : undefined,
    updatedAt: new Date(),
  }

  await Project.updateOne(
    { _id: project._id },
    { $set: { enterpriseAccess: policyDoc } }
  ).exec()

  AsyncLocalStorage.removeItem(`projectAccess:${String(project._id)}`)
  try {
    EditorRealTimeController.emitToRoom(
      String(project._id),
      'project:enterpriseAccess:changed',
      {
        enterpriseAccess: ProjectAccessPolicyService.buildEnterpriseAccessView({
          enterpriseAccess: policyDoc,
        }),
      }
    )
  } catch (err) {
    logger.warn(
      { err, projectId: String(project._id) },
      'failed emitting enterprise access update'
    )
  }
  logger.info(
    {
      projectId: String(project._id),
      actingAdminId: String(actingAdminId || ''),
      scope,
      permissionMode,
      networkOnly,
    },
    'admin updated project enterprise access policy'
  )

  return await getFormattedProjectRecord(project._id)
}

async function addProjectCollaborator(projectId, actingAdminId, payload) {
  await ProjectAccessPolicyService.upsertDirectCollaborator(
    projectId,
    actingAdminId,
    payload
  )
  return await getFormattedProjectRecord(projectId)
}

async function updateProjectCollaborator(
  projectId,
  actingAdminId,
  userId,
  permissionMode
) {
  await ProjectAccessPolicyService.upsertDirectCollaborator(
    projectId,
    actingAdminId,
    { userId, permissionMode }
  )
  return await getFormattedProjectRecord(projectId)
}

async function removeProjectCollaborator(projectId, userId) {
  await ProjectAccessPolicyService.removeDirectCollaborator(projectId, userId)
  return await getFormattedProjectRecord(projectId)
}

export default {
  getSystemOverview,
  listSystemMessages,
  createSystemMessage,
  deleteSystemMessage,
  clearSystemMessages,
  setEditorOpen,
  disconnectAllUsers,
  listUsers,
  createUser,
  updateUser,
  generatePasswordResetLink,
  deleteUser,
  listProjectsWithAccess,
  getProjectAccessDetails,
  updateProjectAccessPolicy,
  addProjectCollaborator,
  updateProjectCollaborator,
  removeProjectCollaborator,
}
