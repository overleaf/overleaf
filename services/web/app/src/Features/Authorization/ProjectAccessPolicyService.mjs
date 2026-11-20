import { AsyncLocalStorage as NodeAsyncLocalStorage } from 'node:async_hooks'
import net from 'node:net'
import mongodb from 'mongodb-legacy'
import logger from '@overleaf/logger'
import { Project } from '../../models/Project.mjs'
import { User } from '../../models/User.mjs'
import AsyncLocalStorage from '../../infrastructure/AsyncLocalStorage.mjs'
import { sanitizeControlCharacters } from '../../infrastructure/Sanitize.mjs'
import CollaboratorsHandler from '../Collaborators/CollaboratorsHandler.mjs'
import EditorRealTimeController from '../Editor/EditorRealTimeController.mjs'
import PrivilegeLevels from './PrivilegeLevels.mjs'
import PublicAccessLevels from './PublicAccessLevels.mjs'

const { ObjectId } = mongodb

const requestContextStorage = new NodeAsyncLocalStorage()

export const DEFAULT_NETWORK_CIDRS = Object.freeze([
  '127.0.0.0/8',
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
  '169.254.0.0/16',
  '::1/128',
  'fc00::/7',
  'fe80::/10',
])

export const VALID_ENTERPRISE_SCOPES = Object.freeze([
  'private',
  'network',
  'all_users',
  'custom',
])

export const VALID_PERMISSION_MODES = Object.freeze([
  'edit',
  'copy',
  'view_only',
])

function createServiceError(message, statusCode = 400) {
  const err = new Error(message)
  err.statusCode = statusCode
  return err
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function normalizeIp(raw) {
  if (!raw || typeof raw !== 'string') return ''
  let ip = raw.trim()
  if (!ip) return ''
  // Strip IPv6 zone index (e.g. fe80::1%eth0)
  const zoneIdx = ip.indexOf('%')
  if (zoneIdx !== -1) {
    ip = ip.slice(0, zoneIdx)
  }
  // Unwrap IPv4-mapped IPv6 address (::ffff:192.168.1.5)
  if (ip.toLowerCase().startsWith('::ffff:')) {
    const v4Candidate = ip.slice(7)
    if (net.isIPv4(v4Candidate)) {
      return v4Candidate
    }
  }
  return net.isIP(ip) ? ip : ''
}

function isLoopbackIp(ip) {
  if (!ip) return false
  if (ip === '::1') return true
  if (net.isIPv4(ip)) {
    return ip.startsWith('127.')
  }
  return false
}

/**
 * Resolve the effective client IP safely without letting external callers spoof X-Forwarded-For.
 * When behind in-container Nginx without OVERLEAF_BEHIND_PROXY, the rightmost X-Forwarded-For entry
 * appended by Nginx's `$proxy_add_x_forwarded_for` reflects the actual remote peer address.
 */
export function resolveClientIp(req) {
  if (!req) return ''
  const socketIp = normalizeIp(req.socket?.remoteAddress || '')
  const expressIp = normalizeIp(req.ip || '')
  const xffHeader = req.headers?.['x-forwarded-for']

  if (typeof xffHeader === 'string' && xffHeader.trim()) {
    const parts = xffHeader
      .split(',')
      .map(part => normalizeIp(part))
      .filter(Boolean)
    if (parts.length > 0 && isLoopbackIp(socketIp)) {
      return parts[parts.length - 1]
    }
  }

  return expressIp || socketIp
}

export function requestContextMiddleware(req, _res, next) {
  const clientIp = resolveClientIp(req)
  requestContextStorage.run({ clientIp }, next)
}

export function getRequestClientIp() {
  return requestContextStorage.getStore()?.clientIp || ''
}

function parseIpv4ToBigInt(ip) {
  const parts = ip.split('.').map(Number)
  if (
    parts.length !== 4 ||
    parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)
  ) {
    return null
  }
  return (
    (BigInt(parts[0]) << 24n) |
    (BigInt(parts[1]) << 16n) |
    (BigInt(parts[2]) << 8n) |
    BigInt(parts[3])
  )
}

function parseIpv6ToBigInt(rawIp) {
  let ip = rawIp.toLowerCase()
  // Handle IPv4-embedded IPv6 tail if present
  if (ip.includes('.')) {
    const lastColon = ip.lastIndexOf(':')
    if (lastColon === -1) return null
    const v4 = parseIpv4ToBigInt(ip.slice(lastColon + 1))
    if (v4 === null) return null
    const high = ((v4 >> 16n) & 0xffffn).toString(16)
    const low = (v4 & 0xffffn).toString(16)
    ip = `${ip.slice(0, lastColon)}:${high}:${low}`
  }

  const sides = ip.split('::')
  if (sides.length > 2) return null

  const parseGroups = str => {
    if (!str) return []
    const groups = str.split(':')
    const nums = []
    for (const g of groups) {
      if (!/^[0-9a-f]{1,4}$/i.test(g)) return null
      nums.push(BigInt(parseInt(g, 16)))
    }
    return nums
  }

  const left = parseGroups(sides[0])
  if (left === null) return null

  let allGroups
  if (sides.length === 2) {
    const right = parseGroups(sides[1])
    if (right === null) return null
    const missing = 8 - (left.length + right.length)
    if (missing < 0) return null
    allGroups = [...left, ...Array(missing).fill(0n), ...right]
  } else {
    if (left.length !== 8) return null
    allGroups = left
  }

  let acc = 0n
  for (const g of allGroups) {
    acc = (acc << 16n) | g
  }
  return acc
}

function parseCidrEntry(rawEntry) {
  if (typeof rawEntry !== 'string') return null
  const trimmed = rawEntry.trim()
  if (!trimmed) return null

  const slashIdx = trimmed.indexOf('/')
  const rawAddr = slashIdx === -1 ? trimmed : trimmed.slice(0, slashIdx)
  const ip = normalizeIp(rawAddr)
  if (!ip) return null

  const family = net.isIPv4(ip) ? 4 : net.isIPv6(ip) ? 6 : 0
  if (!family) return null

  const maxBits = family === 4 ? 32 : 128
  let prefix = maxBits
  if (slashIdx !== -1) {
    const rawPrefix = trimmed.slice(slashIdx + 1)
    if (!/^\d{1,3}$/.test(rawPrefix)) return null
    prefix = Number(rawPrefix)
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > maxBits) {
      return null
    }
  }

  const value =
    family === 4 ? parseIpv4ToBigInt(ip) : parseIpv6ToBigInt(ip)
  if (value === null) return null

  const normalized = slashIdx === -1 ? `${ip}/${maxBits}` : `${ip}/${prefix}`
  const shift = BigInt(maxBits - prefix)
  const mask =
    prefix === 0
      ? 0n
      : ((1n << BigInt(maxBits)) - 1n) ^ ((1n << shift) - 1n)

  return {
    family,
    prefix,
    mask,
    network: value & mask,
    normalized,
  }
}

export function getDefaultNetworkCidrs() {
  const envRaw = process.env.OVERLEAF_TRUSTED_NETWORK_CIDRS
  if (typeof envRaw === 'string' && envRaw.trim()) {
    const parsed = envRaw
      .split(',')
      .map(s => parseCidrEntry(s))
      .filter(Boolean)
      .map(e => e.normalized)
    if (parsed.length > 0) {
      return Array.from(new Set(parsed))
    }
  }
  return [...DEFAULT_NETWORK_CIDRS]
}

export function validateCidrs(rawCidrs) {
  if (!Array.isArray(rawCidrs)) {
    throw createServiceError('allowedCidrs must be an array of IP/CIDR strings', 400)
  }
  const seen = new Set()
  const out = []
  for (const item of rawCidrs) {
    const cleaned = sanitizeControlCharacters(String(item || '')).trim()
    if (!cleaned) continue
    if (out.length >= 50) {
      throw createServiceError('A maximum of 50 CIDR rules is allowed per project', 400)
    }
    const parsed = parseCidrEntry(cleaned)
    if (!parsed) {
      throw createServiceError(
        `Invalid IP or CIDR rule: "${cleaned}". Examples: 192.168.1.0/24 or 10.0.0.0/8`,
        400
      )
    }
    if (!seen.has(parsed.normalized)) {
      seen.add(parsed.normalized)
      out.push(parsed.normalized)
    }
  }
  return out
}

export function isIpAllowed(clientIp, allowedCidrs) {
  if (!clientIp) {
    // Internal service calls (e.g. real-time -> privateApiRouter joinProject) carry no external client IP
    return true
  }
  const normalizedIp = normalizeIp(clientIp)
  if (!normalizedIp) return false

  const ipFamily = net.isIPv4(normalizedIp) ? 4 : net.isIPv6(normalizedIp) ? 6 : 0
  if (!ipFamily) return false
  const ipBigInt =
    ipFamily === 4
      ? parseIpv4ToBigInt(normalizedIp)
      : parseIpv6ToBigInt(normalizedIp)
  if (ipBigInt === null) return false

  const effectiveCidrs =
    Array.isArray(allowedCidrs) && allowedCidrs.length > 0
      ? allowedCidrs
      : getDefaultNetworkCidrs()

  for (const cidrStr of effectiveCidrs) {
    const cidr = parseCidrEntry(cidrStr)
    if (!cidr || cidr.family !== ipFamily) continue
    if ((ipBigInt & cidr.mask) === cidr.network) {
      return true
    }
  }
  return false
}

export function permissionModeToPolicy(mode) {
  if (mode === 'edit') {
    return { privilegeLevel: PrivilegeLevels.READ_AND_WRITE, allowCopy: true }
  }
  if (mode === 'view_only') {
    return { privilegeLevel: PrivilegeLevels.READ_ONLY, allowCopy: false }
  }
  return { privilegeLevel: PrivilegeLevels.READ_ONLY, allowCopy: true }
}

export function policyToPermissionMode(privilegeLevel, allowCopy = true) {
  if (
    privilegeLevel === PrivilegeLevels.READ_AND_WRITE ||
    privilegeLevel === PrivilegeLevels.OWNER ||
    privilegeLevel === 'readWrite'
  ) {
    return 'edit'
  }
  if (allowCopy === false) {
    return 'view_only'
  }
  return 'copy'
}

function getPermissionRank(mode) {
  if (mode === 'edit') return 3
  if (mode === 'copy') return 2
  if (mode === 'view_only') return 1
  return 0
}

export function evaluateEnterpriseAccessForUser(
  project,
  user,
  clientIp = getRequestClientIp()
) {
  const denied = {
    granted: false,
    privilegeLevel: PrivilegeLevels.NONE,
    allowCopy: false,
    scope: 'private',
    networkOnly: false,
    permissionMode: null,
    reason: 'private',
  }

  if (!project || !user || user.suspended === true) {
    return denied
  }

  const policy = project.enterpriseAccess
  if (!policy || !policy.scope || policy.scope === 'private') {
    return denied
  }

  const scope = VALID_ENTERPRISE_SCOPES.includes(policy.scope)
    ? policy.scope
    : 'private'
  if (scope === 'private') {
    return denied
  }

  const networkOnly = scope === 'network' || Boolean(policy.networkOnly)
  const mode = policyToPermissionMode(
    policy.privilegeLevel || PrivilegeLevels.READ_ONLY,
    policy.allowCopy !== false
  )
  const mapped = permissionModeToPolicy(mode)

  if (project.owner_ref && String(project.owner_ref) === String(user._id)) {
    return {
      granted: false,
      privilegeLevel: PrivilegeLevels.NONE,
      allowCopy: true,
      scope,
      networkOnly,
      permissionMode: mode,
      reason: 'owner',
    }
  }

  if (networkOnly && !isIpAllowed(clientIp, policy.allowedCidrs)) {
    return {
      ...denied,
      scope,
      networkOnly: true,
      reason: 'network_restricted',
    }
  }

  let matched = false
  if (scope === 'network' || scope === 'all_users') {
    matched = true
  } else if (scope === 'custom') {
    const userIdStr = String(user._id)
    const targetUsers = new Set(
      (policy.targetUserIds || []).map(id => String(id))
    )
    const targetRoles = new Set(
      (policy.targetRoles || []).map(r => String(r).trim().toLowerCase()).filter(Boolean)
    )
    const targetInstitutions = new Set(
      (policy.targetInstitutions || [])
        .map(inst => String(inst).trim().toLowerCase())
        .filter(Boolean)
    )

    if (
      targetUsers.size === 0 &&
      targetRoles.size === 0 &&
      targetInstitutions.size === 0
    ) {
      return { ...denied, scope: 'custom', reason: 'empty_custom_targets' }
    }

    const userRole = String(user.role || '').trim().toLowerCase()
    const userInstitution = String(user.institution || '').trim().toLowerCase()

    matched =
      targetUsers.has(userIdStr) ||
      (userRole.length > 0 && targetRoles.has(userRole)) ||
      (userInstitution.length > 0 && targetInstitutions.has(userInstitution))
  }

  if (!matched) {
    return {
      ...denied,
      scope,
      networkOnly,
      reason: 'audience_mismatch',
    }
  }

  return {
    granted: true,
    privilegeLevel: mapped.privilegeLevel,
    allowCopy: mapped.allowCopy,
    scope,
    networkOnly,
    permissionMode: mode,
    reason: 'matched',
  }
}

export async function evaluateEnterpriseAccessForUserById(
  userId,
  projectId,
  clientIp = getRequestClientIp()
) {
  if (!userId || !projectId || !ObjectId.isValid(String(projectId)) || !ObjectId.isValid(String(userId))) {
    return {
      granted: false,
      privilegeLevel: PrivilegeLevels.NONE,
      allowCopy: false,
      scope: 'private',
      networkOnly: false,
      permissionMode: null,
    }
  }

  const [project, user] = await Promise.all([
    Project.findById(projectId, { owner_ref: 1, enterpriseAccess: 1 }).lean(),
    User.findById(userId, { _id: 1, role: 1, institution: 1, suspended: 1 }).lean(),
  ])

  return evaluateEnterpriseAccessForUser(project, user, clientIp)
}

function includesUserId(list, userIdStr) {
  return Array.isArray(list) && list.some(id => String(id) === userIdStr)
}

export async function canUserCopyProject(
  userId,
  projectId,
  clientIp = getRequestClientIp()
) {
  if (!userId || !projectId || !ObjectId.isValid(String(projectId)) || !ObjectId.isValid(String(userId))) {
    return false
  }

  const [user, project] = await Promise.all([
    User.findById(userId, {
      _id: 1,
      isAdmin: 1,
      role: 1,
      institution: 1,
      suspended: 1,
    }).lean(),
    Project.findById(projectId, {
      owner_ref: 1,
      collaberator_refs: 1,
      reviewer_refs: 1,
      readOnly_refs: 1,
      copyDisabled_refs: 1,
      tokenAccessReadAndWrite_refs: 1,
      tokenAccessReadOnly_refs: 1,
      publicAccesLevel: 1,
      enterpriseAccess: 1,
    }).lean(),
  ])

  if (!user || user.suspended || !project) {
    return false
  }

  if (user.isAdmin) {
    return true
  }

  const userIdStr = String(user._id)
  if (project.owner_ref && String(project.owner_ref) === userIdStr) {
    return true
  }

  if (
    includesUserId(project.collaberator_refs, userIdStr) ||
    includesUserId(project.reviewer_refs, userIdStr) ||
    includesUserId(project.tokenAccessReadAndWrite_refs, userIdStr)
  ) {
    return true
  }

  const isCopyDisabled = includesUserId(project.copyDisabled_refs, userIdStr)
  const isDirectReadOnly = includesUserId(project.readOnly_refs, userIdStr)
  const directCanCopy = isDirectReadOnly && !isCopyDisabled

  const policyEval = evaluateEnterpriseAccessForUser(project, user, clientIp)
  const policyCanCopy = Boolean(policyEval.granted && policyEval.allowCopy)

  const hasTokenOrLegacyAccess =
    includesUserId(project.tokenAccessReadOnly_refs, userIdStr) ||
    project.publicAccesLevel === PublicAccessLevels.READ_ONLY ||
    project.publicAccesLevel === PublicAccessLevels.READ_AND_WRITE
  const tokenFallbackCanCopy = hasTokenOrLegacyAccess && !isCopyDisabled

  return Boolean(directCanCopy || policyCanCopy || tokenFallbackCanCopy)
}

export async function findEnterpriseSharedProjectsForUser(
  userId,
  projection = {},
  clientIp = getRequestClientIp()
) {
  const emptyResult = {
    readAndWrite: [],
    readOnly: [],
    policyInfoById: new Map(),
  }

  if (!userId || !ObjectId.isValid(String(userId))) {
    return emptyResult
  }

  const user = await User.findById(userId, {
    _id: 1,
    role: 1,
    institution: 1,
    suspended: 1,
  }).lean()

  if (!user || user.suspended) {
    return emptyResult
  }

  let effectiveProjection = {}
  if (typeof projection === 'string') {
    for (const field of projection.split(/\s+/).filter(Boolean)) {
      effectiveProjection[field] = 1
    }
  } else if (projection && typeof projection === 'object') {
    effectiveProjection = { ...projection }
  }
  effectiveProjection.owner_ref = 1
  effectiveProjection.enterpriseAccess = 1

  const candidates = await Project.find(
    {
      owner_ref: { $ne: user._id },
      'enterpriseAccess.scope': { $in: ['network', 'all_users', 'custom'] },
    },
    effectiveProjection
  ).lean()

  const readAndWrite = []
  const readOnly = []
  const policyInfoById = new Map()

  for (const project of candidates) {
    const evalResult = evaluateEnterpriseAccessForUser(project, user, clientIp)
    if (!evalResult.granted) continue

    const idStr = String(project._id)
    policyInfoById.set(idStr, evalResult)
    if (evalResult.privilegeLevel === PrivilegeLevels.READ_AND_WRITE) {
      readAndWrite.push(project)
    } else if (evalResult.privilegeLevel === PrivilegeLevels.READ_ONLY) {
      readOnly.push(project)
    }
  }

  return { readAndWrite, readOnly, policyInfoById }
}

export function buildProjectSharingInfoMap(
  userId,
  rawProjects,
  policyInfoById = new Map()
) {
  const userIdStr = String(userId)
  const map = new Map()

  for (const project of rawProjects) {
    const projectIdStr = String(project._id)
    const scope = project.enterpriseAccess?.scope || 'private'
    const networkOnly =
      scope === 'network' || Boolean(project.enterpriseAccess?.networkOnly)
    const directCollabCount = new Set([
      ...(project.collaberator_refs || []).map(String),
      ...(project.reviewer_refs || []).map(String),
      ...(project.readOnly_refs || []).map(String),
    ]).size

    if (project.owner_ref && String(project.owner_ref) === userIdStr) {
      const enterpriseMode =
        scope !== 'private'
          ? policyToPermissionMode(
              project.enterpriseAccess?.privilegeLevel,
              project.enterpriseAccess?.allowCopy !== false
            )
          : null
      map.set(projectIdStr, {
        source: 'owner',
        scope,
        networkOnly,
        permissionMode: 'edit',
        allowCopy: true,
        collaboratorCount: directCollabCount,
        enterprisePermissionMode: enterpriseMode,
      })
      continue
    }

    const isDirectWrite = includesUserId(project.collaberator_refs, userIdStr)
    const isDirectReview = includesUserId(project.reviewer_refs, userIdStr)
    const isDirectReadOnly = includesUserId(project.readOnly_refs, userIdStr)
    const isCopyDisabled = includesUserId(project.copyDisabled_refs, userIdStr)
    const hasDirect = isDirectWrite || isDirectReview || isDirectReadOnly

    let directMode = null
    if (isDirectWrite) {
      directMode = 'edit'
    } else if (isDirectReview) {
      directMode = 'copy'
    } else if (isDirectReadOnly) {
      directMode = isCopyDisabled ? 'view_only' : 'copy'
    }

    const policyEval = policyInfoById.get(projectIdStr)
    const policyMode = policyEval?.granted ? policyEval.permissionMode : null

    const bestMode =
      getPermissionRank(policyMode) > getPermissionRank(directMode)
        ? policyMode
        : directMode || policyMode || 'copy'

    const effectiveAllowCopy =
      bestMode === 'edit' ||
      (isDirectReadOnly && !isCopyDisabled) ||
      isDirectReview ||
      Boolean(policyEval?.granted && policyEval.allowCopy)

    map.set(projectIdStr, {
      source: hasDirect ? 'direct' : policyEval?.granted ? 'enterprise' : 'token',
      scope: policyEval?.granted ? policyEval.scope : 'private',
      networkOnly: Boolean(policyEval?.granted && policyEval.networkOnly),
      permissionMode: bestMode,
      allowCopy: effectiveAllowCopy,
      collaboratorCount: directCollabCount,
    })
  }

  return map
}

export async function searchWorkspaceUsersForSharing(
  rawQuery = '',
  excludeUserIds = [],
  limit = 15
) {
  const safeLimit = Math.min(30, Math.max(1, Number(limit) || 15))
  const trimmed =
    typeof rawQuery === 'string'
      ? sanitizeControlCharacters(rawQuery).trim().slice(0, 120)
      : ''

  const excludeObjectIds = excludeUserIds
    .filter(id => ObjectId.isValid(String(id)))
    .map(id => new ObjectId(String(id)))

  const query = {
    suspended: { $ne: true },
    holdingAccount: { $ne: true },
    ...(excludeObjectIds.length > 0 ? { _id: { $nin: excludeObjectIds } } : {}),
  }

  if (trimmed) {
    const regex = new RegExp(escapeRegex(trimmed), 'i')
    query.$or = [
      { email: regex },
      { first_name: regex },
      { last_name: regex },
      { role: regex },
      { institution: regex },
    ]
  }

  const docs = await User.find(query, {
    _id: 1,
    email: 1,
    first_name: 1,
    last_name: 1,
    role: 1,
    institution: 1,
  })
    .sort({ first_name: 1, last_name: 1, email: 1 })
    .limit(safeLimit)
    .lean()

  return docs.map(u => {
    const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ')
    return {
      id: String(u._id),
      email: u.email,
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      fullName,
      role: u.role || '',
      institution: u.institution || '',
    }
  })
}

export async function getProjectCollaboratorsSummary(project) {
  if (!project) return []

  const copyDisabledSet = new Set((project.copyDisabled_refs || []).map(String))
  const memberRoles = new Map()

  for (const id of project.readOnly_refs || []) {
    const idStr = String(id)
    memberRoles.set(
      idStr,
      copyDisabledSet.has(idStr) ? 'view_only' : 'copy'
    )
  }
  for (const id of project.reviewer_refs || []) {
    memberRoles.set(String(id), 'copy')
  }
  for (const id of project.collaberator_refs || []) {
    memberRoles.set(String(id), 'edit')
  }

  if (project.owner_ref) {
    memberRoles.delete(String(project.owner_ref))
  }

  if (memberRoles.size === 0) return []

  const userDocs = await User.find(
    { _id: { $in: Array.from(memberRoles.keys()).map(id => new ObjectId(id)) } },
    {
      _id: 1,
      email: 1,
      first_name: 1,
      last_name: 1,
      role: 1,
      institution: 1,
    }
  ).lean()

  const byId = new Map(userDocs.map(u => [String(u._id), u]))
  const list = []
  for (const [idStr, permissionMode] of memberRoles.entries()) {
    const user = byId.get(idStr)
    if (!user) continue
    const mapped = permissionModeToPolicy(permissionMode)
    list.push({
      userId: idStr,
      email: user.email,
      fullName: [user.first_name, user.last_name].filter(Boolean).join(' '),
      role: user.role || '',
      institution: user.institution || '',
      privilegeLevel: mapped.privilegeLevel,
      permissionMode,
      allowCopy: mapped.allowCopy,
    })
  }

  list.sort((a, b) =>
    (a.fullName || a.email).localeCompare(b.fullName || b.email)
  )
  return list
}

function safeEmitMembershipChanged(projectId) {
  try {
    EditorRealTimeController.emitToRoom(
      String(projectId),
      'project:membership:changed',
      { members: true }
    )
  } catch (err) {
    logger.warn({ err, projectId }, 'failed emitting membership change event')
  }
}

export async function upsertDirectCollaborator(
  projectId,
  _actingUserId,
  { userId, email, permissionMode }
) {
  if (!ObjectId.isValid(String(projectId))) {
    throw createServiceError('Invalid project id', 400)
  }
  if (!VALID_PERMISSION_MODES.includes(permissionMode)) {
    throw createServiceError('Invalid permission mode', 400)
  }

  const project = await Project.findById(projectId, {
    _id: 1,
    owner_ref: 1,
    name: 1,
  }).lean()
  if (!project) {
    throw createServiceError('Project not found', 404)
  }

  let targetUser = null
  if (userId) {
    if (!ObjectId.isValid(String(userId))) {
      throw createServiceError('Invalid user id', 400)
    }
    targetUser = await User.findById(userId, {
      _id: 1,
      email: 1,
      suspended: 1,
    }).lean()
  } else if (typeof email === 'string' && email.trim()) {
    const cleanEmail = email.trim().toLowerCase()
    targetUser = await User.findOne(
      {
        $or: [{ email: cleanEmail }, { 'emails.email': cleanEmail }],
      },
      { _id: 1, email: 1, suspended: 1 }
    ).lean()
  }

  if (!targetUser) {
    throw createServiceError('User account not found', 404)
  }
  if (targetUser.suspended) {
    throw createServiceError('Cannot share projects with a suspended account', 400)
  }
  if (project.owner_ref && String(project.owner_ref) === String(targetUser._id)) {
    throw createServiceError('The project owner already has full access', 400)
  }

  const targetOid = targetUser._id
  await Project.updateOne(
    { _id: project._id },
    {
      $pull: {
        collaberator_refs: targetOid,
        reviewer_refs: targetOid,
        readOnly_refs: targetOid,
        pendingEditor_refs: targetOid,
        pendingReviewer_refs: targetOid,
        copyDisabled_refs: targetOid,
      },
    }
  ).exec()

  const addOps =
    permissionMode === 'edit'
      ? { collaberator_refs: targetOid }
      : permissionMode === 'view_only'
        ? { readOnly_refs: targetOid, copyDisabled_refs: targetOid }
        : { readOnly_refs: targetOid }

  await Project.updateOne({ _id: project._id }, { $addToSet: addOps }).exec()

  AsyncLocalStorage.removeItem(`projectAccess:${String(project._id)}`)
  safeEmitMembershipChanged(project._id)

  const refreshed = await Project.findById(project._id, {
    owner_ref: 1,
    collaberator_refs: 1,
    reviewer_refs: 1,
    readOnly_refs: 1,
    copyDisabled_refs: 1,
  }).lean()

  return await getProjectCollaboratorsSummary(refreshed)
}

/**
 * Non-sensitive enterprise policy summary that is safe to expose to any
 * project member (used by the native Share modal and the editor bootstrap).
 * Full CIDR / audience details stay behind the site-admin endpoints.
 */
export function buildEnterpriseAccessView(project) {
  const policy = project?.enterpriseAccess || {}
  const scope = VALID_ENTERPRISE_SCOPES.includes(policy.scope)
    ? policy.scope
    : 'private'
  if (scope === 'private') {
    return { scope: 'private', permissionMode: null, networkOnly: false }
  }
  return {
    scope,
    permissionMode: policyToPermissionMode(
      policy.privilegeLevel || PrivilegeLevels.READ_ONLY,
      policy.allowCopy !== false
    ),
    networkOnly: scope === 'network' || Boolean(policy.networkOnly),
  }
}

/**
 * Add or update a named collaborator using Overleaf's native privilege
 * levels plus the copy flag. Used by the original Share modal invite flow so
 * existing workspace accounts are added instantly (no SMTP required).
 */
export async function upsertNativeCollaborator(
  projectId,
  targetUserId,
  privilegeLevel,
  allowCopy = true
) {
  if (
    !ObjectId.isValid(String(projectId)) ||
    !ObjectId.isValid(String(targetUserId))
  ) {
    throw createServiceError('Invalid project or user id', 400)
  }
  const validLevels = [
    PrivilegeLevels.READ_AND_WRITE,
    PrivilegeLevels.REVIEW,
    PrivilegeLevels.READ_ONLY,
  ]
  if (!validLevels.includes(privilegeLevel)) {
    throw createServiceError('Invalid privilege level', 400)
  }
  const projectOid = new ObjectId(String(projectId))
  const targetOid = new ObjectId(String(targetUserId))

  await Project.updateOne(
    { _id: projectOid },
    {
      $pull: {
        collaberator_refs: targetOid,
        reviewer_refs: targetOid,
        readOnly_refs: targetOid,
        pendingEditor_refs: targetOid,
        pendingReviewer_refs: targetOid,
        copyDisabled_refs: targetOid,
      },
    }
  ).exec()

  let addOps
  if (privilegeLevel === PrivilegeLevels.READ_AND_WRITE) {
    addOps = { collaberator_refs: targetOid }
  } else if (privilegeLevel === PrivilegeLevels.REVIEW) {
    addOps = { reviewer_refs: targetOid }
  } else if (allowCopy === false) {
    addOps = { readOnly_refs: targetOid, copyDisabled_refs: targetOid }
  } else {
    addOps = { readOnly_refs: targetOid }
  }
  await Project.updateOne(
    { _id: projectOid },
    { $addToSet: addOps, $set: { lastUpdated: new Date() } }
  ).exec()

  AsyncLocalStorage.removeItem(`projectAccess:${String(projectId)}`)

  return {
    privilegeLevel,
    allowCopy:
      privilegeLevel === PrivilegeLevels.READ_ONLY ? allowCopy !== false : true,
  }
}

/**
 * Keep copyDisabled_refs in sync after a native privilege-level change.
 */
export async function syncCopyDisabledFlag(
  projectId,
  targetUserId,
  privilegeLevel,
  allowCopy
) {
  if (
    !ObjectId.isValid(String(projectId)) ||
    !ObjectId.isValid(String(targetUserId))
  ) {
    return
  }
  const targetOid = new ObjectId(String(targetUserId))
  const update =
    privilegeLevel === PrivilegeLevels.READ_ONLY && allowCopy === false
      ? { $addToSet: { copyDisabled_refs: targetOid } }
      : { $pull: { copyDisabled_refs: targetOid } }
  await Project.updateOne(
    { _id: new ObjectId(String(projectId)) },
    update
  ).exec()
  AsyncLocalStorage.removeItem(`projectAccess:${String(projectId)}`)
}

export async function removeDirectCollaborator(projectId, targetUserId) {
  if (!ObjectId.isValid(String(projectId)) || !ObjectId.isValid(String(targetUserId))) {
    throw createServiceError('Invalid project or user id', 400)
  }

  const project = await Project.findById(projectId, {
    _id: 1,
    owner_ref: 1,
  }).lean()
  if (!project) {
    throw createServiceError('Project not found', 404)
  }
  if (project.owner_ref && String(project.owner_ref) === String(targetUserId)) {
    throw createServiceError('Cannot remove the project owner', 400)
  }

  await CollaboratorsHandler.promises.removeUserFromProject(
    project._id,
    new ObjectId(String(targetUserId))
  )
  await Project.updateOne(
    { _id: project._id },
    { $pull: { copyDisabled_refs: new ObjectId(String(targetUserId)) } }
  ).exec()

  AsyncLocalStorage.removeItem(`projectAccess:${String(project._id)}`)
  safeEmitMembershipChanged(project._id)

  const refreshed = await Project.findById(project._id, {
    owner_ref: 1,
    collaberator_refs: 1,
    reviewer_refs: 1,
    readOnly_refs: 1,
    copyDisabled_refs: 1,
  }).lean()

  return await getProjectCollaboratorsSummary(refreshed)
}

export default {
  DEFAULT_NETWORK_CIDRS,
  VALID_ENTERPRISE_SCOPES,
  VALID_PERMISSION_MODES,
  normalizeIp,
  resolveClientIp,
  requestContextMiddleware,
  getRequestClientIp,
  getDefaultNetworkCidrs,
  validateCidrs,
  isIpAllowed,
  permissionModeToPolicy,
  policyToPermissionMode,
  evaluateEnterpriseAccessForUser,
  evaluateEnterpriseAccessForUserById,
  canUserCopyProject,
  findEnterpriseSharedProjectsForUser,
  buildProjectSharingInfoMap,
  searchWorkspaceUsersForSharing,
  getProjectCollaboratorsSummary,
  upsertDirectCollaborator,
  removeDirectCollaborator,
  buildEnterpriseAccessView,
  upsertNativeCollaborator,
  syncCopyDisabledFlag,
}
