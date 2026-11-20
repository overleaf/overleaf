import path from 'node:path'
import logger from '@overleaf/logger'
import { expressify } from '@overleaf/promise-utils'
import Settings from '@overleaf/settings'
import Features from '../../infrastructure/Features.mjs'
import { multerUploadHandler } from '../../infrastructure/Multer.mjs'
import {
  getRawReqInput,
  parseReq,
  z,
  zz,
} from '../../infrastructure/Validation.mjs'
import { PackageHubAuditLog } from '../../models/PackageHubAuditLog.mjs'
import { PackageHubJob } from '../../models/PackageHubJob.mjs'
import AuthorizationManager from '../Authorization/AuthorizationManager.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'
import UserGetter from '../User/UserGetter.mjs'
import PackageHubManager from './PackageHubManager.mjs'

const PACKAGE_NAME_RE = /^[a-zA-Z0-9._-]+$/

const packageNameSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(PACKAGE_NAME_RE, 'Package name contains disallowed characters')

const namesBodySchema = z.object({
  body: z.object({
    names: z.array(packageNameSchema).min(1).max(100),
    source: z.enum(['texlive', 'ctan', 'community', 'custom', 'auto']).optional(),
  }),
})

const updateBodySchema = z.object({
  body: z.object({
    names: z.array(packageNameSchema).max(100).optional(),
    all: z.boolean().optional(),
  }),
})

const mirrorBodySchema = z.object({
  body: z.object({
    url: z.string().url().max(1024),
  }),
})

const communityBodySchema = z.object({
  body: z.object({
    manifestUrl: z.string().url().max(1024).optional(),
    manifest: z.record(z.string(), z.any()).optional(),
  }),
})

const uploadSchema = z.object({
  body: z.object({
    packageName: z.string().max(128).optional(),
    description: z.string().max(500).optional(),
    version: z.string().max(64).optional(),
  }),
  file: zz.uploadedFile(),
})

const singleNameParamSchema = z.object({
  params: z.object({
    name: packageNameSchema,
  }),
})

const jobIdParamSchema = z.object({
  params: z.object({
    jobId: z.string().min(1).max(128),
  }),
})

const uploadMulterMiddleware = multerUploadHandler({
  dest: '/var/lib/overleaf/tmp/uploads',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
    files: 1,
  },
}).single('file')

async function getUserContext(req) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const sessionUser = SessionManager.getSessionUser(req.session)
  const isAdmin = userId
    ? await AuthorizationManager.promises.isUserSiteAdmin(userId)
    : false
  let email = sessionUser?.email || ''
  if (!email && userId) {
    try {
      const user = await UserGetter.promises.getUser(userId, { email: 1 })
      email = user?.email || ''
    } catch {}
  }
  return { userId: String(userId || ''), userEmail: email, isAdmin: Boolean(isAdmin) }
}

function assertFeatureEnabled(res) {
  if (!Features.hasFeature('package-hub')) {
    res.status(404).json({ ok: false, error: 'Package Hub feature is disabled' })
    return false
  }
  return true
}

function canMutatePackages(ctx) {
  if (ctx.isAdmin) return true
  return Settings.packageHub?.allowAllUsersInstall !== false
}

function canUploadPackages(ctx) {
  if (ctx.isAdmin) return true
  return Settings.packageHub?.allowAllUsersUpload !== false
}

async function renderPackagesPage(req, res, next) {
  if (!Features.hasFeature('package-hub')) {
    return res.status(404).send('Not found')
  }
  const ctx = await getUserContext(req)
  let user = null
  if (ctx.userId) {
    user = await UserGetter.promises.getUser(ctx.userId, {
      _id: 1,
      email: 1,
      first_name: 1,
      last_name: 1,
      isAdmin: 1,
    })
  }
  return res.render('packages/index', {
    title: 'package_hub',
    user: user
      ? {
          id: user._id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          isAdmin: Boolean(user.isAdmin),
        }
      : { id: ctx.userId, email: ctx.userEmail, isAdmin: ctx.isAdmin },
    packageHubConfig: {
      canMutate: canMutatePackages(ctx),
      canUpload: canUploadPackages(ctx),
      isAdmin: ctx.isAdmin,
    },
  })
}

async function listPackages(req, res) {
  if (!assertFeatureEnabled(res)) return
  const { query } = getRawReqInput(req)
  const qs = new URLSearchParams()
  for (const key of ['source', 'status', 'sort', 'q', 'page', 'limit']) {
    if (query?.[key] !== undefined && query[key] !== '') {
      qs.set(key, String(query[key]))
    }
  }
  const { statusCode, data } = await PackageHubManager.callHubDaemon(
    'GET',
    `/packages?${qs.toString()}`
  )
  return res.status(statusCode).json(data)
}

async function listInstalled(req, res) {
  if (!assertFeatureEnabled(res)) return
  const { statusCode, data } = await PackageHubManager.callHubDaemon(
    'GET',
    '/packages/installed'
  )
  if (statusCode === 200 && Array.isArray(data)) {
    PackageHubManager.syncInstalledPackagesToMongo(data.slice(0, 200))
  }
  return res.status(statusCode).json(data)
}

async function searchPackages(req, res) {
  if (!assertFeatureEnabled(res)) return
  const { query } = getRawReqInput(req)
  const q = encodeURIComponent(String(query?.q || ''))
  const { statusCode, data } = await PackageHubManager.callHubDaemon(
    'GET',
    `/packages/search?q=${q}`
  )
  return res.status(statusCode).json(data)
}

async function listUpdates(req, res) {
  if (!assertFeatureEnabled(res)) return
  const { statusCode, data } = await PackageHubManager.callHubDaemon(
    'GET',
    '/packages/updates'
  )
  return res.status(statusCode).json(data)
}

async function getPackageDetails(req, res) {
  if (!assertFeatureEnabled(res)) return
  let params
  try {
    ;({ params } = parseReq(req, singleNameParamSchema))
  } catch {
    return res.status(400).json({ ok: false, error: 'Invalid package name' })
  }
  const { statusCode, data } = await PackageHubManager.callHubDaemon(
    'GET',
    `/packages/${encodeURIComponent(params.name)}`
  )
  return res.status(statusCode).json(data)
}

async function getOpenApiDocs(req, res) {
  if (!assertFeatureEnabled(res)) return
  const { statusCode, data } = await PackageHubManager.callHubDaemon('GET', '/docs')
  return res.status(statusCode).json(data)
}

async function getAuditLog(req, res) {
  if (!assertFeatureEnabled(res)) return
  const { query } = getRawReqInput(req)
  const limit = Math.min(200, Math.max(1, Number(query?.limit || 100)))
  const { statusCode, data } = await PackageHubManager.callHubDaemon(
    'GET',
    `/audit?limit=${limit}`
  )
  if (statusCode === 200 && Array.isArray(data?.items)) {
    return res.json(data)
  }
  const mongoItems = await PackageHubAuditLog.find({})
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean()
  return res.json({ ok: true, items: mongoItems })
}

async function installPackages(req, res) {
  if (!assertFeatureEnabled(res)) return
  const userCtx = await getUserContext(req)
  if (!canMutatePackages(userCtx)) {
    return res
      .status(403)
      .json({ ok: false, error: 'Admin or power-user permission required to install packages' })
  }

  let body
  try {
    ;({ body } = parseReq(req, namesBodySchema))
  } catch {
    return res.status(400).json({ ok: false, error: 'Invalid package names payload' })
  }

  const { statusCode, data } = await PackageHubManager.callHubDaemon(
    'POST',
    '/packages/install',
    {
      names: body.names,
      source: body.source || 'texlive',
      _userId: userCtx.userId,
      _userEmail: userCtx.userEmail,
    }
  )
  if (data?.job) {
    PackageHubManager.mirrorJobToMongo(data.job)
  }
  PackageHubManager.recordAuditInMongo({
    userId: userCtx.userId,
    userEmail: userCtx.userEmail,
    action: body.source === 'community' ? 'install-community-pack' : 'install',
    packageName: body.names.join(','),
    source: body.source || 'texlive',
    result: statusCode < 400 ? 'queued' : 'failed',
    details: data?.jobId ? `jobId=${data.jobId}` : data?.error || '',
  })
  return res.status(statusCode).json(data)
}

async function removePackages(req, res) {
  if (!assertFeatureEnabled(res)) return
  const userCtx = await getUserContext(req)
  if (!canMutatePackages(userCtx)) {
    return res
      .status(403)
      .json({ ok: false, error: 'Admin or power-user permission required to remove packages' })
  }

  let body
  try {
    ;({ body } = parseReq(req, namesBodySchema))
  } catch {
    return res.status(400).json({ ok: false, error: 'Invalid package names payload' })
  }

  const { statusCode, data } = await PackageHubManager.callHubDaemon(
    'POST',
    '/packages/remove',
    {
      names: body.names,
      source: body.source || 'auto',
      _userId: userCtx.userId,
      _userEmail: userCtx.userEmail,
    }
  )
  if (data?.job) {
    PackageHubManager.mirrorJobToMongo(data.job)
  }
  PackageHubManager.recordAuditInMongo({
    userId: userCtx.userId,
    userEmail: userCtx.userEmail,
    action: 'remove',
    packageName: body.names.join(','),
    source: body.source || 'auto',
    result: statusCode === 409 ? 'blocked' : statusCode < 400 ? 'queued' : 'failed',
    details: data?.error || `jobId=${data?.jobId || ''}`,
  })
  return res.status(statusCode).json(data)
}

async function updatePackages(req, res) {
  if (!assertFeatureEnabled(res)) return
  const userCtx = await getUserContext(req)
  if (!canMutatePackages(userCtx)) {
    return res
      .status(403)
      .json({ ok: false, error: 'Admin or power-user permission required to update packages' })
  }

  let body
  try {
    ;({ body } = parseReq(req, updateBodySchema))
  } catch {
    return res.status(400).json({ ok: false, error: 'Invalid update request' })
  }

  const { statusCode, data } = await PackageHubManager.callHubDaemon(
    'POST',
    '/packages/update',
    {
      names: body.names || [],
      all: Boolean(body.all),
      _userId: userCtx.userId,
      _userEmail: userCtx.userEmail,
    }
  )
  if (data?.job) {
    PackageHubManager.mirrorJobToMongo(data.job)
  }
  return res.status(statusCode).json(data)
}

async function validateUpload(req, res) {
  if (!assertFeatureEnabled(res)) return
  const userCtx = await getUserContext(req)
  if (!canUploadPackages(userCtx)) {
    return res.status(403).json({ ok: false, error: 'Package uploads disabled for this user' })
  }
  let body
  let file
  try {
    ;({ body, file } = parseReq(req, uploadSchema, { logOnly: true }))
  } catch {
    return res.status(400).json({ ok: false, error: 'Invalid upload payload' })
  }
  if (!file?.path) {
    return res.status(400).json({ ok: false, error: 'No file uploaded' })
  }
  const { statusCode, data } = await PackageHubManager.callHubDaemon(
    'POST',
    '/packages/upload/validate',
    {
      tempFilePath: file.path,
      originalName: file.originalname,
      packageName: body?.packageName || undefined,
    }
  )
  return res.status(statusCode).json(data)
}

async function uploadPackage(req, res) {
  if (!assertFeatureEnabled(res)) return
  const userCtx = await getUserContext(req)
  if (!canUploadPackages(userCtx)) {
    return res.status(403).json({ ok: false, error: 'Package uploads disabled for this user' })
  }
  let body
  let file
  try {
    ;({ body, file } = parseReq(req, uploadSchema, { logOnly: true }))
  } catch {
    return res.status(400).json({ ok: false, error: 'Invalid upload payload' })
  }
  if (!file?.path) {
    return res.status(400).json({ ok: false, error: 'No file uploaded' })
  }
  const { statusCode, data } = await PackageHubManager.callHubDaemon(
    'POST',
    '/packages/upload',
    {
      tempFilePath: file.path,
      originalName: file.originalname,
      packageName: body?.packageName || undefined,
      description: body?.description || undefined,
      version: body?.version || undefined,
      _userId: userCtx.userId,
      _userEmail: userCtx.userEmail,
    }
  )
  if (data?.job) {
    PackageHubManager.mirrorJobToMongo(data.job)
  }
  PackageHubManager.recordAuditInMongo({
    userId: userCtx.userId,
    userEmail: userCtx.userEmail,
    action: 'upload',
    packageName: data?.packageName || file.originalname,
    source: 'custom',
    result: statusCode < 400 ? 'queued' : 'failed',
    details: file.originalname,
  })
  return res.status(statusCode).json(data)
}

async function deleteCustomPackage(req, res) {
  if (!assertFeatureEnabled(res)) return
  const userCtx = await getUserContext(req)
  if (!canUploadPackages(userCtx)) {
    return res.status(403).json({ ok: false, error: 'Permission denied' })
  }
  let params
  try {
    ;({ params } = parseReq(req, singleNameParamSchema))
  } catch {
    return res.status(400).json({ ok: false, error: 'Invalid package name' })
  }
  const { statusCode, data } = await PackageHubManager.callHubDaemon(
    'DELETE',
    `/packages/custom/${encodeURIComponent(params.name)}?userId=${encodeURIComponent(
      userCtx.userId
    )}&userEmail=${encodeURIComponent(userCtx.userEmail)}`
  )
  PackageHubManager.recordAuditInMongo({
    userId: userCtx.userId,
    userEmail: userCtx.userEmail,
    action: 'delete-custom',
    packageName: params.name,
    source: 'custom',
    result: statusCode < 400 ? 'success' : 'failed',
    details: data?.message || data?.error || '',
  })
  return res.status(statusCode).json(data)
}

async function reconcilePackages(req, res) {
  if (!assertFeatureEnabled(res)) return
  const userCtx = await getUserContext(req)
  const { statusCode, data } = await PackageHubManager.callHubDaemon(
    'POST',
    '/packages/reconcile',
    { _userId: userCtx.userId, _userEmail: userCtx.userEmail }
  )
  return res.status(statusCode).json(data)
}

async function snapshotEnvironment(req, res) {
  if (!assertFeatureEnabled(res)) return
  const userCtx = await getUserContext(req)
  if (!userCtx.isAdmin) {
    return res.status(403).json({ ok: false, error: 'Site admin role required to create snapshots' })
  }
  const { statusCode, data } = await PackageHubManager.callHubDaemon(
    'POST',
    '/packages/snapshot',
    { _userId: userCtx.userId, _userEmail: userCtx.userEmail }
  )
  return res.status(statusCode).json(data)
}

async function listJobs(req, res) {
  if (!assertFeatureEnabled(res)) return
  const { statusCode, data } = await PackageHubManager.callHubDaemon('GET', '/jobs')
  if (statusCode === 200) {
    return res.json(data)
  }
  const mongoJobs = await PackageHubJob.find({}).sort({ created_at: -1 }).limit(30).lean()
  return res.json({ ok: true, items: mongoJobs })
}

async function getJob(req, res) {
  if (!assertFeatureEnabled(res)) return
  let params
  try {
    ;({ params } = parseReq(req, jobIdParamSchema))
  } catch {
    return res.status(400).json({ ok: false, error: 'Invalid jobId' })
  }
  const jobId = encodeURIComponent(params.jobId)
  const { statusCode, data } = await PackageHubManager.callHubDaemon('GET', `/jobs/${jobId}`)
  if (statusCode === 200 && data?.id) {
    PackageHubManager.mirrorJobToMongo(data)
  }
  return res.status(statusCode).json(data)
}

function streamJob(req, res) {
  if (!assertFeatureEnabled(res)) return
  let params
  try {
    ;({ params } = parseReq(req, jobIdParamSchema))
  } catch {
    return res.status(400).json({ ok: false, error: 'Invalid jobId' })
  }
  PackageHubManager.streamJobEvents(params.jobId, res, req)
}

async function getSources(req, res) {
  if (!assertFeatureEnabled(res)) return
  const { statusCode, data } = await PackageHubManager.callHubDaemon('GET', '/sources')
  return res.status(statusCode).json(data)
}

async function listCommunityManifests(req, res) {
  if (!assertFeatureEnabled(res)) return
  const { statusCode, data } = await PackageHubManager.callHubDaemon('GET', '/sources/community')
  return res.status(statusCode).json(data)
}

async function registerCommunityManifest(req, res) {
  if (!assertFeatureEnabled(res)) return
  const userCtx = await getUserContext(req)
  if (!userCtx.isAdmin) {
    return res
      .status(403)
      .json({ ok: false, error: 'Site admin role required to register community packs' })
  }

  let body
  try {
    ;({ body } = parseReq(req, communityBodySchema))
  } catch {
    return res.status(400).json({ ok: false, error: 'Invalid community manifest request' })
  }
  if (!body.manifestUrl && !body.manifest) {
    return res.status(400).json({ ok: false, error: 'Provide manifestUrl or manifest JSON' })
  }

  const { statusCode, data } = await PackageHubManager.callHubDaemon(
    'POST',
    '/sources/community',
    {
      ...body,
      _userId: userCtx.userId,
      _userEmail: userCtx.userEmail,
    }
  )
  if (statusCode === 200 && data?.manifest) {
    PackageHubManager.mirrorManifestToMongo(data.manifest)
  }
  PackageHubManager.recordAuditInMongo({
    userId: userCtx.userId,
    userEmail: userCtx.userEmail,
    action: 'register-community-manifest',
    packageName: data?.manifest?.name || body.manifestUrl || 'unknown',
    source: 'community',
    result: statusCode < 400 ? 'success' : 'failed',
    details: data?.manifest?.url || data?.error || '',
  })
  return res.status(statusCode).json(data)
}

async function setTexliveMirror(req, res) {
  if (!assertFeatureEnabled(res)) return
  const userCtx = await getUserContext(req)
  if (!userCtx.isAdmin) {
    return res
      .status(403)
      .json({ ok: false, error: 'Site admin role required to change TeX Live mirror' })
  }

  let body
  try {
    ;({ body } = parseReq(req, mirrorBodySchema))
  } catch {
    return res.status(400).json({ ok: false, error: 'Invalid mirror URL' })
  }

  const { statusCode, data } = await PackageHubManager.callHubDaemon(
    'POST',
    '/sources/texlive/mirror',
    {
      url: body.url,
      _userId: userCtx.userId,
      _userEmail: userCtx.userEmail,
    }
  )
  PackageHubManager.recordAuditInMongo({
    userId: userCtx.userId,
    userEmail: userCtx.userEmail,
    action: 'set-mirror',
    packageName: 'texlive',
    source: 'texlive',
    result: statusCode < 400 ? 'success' : 'failed',
    details: body.url,
  })
  return res.status(statusCode).json(data)
}

async function clearHistory(req, res) {
  if (!assertFeatureEnabled(res)) return
  const userCtx = await getUserContext(req)
  if (!canMutatePackages(userCtx)) {
    return res
      .status(403)
      .json({ ok: false, error: 'Permission required to clear history' })
  }
  const scope = ['all', 'jobs', 'audit'].includes(req.body?.scope)
    ? req.body.scope
    : 'all'
  const { statusCode, data } = await PackageHubManager.callHubDaemon(
    'POST',
    '/history/clear',
    {
      scope,
      _userId: userCtx.userId,
      _userEmail: userCtx.userEmail,
    }
  )
  if (statusCode < 400) {
    try {
      if (scope === 'all' || scope === 'jobs') {
        await PackageHubJob.deleteMany({
          status: { $nin: ['running', 'queued'] },
        })
      }
      if (scope === 'all' || scope === 'audit') {
        await PackageHubAuditLog.deleteMany({})
      }
    } catch (err) {
      logger.warn({ err }, 'failed to clear package hub history in mongo')
    }
  }
  return res.status(statusCode).json(data)
}

export default {
  uploadMulterMiddleware,
  renderPackagesPage: expressify(renderPackagesPage),
  listPackages: expressify(listPackages),
  listInstalled: expressify(listInstalled),
  searchPackages: expressify(searchPackages),
  listUpdates: expressify(listUpdates),
  getPackageDetails: expressify(getPackageDetails),
  getOpenApiDocs: expressify(getOpenApiDocs),
  getAuditLog: expressify(getAuditLog),
  installPackages: expressify(installPackages),
  removePackages: expressify(removePackages),
  updatePackages: expressify(updatePackages),
  validateUpload: expressify(validateUpload),
  uploadPackage: expressify(uploadPackage),
  deleteCustomPackage: expressify(deleteCustomPackage),
  reconcilePackages: expressify(reconcilePackages),
  snapshotEnvironment: expressify(snapshotEnvironment),
  listJobs: expressify(listJobs),
  getJob: expressify(getJob),
  streamJob,
  clearHistory: expressify(clearHistory),
  getSources: expressify(getSources),
  listCommunityManifests: expressify(listCommunityManifests),
  registerCommunityManifest: expressify(registerCommunityManifest),
  setTexliveMirror: expressify(setTexliveMirror),
}
