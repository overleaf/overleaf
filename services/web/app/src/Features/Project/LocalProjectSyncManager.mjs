import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import logger from '@overleaf/logger'
import Settings from '@overleaf/settings'
import { Project } from '../../models/Project.mjs'
import { User } from '../../models/User.mjs'
import DocumentUpdaterHandler from '../DocumentUpdater/DocumentUpdaterHandler.mjs'
import HistoryManager from '../History/HistoryManager.mjs'
import ProjectEntityHandler from './ProjectEntityHandler.mjs'
import ProjectGetter from './ProjectGetter.mjs'
import ProjectHelper from './ProjectHelper.mjs'
import {
  ALLOWED_ROOT,
  DEFAULT_BASE_DIR,
  doPathsOverlap,
  sanitizeProjectFolderName,
  validateHostFolderPath,
  validateRelativeEntityPath,
} from './LocalProjectSyncPathUtils.mjs'

const SOCKET_PATH =
  process.env.LOCAL_SYNC_SOCKET_PATH || '/run/overleaf-local-sync/sync.sock'
const STAGE_ROOT = path.resolve(
  process.env.LOCAL_SYNC_STAGE_ROOT || '/tmp/overleaf-local-sync-stage'
)
const DEBOUNCE_MS = 1200

/** @type {Map<string, { timer: NodeJS.Timeout, options: Record<string, any> }>} */
const pendingSyncs = new Map()

/**
 * Call the uid=1000 local-sync daemon over its internal Unix domain socket.
 * @param {'GET' | 'POST'} method
 * @param {string} endpoint
 * @param {Record<string, any>} [body]
 * @param {number} [timeoutMs]
 * @returns {Promise<{ statusCode: number, data: any }>}
 */
function callDaemon(method, endpoint, body, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const payload = body != null ? JSON.stringify(body) : null
    const headers = {}
    if (payload != null) {
      headers['Content-Type'] = 'application/json'
      headers['Content-Length'] = Buffer.byteLength(payload)
    }

    const req = http.request(
      {
        socketPath: SOCKET_PATH,
        path: endpoint,
        method,
        headers,
        timeout: timeoutMs,
      },
      res => {
        const chunks = []
        res.on('data', c => chunks.push(c))
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8')
          let parsed = null
          try {
            parsed = raw ? JSON.parse(raw) : {}
          } catch {
            parsed = { ok: false, error: raw || 'Invalid daemon response' }
          }
          resolve({ statusCode: res.statusCode || 500, data: parsed })
        })
      }
    )

    req.on('timeout', () => {
      req.destroy(new Error('Local sync service timed out'))
    })
    req.on('error', err => {
      reject(
        new Error(
          `Local folder sync service is unavailable (${err?.code || err?.message})`
        )
      )
    })

    if (payload != null) {
      req.write(payload)
    }
    req.end()
  })
}

async function getUserBaseDir(userId) {
  if (!userId) return DEFAULT_BASE_DIR
  const user = await User.findById(userId, { localSyncBaseDir: 1 }).lean()
  if (user?.localSyncBaseDir && typeof user.localSyncBaseDir === 'string') {
    const check = validateHostFolderPath(user.localSyncBaseDir, {
      checkSymlinks: false,
    })
    if (check.ok) {
      return check.normalizedPath
    }
  }
  return DEFAULT_BASE_DIR
}

/**
 * Resolve effective target folder path on disk for a list of projects belonging
 * to a user (deterministic disambiguation if two default-folder projects share a name).
 * @param {string} baseDir
 * @param {Array<any>} projects
 * @returns {Map<string, { effectivePath: string, isCustom: boolean }>}
 */
function resolveFolderPathsForProjects(baseDir, projects) {
  const result = new Map()
  const usedPaths = new Set()

  // First register all explicit custom paths so default paths won't collide with them
  for (const project of projects) {
    const id = String(project._id || project.id)
    if (project.localFolderPath && typeof project.localFolderPath === 'string') {
      const check = validateHostFolderPath(project.localFolderPath, {
        checkSymlinks: false,
      })
      if (check.ok) {
        result.set(id, { effectivePath: check.normalizedPath, isCustom: true })
        usedPaths.add(check.normalizedPath.toLowerCase())
      }
    }
  }

  // Sort deterministically by project id for stable disambiguation
  const defaultProjects = projects
    .filter(p => !result.has(String(p._id || p.id)))
    .sort((a, b) => String(a._id || a.id).localeCompare(String(b._id || b.id)))

  for (const project of defaultProjects) {
    const id = String(project._id || project.id)
    const folderName = sanitizeProjectFolderName(project.name, id)
    let candidate = path.join(baseDir, folderName)
    if (usedPaths.has(candidate.toLowerCase())) {
      candidate = path.join(baseDir, `${folderName} (${id.slice(-6)})`)
    }
    usedPaths.add(candidate.toLowerCase())
    result.set(id, { effectivePath: candidate, isCustom: false })
  }

  return result
}

async function getResolvedProjectFolder(project, ownerBaseDir = null) {
  const projectId = String(project._id || project.id)
  const ownerId = project.owner_ref ? String(project.owner_ref) : null
  const baseDir = ownerBaseDir || (await getUserBaseDir(ownerId))

  if (project.localFolderPath && typeof project.localFolderPath === 'string') {
    const check = validateHostFolderPath(project.localFolderPath, {
      checkSymlinks: false,
    })
    if (check.ok) {
      return { effectivePath: check.normalizedPath, isCustom: true, baseDir }
    }
  }

  // Fetch sibling projects of the owner to preserve deterministic disambiguation
  const siblingProjects = ownerId
    ? await Project.find(
        { owner_ref: ownerId },
        { _id: 1, name: 1, localFolderPath: 1 }
      ).lean()
    : [project]

  const map = resolveFolderPathsForProjects(baseDir, siblingProjects)
  const resolved = map.get(projectId)
  if (resolved) {
    return { ...resolved, baseDir }
  }
  return {
    effectivePath: path.join(
      baseDir,
      sanitizeProjectFolderName(project.name, projectId)
    ),
    isCustom: false,
    baseDir,
  }
}

/**
 * Build `localFolder` metadata for every project shown on `/project`.
 * @param {string} userId
 * @param {Array<any>} rawProjects
 */
async function buildProjectFolderInfoMap(userId, rawProjects) {
  const userBaseDir = await getUserBaseDir(userId)

  // Group by owner_ref so each owner's baseDir is respected cleanly
  const ownerBaseDirs = new Map([[String(userId), userBaseDir]])
  const otherOwnerIds = new Set()
  for (const p of rawProjects) {
    if (p.owner_ref && String(p.owner_ref) !== String(userId)) {
      otherOwnerIds.add(String(p.owner_ref))
    }
  }
  if (otherOwnerIds.size > 0) {
    const owners = await User.find(
      { _id: { $in: Array.from(otherOwnerIds) } },
      { _id: 1, localSyncBaseDir: 1 }
    ).lean()
    for (const o of owners) {
      const check =
        o.localSyncBaseDir &&
        validateHostFolderPath(o.localSyncBaseDir, { checkSymlinks: false })
      ownerBaseDirs.set(
        String(o._id),
        check && check.ok ? check.normalizedPath : DEFAULT_BASE_DIR
      )
    }
  }

  /** @type {Map<string, Array<any>>} */
  const byOwner = new Map()
  for (const p of rawProjects) {
    const ownerKey = String(p.owner_ref || userId)
    if (!byOwner.has(ownerKey)) byOwner.set(ownerKey, [])
    byOwner.get(ownerKey).push(p)
  }

  const resolvedAll = new Map()
  for (const [ownerKey, projects] of byOwner.entries()) {
    const baseDir = ownerBaseDirs.get(ownerKey) || DEFAULT_BASE_DIR
    const ownerMap = resolveFolderPathsForProjects(baseDir, projects)
    for (const [id, info] of ownerMap.entries()) {
      resolvedAll.set(id, { ...info, baseDir })
    }
  }

  const infoMap = new Map()
  for (const p of rawProjects) {
    const id = String(p._id || p.id)
    const resolved = resolvedAll.get(id) || {
      effectivePath: path.join(
        userBaseDir,
        sanitizeProjectFolderName(p.name, id)
      ),
      isCustom: false,
      baseDir: userBaseDir,
    }
    const syncEnabled = p.localFolderSyncEnabled !== false
    infoMap.set(id, {
      customPath: p.localFolderPath || null,
      effectivePath: resolved.effectivePath,
      isCustom: resolved.isCustom,
      syncEnabled,
      lastSyncedAt: p.localFolderLastSyncedAt
        ? new Date(p.localFolderLastSyncedAt).toISOString()
        : null,
      lastSyncedPath: p.localFolderLastSyncedPath || null,
      status: !syncEnabled
        ? 'disabled'
        : p.localFolderLastSyncStatus || 'not_synced',
      error: p.localFolderLastSyncError || null,
      fileCount:
        typeof p.localFolderFileCount === 'number'
          ? p.localFolderFileCount
          : null,
      hasPdf: Boolean(p.localFolderHasPdf),
    })
  }
  return infoMap
}

/**
 * Locate the newest compiled `output.pdf` for a project on CLSI's local output/compiles disk.
 */
function findLatestCompiledPdf(projectId, preferredBuild = null) {
  const outputBase = Settings?.path?.outputDir || '/var/lib/overleaf/data/output'
  const compilesBase =
    Settings?.path?.compilesDir || '/var/lib/overleaf/data/compiles'

  const candidates = []

  if (preferredBuild?.buildId) {
    const dirsToTry = []
    if (preferredBuild.userId) {
      dirsToTry.push(
        path.join(
          outputBase,
          `${projectId}-${preferredBuild.userId}`,
          'generated-files',
          preferredBuild.buildId,
          'output.pdf'
        )
      )
    }
    dirsToTry.push(
      path.join(
        outputBase,
        String(projectId),
        'generated-files',
        preferredBuild.buildId,
        'output.pdf'
      )
    )
    for (const p of dirsToTry) {
      try {
        const st = fs.statSync(p)
        if (st.isFile() && st.size > 0) {
          return p
        }
      } catch {}
    }
  }

  // Scan outputBase/<projectId>* /generated-files/*/output.pdf
  try {
    const entries = fs.readdirSync(outputBase, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (
        entry.name !== String(projectId) &&
        !entry.name.startsWith(`${projectId}-`)
      ) {
        continue
      }
      const genDir = path.join(outputBase, entry.name, 'generated-files')
      try {
        const builds = fs.readdirSync(genDir, { withFileTypes: true })
        for (const b of builds) {
          if (!b.isDirectory()) continue
          const pdfPath = path.join(genDir, b.name, 'output.pdf')
          try {
            const st = fs.statSync(pdfPath)
            if (st.isFile() && st.size > 0) {
              candidates.push({ path: pdfPath, mtimeMs: st.mtimeMs })
            }
          } catch {}
        }
      } catch {}
    }
  } catch {}

  // Fallback: compilesBase/<projectId>*/output.pdf
  if (candidates.length === 0) {
    try {
      const entries = fs.readdirSync(compilesBase, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        if (
          entry.name !== String(projectId) &&
          !entry.name.startsWith(`${projectId}-`)
        ) {
          continue
        }
        const pdfPath = path.join(compilesBase, entry.name, 'output.pdf')
        try {
          const st = fs.statSync(pdfPath)
          if (st.isFile() && st.size > 0) {
            candidates.push({ path: pdfPath, mtimeMs: st.mtimeMs })
          }
        } catch {}
      }
    } catch {}
  }

  if (candidates.length === 0) return null
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs)
  return candidates[0].path
}

/**
 * Sync a single Overleaf project's readable files (.tex, .bib, assets, latest compiled PDF)
 * to its resolved local folder via the uid=1000 local-sync daemon.
 *
 * @param {string} projectId
 * @param {{
 *   force?: boolean,
 *   oldDir?: string | null,
 *   cleanOld?: boolean,
 *   compiledPdf?: { buildId?: string, userId?: string } | null
 * }} [options]
 */
async function syncProject(projectId, options = {}) {
  const {
    force = false,
    oldDir = null,
    cleanOld = false,
    compiledPdf = null,
  } = options

  const project = await ProjectGetter.promises.getProject(projectId, {
    _id: 1,
    name: 1,
    owner_ref: 1,
    trashed: 1,
    localFolderPath: 1,
    localFolderSyncEnabled: 1,
    localFolderLastSyncedPath: 1,
    'overleaf.history.id': 1,
  })

  if (!project) {
    return { ok: false, skipped: true, reason: 'project_not_found' }
  }

  const ownerId = project.owner_ref ? String(project.owner_ref) : null
  if (!force && ownerId && ProjectHelper.isTrashed(project, ownerId)) {
    return { ok: false, skipped: true, reason: 'project_trashed' }
  }

  if (!force && project.localFolderSyncEnabled === false) {
    return { ok: false, skipped: true, reason: 'sync_disabled' }
  }

  const { effectivePath: targetDir, isCustom } =
    await getResolvedProjectFolder(project)

  const jobId = `${projectId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
  const stagingDir = path.join(STAGE_ROOT, jobId)

  try {
    // 1. Flush any pending in-memory edits from document-updater to docstore/Mongo
    try {
      await DocumentUpdaterHandler.promises.flushProjectToMongo(
        String(projectId)
      )
    } catch (flushErr) {
      logger.warn(
        { err: flushErr, projectId },
        'local-sync: non-fatal error flushing project from document-updater'
      )
    }

    // 2. Stage docs and binary files
    fs.mkdirSync(stagingDir, { recursive: true, mode: 0o755 })

    const stagedRelFiles = []
    const stagedSet = new Set()

    const docs = await ProjectEntityHandler.promises.getAllDocs(
      String(projectId)
    )
    for (const [rawDocPath, doc] of Object.entries(docs || {})) {
      const v = validateRelativeEntityPath(rawDocPath)
      if (!v.ok) {
        logger.warn(
          { projectId, rawDocPath, reason: v.error },
          'local-sync: skipping unsafe doc path'
        )
        continue
      }
      const dest = path.resolve(stagingDir, v.relPath)
      fs.mkdirSync(path.dirname(dest), { recursive: true, mode: 0o755 })
      const content = Array.isArray(doc.lines) ? doc.lines.join('\n') : ''
      fs.writeFileSync(dest, content, { encoding: 'utf8', mode: 0o644 })
      if (!stagedSet.has(v.relPath)) {
        stagedSet.add(v.relPath)
        stagedRelFiles.push(v.relPath)
      }
    }

    const files = await ProjectEntityHandler.promises.getAllFiles(
      String(projectId)
    )
    for (const [rawFilePath, file] of Object.entries(files || {})) {
      if (!file || !file.hash) continue
      const v = validateRelativeEntityPath(rawFilePath)
      if (!v.ok) {
        logger.warn(
          { projectId, rawFilePath, reason: v.error },
          'local-sync: skipping unsafe file path'
        )
        continue
      }
      const dest = path.resolve(stagingDir, v.relPath)
      fs.mkdirSync(path.dirname(dest), { recursive: true, mode: 0o755 })
      try {
        const { stream } =
          await HistoryManager.promises.requestBlobWithProjectId(
            String(projectId),
            file.hash
          )
        await pipeline(stream, fs.createWriteStream(dest, { mode: 0o644 }))
        if (!stagedSet.has(v.relPath)) {
          stagedSet.add(v.relPath)
          stagedRelFiles.push(v.relPath)
        }
      } catch (blobErr) {
        logger.warn(
          { err: blobErr, projectId, filePath: v.relPath, hash: file.hash },
          'local-sync: failed fetching binary file blob'
        )
      }
    }

    // 3. Include latest compiled PDF if available
    let hasPdf = false
    const pdfSourcePath = findLatestCompiledPdf(String(projectId), compiledPdf)
    if (pdfSourcePath) {
      let pdfName = `${sanitizeProjectFolderName(project.name, projectId)}.pdf`
      if (stagedSet.has(pdfName)) {
        pdfName = stagedSet.has('output.pdf')
          ? '_overleaf_compiled_output.pdf'
          : 'output.pdf'
      }
      const destPdf = path.resolve(stagingDir, pdfName)
      try {
        fs.copyFileSync(pdfSourcePath, destPdf)
        fs.chmodSync(destPdf, 0o644)
        stagedSet.add(pdfName)
        stagedRelFiles.push(pdfName)
        hasPdf = true
      } catch (pdfErr) {
        logger.warn(
          { err: pdfErr, projectId, pdfSourcePath },
          'local-sync: failed staging compiled PDF'
        )
      }
    }

    // 4. Send to uid=1000 local-sync daemon for atomic host write
    const effectiveOldDir =
      oldDir ||
      (cleanOld &&
      project.localFolderLastSyncedPath &&
      project.localFolderLastSyncedPath !== targetDir
        ? project.localFolderLastSyncedPath
        : null)

    const { statusCode, data } = await callDaemon('POST', '/sync', {
      projectId: String(projectId),
      projectName: project.name,
      targetDir,
      stagingDir,
      files: stagedRelFiles,
      oldDir: effectiveOldDir,
      cleanOld: Boolean(cleanOld && effectiveOldDir),
    })

    if (statusCode !== 200 || !data?.ok) {
      const errorMsg = data?.error || `Sync failed (HTTP ${statusCode})`
      await Project.updateOne(
        { _id: projectId },
        {
          $set: {
            localFolderLastSyncStatus: 'error',
            localFolderLastSyncError: errorMsg,
          },
        }
      ).exec()
      return {
        ok: false,
        error: errorMsg,
        targetDir,
        isCustom,
      }
    }

    const syncedAtDate = new Date(data.syncedAt || Date.now())
    await Project.updateOne(
      { _id: projectId },
      {
        $set: {
          localFolderLastSyncedAt: syncedAtDate,
          localFolderLastSyncStatus: 'synced',
          localFolderLastSyncError: null,
          localFolderLastSyncedPath: data.targetDir,
          localFolderFileCount: data.syncedFilesCount,
          localFolderHasPdf: hasPdf,
        },
      }
    ).exec()

    return {
      ok: true,
      projectId: String(projectId),
      projectName: project.name,
      targetDir: data.targetDir,
      isCustom,
      syncedFilesCount: data.syncedFilesCount,
      removedStaleCount: data.removedStaleCount,
      cleanedOldDir: data.cleanedOldDir,
      hasPdf,
      syncedAt: syncedAtDate.toISOString(),
    }
  } catch (err) {
    const errorMsg = err?.message || 'Unexpected error during local folder sync'
    logger.error({ err, projectId, targetDir }, 'local-sync: syncProject failed')
    try {
      await Project.updateOne(
        { _id: projectId },
        {
          $set: {
            localFolderLastSyncStatus: 'error',
            localFolderLastSyncError: errorMsg,
          },
        }
      ).exec()
    } catch {}
    return { ok: false, error: errorMsg, targetDir, isCustom }
  } finally {
    try {
      fs.rmSync(stagingDir, { recursive: true, force: true })
    } catch {}
  }
}

/**
 * Debounced non-blocking background sync trigger for editor/upload/rename/compile events.
 * Never throws into Overleaf's core request path.
 */
function scheduleSync(projectId, options = {}) {
  if (!projectId) return
  const key = String(projectId)
  const existing = pendingSyncs.get(key)
  const mergedOptions = {
    ...(existing?.options || {}),
    ...options,
    cleanOld: Boolean(existing?.options?.cleanOld || options.cleanOld),
    oldDir: options.oldDir || existing?.options?.oldDir || null,
    compiledPdf: options.compiledPdf || existing?.options?.compiledPdf || null,
  }
  if (existing?.timer) {
    clearTimeout(existing.timer)
  }

  const timer = setTimeout(() => {
    pendingSyncs.delete(key)
    syncProject(key, mergedOptions).catch(err => {
      logger.error({ err, projectId: key }, 'local-sync: background sync failed')
    })
  }, DEBOUNCE_MS)

  if (typeof timer.unref === 'function') {
    timer.unref()
  }

  pendingSyncs.set(key, { timer, options: mergedOptions })
}

async function getSettings(userId) {
  const baseDir = await getUserBaseDir(userId)
  let serviceHealthy = false
  let daemonInfo = null
  try {
    const { statusCode, data } = await callDaemon('GET', '/health', null, 3000)
    serviceHealthy = statusCode === 200 && Boolean(data?.ok)
    daemonInfo = data
  } catch {
    serviceHealthy = false
  }
  const presets = [DEFAULT_BASE_DIR]
  const docsDir = path.join(ALLOWED_ROOT, 'Documents')
  const desktopDir = path.join(ALLOWED_ROOT, 'Desktop')
  if (fs.existsSync(docsDir)) {
    presets.push(path.join(docsDir, 'Overleaf'))
  }
  if (fs.existsSync(desktopDir)) {
    presets.push(path.join(desktopDir, 'Overleaf'))
  }
  if (presets.length === 1) {
    presets.push(path.join(ALLOWED_ROOT, 'Papers'))
  }

  return {
    baseDir,
    defaultBaseDir: DEFAULT_BASE_DIR,
    allowedRoot: ALLOWED_ROOT,
    serviceHealthy,
    presets: Array.from(new Set(presets)),
    daemonUid: daemonInfo?.uid ?? null,
  }
}

async function updateBaseDir(
  userId,
  rawBaseDir,
  { syncAll = true, cleanOld = false } = {}
) {
  const { statusCode, data } = await callDaemon('POST', '/validate', {
    path: rawBaseDir,
  })
  if (statusCode !== 200 || !data?.ok) {
    const err = new Error(data?.error || 'Invalid base folder path')
    err.statusCode = 400
    throw err
  }
  const normalizedBaseDir = data.normalizedPath

  // Make sure the chosen baseDir is not itself a project's synced folder
  if (data.existingProjectId) {
    const err = new Error(
      `This folder is already synced directly to project "${data.existingProjectName || data.existingProjectId}". Choose a parent/base directory instead.`
    )
    err.statusCode = 400
    throw err
  }

  const oldBaseDir = await getUserBaseDir(userId)
  const ownedProjects = await Project.find(
    { owner_ref: userId },
    {
      _id: 1,
      name: 1,
      owner_ref: 1,
      trashed: 1,
      localFolderPath: 1,
      localFolderSyncEnabled: 1,
      localFolderLastSyncedPath: 1,
    }
  ).lean()

  const activeProjects = ownedProjects.filter(
    p => !ProjectHelper.isTrashed(p, userId)
  )

  // Ensure no project's custom folder equals the baseDir itself
  for (const p of activeProjects) {
    if (
      p.localFolderPath &&
      path.resolve(p.localFolderPath) === normalizedBaseDir
    ) {
      const err = new Error(
        `Cannot use "${normalizedBaseDir}" as the base folder because project "${p.name}" already uses it directly as a custom folder.`
      )
      err.statusCode = 400
      throw err
    }
  }

  const oldMap = resolveFolderPathsForProjects(oldBaseDir, activeProjects)

  // Persist user's new base dir
  await User.updateOne(
    { _id: userId },
    { $set: { localSyncBaseDir: normalizedBaseDir } }
  ).exec()

  // Ensure the base directory itself exists on disk right away
  await callDaemon('POST', '/mkdir', { path: normalizedBaseDir })

  const syncResults = []
  if (syncAll) {
    for (const p of activeProjects) {
      if (p.localFolderSyncEnabled === false) continue
      // Only projects using the default base dir change path, though syncing them all ensures everything is up to date
      if (p.localFolderPath) continue
      const prevInfo = oldMap.get(String(p._id))
      const oldDir =
        p.localFolderLastSyncedPath || prevInfo?.effectivePath || null
      const res = await syncProject(String(p._id), {
        oldDir,
        cleanOld: Boolean(cleanOld && oldBaseDir !== normalizedBaseDir),
      })
      syncResults.push(res)
    }
  }

  const settings = await getSettings(userId)
  return {
    settings,
    previousBaseDir: oldBaseDir,
    syncedCount: syncResults.filter(r => r.ok).length,
    failedCount: syncResults.filter(r => !r.ok && !r.skipped).length,
    results: syncResults,
  }
}

async function updateProjectFolder(
  projectId,
  userId,
  { customFolderPath = null, syncEnabled = true, syncNow = true, cleanOld = false }
) {
  const project = await Project.findById(projectId, {
    _id: 1,
    name: 1,
    owner_ref: 1,
    trashed: 1,
    localFolderPath: 1,
    localFolderSyncEnabled: 1,
    localFolderLastSyncedPath: 1,
  }).lean()

  if (!project) {
    const err = new Error('Project not found')
    err.statusCode = 404
    throw err
  }

  const ownerId = String(project.owner_ref || userId)
  const baseDir = await getUserBaseDir(ownerId)
  const prevResolved = await getResolvedProjectFolder(project, baseDir)
  const oldDir = project.localFolderLastSyncedPath || prevResolved.effectivePath

  let normalizedCustomPath = null
  if (customFolderPath != null && String(customFolderPath).trim() !== '') {
    const { statusCode, data } = await callDaemon('POST', '/validate', {
      path: String(customFolderPath).trim(),
    })
    if (statusCode !== 200 || !data?.ok) {
      const err = new Error(data?.error || 'Invalid folder path')
      err.statusCode = 400
      throw err
    }
    normalizedCustomPath = data.normalizedPath

    // Reject if the target folder already has a manifest for a DIFFERENT project
    if (
      data.existingProjectId &&
      String(data.existingProjectId) !== String(projectId)
    ) {
      const err = new Error(
        `Folder "${normalizedCustomPath}" is already synced with another project ("${data.existingProjectName || data.existingProjectId}").`
      )
      err.statusCode = 409
      throw err
    }

    // Reject if the custom path equals baseDir itself
    if (normalizedCustomPath.toLowerCase() === baseDir.toLowerCase()) {
      const err = new Error(
        `Choose a subfolder inside "${baseDir}" rather than the base folder itself.`
      )
      err.statusCode = 400
      throw err
    }

    // Check against ALL other non-trashed projects owned by this user + any project with custom localFolderPath
    const otherProjects = await Project.find(
      {
        _id: { $ne: project._id },
        $or: [
          { owner_ref: project.owner_ref },
          { localFolderPath: { $ne: null } },
        ],
      },
      { _id: 1, name: 1, owner_ref: 1, trashed: 1, localFolderPath: 1 }
    ).lean()

    const otherActive = otherProjects.filter(
      p => !ProjectHelper.isTrashed(p, p.owner_ref || ownerId)
    )
    const otherOwnerProjects = otherActive.filter(
      p => String(p.owner_ref) === ownerId
    )
    const ownerResolvedMap = resolveFolderPathsForProjects(
      baseDir,
      otherOwnerProjects
    )

    for (const other of otherActive) {
      const otherPath =
        other.localFolderPath ||
        ownerResolvedMap.get(String(other._id))?.effectivePath
      if (!otherPath) continue
      if (
        doPathsOverlap(normalizedCustomPath, otherPath, {
          caseInsensitive: true,
        })
      ) {
        const err = new Error(
          `Folder "${normalizedCustomPath}" conflicts with project "${other.name}" (${otherPath}). Please select a separate folder.`
        )
        err.statusCode = 409
        throw err
      }
    }
  }

  await Project.updateOne(
    { _id: projectId },
    {
      $set: {
        localFolderPath: normalizedCustomPath,
        localFolderSyncEnabled: Boolean(syncEnabled),
        ...(syncEnabled
          ? {}
          : {
              localFolderLastSyncStatus: 'disabled',
              localFolderLastSyncError: null,
            }),
      },
    }
  ).exec()

  let syncResult = null
  if (syncEnabled && syncNow) {
    syncResult = await syncProject(String(projectId), {
      force: true,
      oldDir,
      cleanOld: Boolean(cleanOld),
    })
    if (!syncResult.ok) {
      const err = new Error(syncResult.error || 'Failed to sync to new folder')
      err.statusCode = 400
      throw err
    }
  }

  const updated = await Project.findById(projectId, {
    _id: 1,
    name: 1,
    owner_ref: 1,
    localFolderPath: 1,
    localFolderSyncEnabled: 1,
    localFolderLastSyncedAt: 1,
    localFolderLastSyncStatus: 1,
    localFolderLastSyncError: 1,
    localFolderLastSyncedPath: 1,
    localFolderFileCount: 1,
    localFolderHasPdf: 1,
  }).lean()

  const resolvedAfter = await getResolvedProjectFolder(updated, baseDir)
  const localFolder = {
    customPath: updated.localFolderPath || null,
    effectivePath: resolvedAfter.effectivePath,
    isCustom: resolvedAfter.isCustom,
    syncEnabled: updated.localFolderSyncEnabled !== false,
    lastSyncedAt: updated.localFolderLastSyncedAt
      ? new Date(updated.localFolderLastSyncedAt).toISOString()
      : null,
    lastSyncedPath: updated.localFolderLastSyncedPath || null,
    status:
      updated.localFolderSyncEnabled === false
        ? 'disabled'
        : updated.localFolderLastSyncStatus || 'not_synced',
    error: updated.localFolderLastSyncError || null,
    fileCount:
      typeof updated.localFolderFileCount === 'number'
        ? updated.localFolderFileCount
        : null,
    hasPdf: Boolean(updated.localFolderHasPdf),
  }

  return {
    ok: true,
    localFolder,
    syncResult,
  }
}

async function syncAllUserProjects(userId) {
  const allProjects = await ProjectGetter.promises.findAllUsersProjects(
    userId,
    '_id name owner_ref trashed localFolderPath localFolderSyncEnabled localFolderLastSyncedPath'
  )

  const seen = new Set()
  const candidates = []
  for (const list of [
    allProjects.owned || [],
    allProjects.readAndWrite || [],
    allProjects.readOnly || [],
  ]) {
    for (const p of list) {
      const id = String(p._id)
      if (seen.has(id)) continue
      seen.add(id)
      if (ProjectHelper.isTrashed(p, userId)) continue
      if (p.localFolderSyncEnabled === false) continue
      candidates.push(p)
    }
  }

  const results = []
  for (const p of candidates) {
    const res = await syncProject(String(p._id), { force: false })
    results.push(res)
  }

  return {
    ok: true,
    total: candidates.length,
    syncedCount: results.filter(r => r.ok).length,
    failedCount: results.filter(r => !r.ok && !r.skipped).length,
    results,
  }
}

async function getProjectFolderInfo(projectId, userId) {
  const project = await Project.findById(projectId, {
    _id: 1,
    name: 1,
    owner_ref: 1,
    localFolderPath: 1,
    localFolderSyncEnabled: 1,
    localFolderLastSyncedAt: 1,
    localFolderLastSyncStatus: 1,
    localFolderLastSyncError: 1,
    localFolderLastSyncedPath: 1,
    localFolderFileCount: 1,
    localFolderHasPdf: 1,
  }).lean()
  if (!project) return null
  const ownerId = String(project.owner_ref || userId)
  const baseDir = await getUserBaseDir(ownerId)
  const resolved = await getResolvedProjectFolder(project, baseDir)
  return {
    customPath: project.localFolderPath || null,
    effectivePath: resolved.effectivePath,
    isCustom: resolved.isCustom,
    syncEnabled: project.localFolderSyncEnabled !== false,
    lastSyncedAt: project.localFolderLastSyncedAt
      ? new Date(project.localFolderLastSyncedAt).toISOString()
      : null,
    lastSyncedPath: project.localFolderLastSyncedPath || null,
    status:
      project.localFolderSyncEnabled === false
        ? 'disabled'
        : project.localFolderLastSyncStatus || 'not_synced',
    error: project.localFolderLastSyncError || null,
    fileCount:
      typeof project.localFolderFileCount === 'number'
        ? project.localFolderFileCount
        : null,
    hasPdf: Boolean(project.localFolderHasPdf),
  }
}

async function browseDirectories(rawPath) {
  const { statusCode, data } = await callDaemon('POST', '/browse', {
    path: rawPath || ALLOWED_ROOT,
  })
  if (statusCode !== 200 || !data?.ok) {
    const err = new Error(data?.error || 'Could not browse directory')
    err.statusCode = 400
    throw err
  }
  return data
}

async function createDirectory(rawPath) {
  const { statusCode, data } = await callDaemon('POST', '/mkdir', {
    path: rawPath,
  })
  if (statusCode !== 200 || !data?.ok) {
    const err = new Error(data?.error || 'Could not create directory')
    err.statusCode = 400
    throw err
  }
  return data
}

const LocalProjectSyncManager = {
  getSettings,
  getUserBaseDir,
  updateBaseDir,
  updateProjectFolder,
  syncProject,
  syncAllUserProjects,
  scheduleSync,
  buildProjectFolderInfoMap,
  getProjectFolderInfo,
  browseDirectories,
  createDirectory,
}

export default LocalProjectSyncManager
