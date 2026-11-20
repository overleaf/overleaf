import fs from 'node:fs'
import fsp from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { jobQueue } from './job-queue.mjs'
import { getOpenApiSpec } from './openapi.mjs'
import {
  TEXMFLOCAL,
  isPathEqualOrInside,
  isProtectedPackage,
  validatePackageName,
} from './security-utils.mjs'
import { communitySource } from './sources/community-source.mjs'
import { ctanSource } from './sources/ctan-source.mjs'
import { customSource } from './sources/custom-source.mjs'
import { scanAndReconcile } from './sources/filesystem-scanner.mjs'
import { texliveSource } from './sources/texlive-source.mjs'
import { stateStore } from './state-store.mjs'
import { tlpdbCache } from './tlpdb-parser.mjs'

const SOCKET_PATH =
  process.env.PACKAGE_HUB_SOCKET_PATH || '/run/overleaf-package-hub/hub.sock'
const HTTP_PORT = Number(process.env.PACKAGE_HUB_PORT || 3045)
const HTTP_HOST = process.env.PACKAGE_HUB_HOST || '127.0.0.1'
const MAX_BODY_BYTES = 10 * 1024 * 1024

const ALLOWED_UPLOAD_STAGES = [
  path.resolve('/var/lib/overleaf/tmp/uploads'),
  path.resolve('/tmp'),
]

function log(level, msg, meta = {}) {
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    name: 'package-hub',
    msg,
    ...meta,
  })
  if (level === 'error') {
    process.stderr.write(line + '\n')
  } else {
    process.stdout.write(line + '\n')
  }
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', c => {
      size += c.length
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Request body too large'), { statusCode: 413 }))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => {
      if (chunks.length === 0) return resolve({})
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(Object.assign(new Error('Invalid JSON payload'), { statusCode: 400 }))
      }
    })
    req.on('error', reject)
  })
}

async function aggregatePackages({
  source = 'all',
  status = 'all',
  sort = 'name',
  q = '',
  page = 1,
  limit = 24,
} = {}) {
  const searchStr = String(q || '').trim().toLowerCase()
  const srcFilter = String(source || 'all').toLowerCase()
  const statusFilter = String(status || 'all').toLowerCase()

  const [texliveList, ctanList, customList, communityList] = await Promise.all([
    srcFilter === 'all' || srcFilter === 'texlive' ? texliveSource.list() : Promise.resolve([]),
    srcFilter === 'all' || srcFilter === 'ctan' ? ctanSource.list() : Promise.resolve([]),
    srcFilter === 'all' || srcFilter === 'custom' ? customSource.list() : Promise.resolve([]),
    srcFilter === 'all' || srcFilter === 'community' ? communitySource.list() : Promise.resolve([]),
  ])

  // Merge by package name priority: custom > ctan (if installed in ctan) > texlive > ctan (catalog) > community
  const ctanInstalledMap = stateStore.getState().ctanPackages || {}
  const byKey = new Map()
  for (const p of texliveList) {
    const ctanRec = ctanInstalledMap[p.name]
    if (!p.installed && ctanRec) {
      byKey.set(`pkg:${p.name}`, {
        ...p,
        installed: true,
        installed_version: ctanRec.version || p.version,
      })
    } else {
      byKey.set(`pkg:${p.name}`, p)
    }
  }
  for (const p of ctanList) {
    const key = `pkg:${p.name}`
    if (!byKey.has(key) || p.installed) {
      byKey.set(key, p)
    }
  }
  for (const p of customList) {
    byKey.set(`custom:${p.name}`, p)
  }
  for (const p of communityList) {
    byKey.set(`community:${p.name}`, p)
  }

  let items = Array.from(byKey.values())

  // Compute source/status summary counts across the current source slice before status/search filters
  const counts = {
    all: items.length,
    installed: 0,
    available: 0,
    updates: 0,
    custom: 0,
    community: 0,
  }
  for (const item of items) {
    if (item.installed) counts.installed++
    else counts.available++
    if (item.update_available) counts.updates++
    if (item.source === 'custom') counts.custom++
    if (item.source === 'community') counts.community++
  }

  if (statusFilter === 'installed') {
    items = items.filter(p => p.installed)
  } else if (statusFilter === 'available') {
    items = items.filter(p => !p.installed)
  } else if (statusFilter === 'updates') {
    items = items.filter(p => p.update_available)
  } else if (statusFilter === 'custom') {
    items = items.filter(p => p.source === 'custom')
  } else if (statusFilter === 'community') {
    items = items.filter(p => p.source === 'community')
  }

  if (searchStr) {
    items = items.filter(
      p =>
        p.name.toLowerCase().includes(searchStr) ||
        (p.shortdesc || '').toLowerCase().includes(searchStr) ||
        (p.description || '').toLowerCase().includes(searchStr) ||
        (p.topics || []).some(t => t.toLowerCase().includes(searchStr))
    )
  }

  if (sort === 'size') {
    items.sort((a, b) => (b.size_kb || 0) - (a.size_kb || 0) || a.name.localeCompare(b.name))
  } else if (sort === 'recent') {
    items.sort((a, b) => {
      if (a.installed !== b.installed) return a.installed ? -1 : 1
      const ta = a.updated_at || a.created_at || ''
      const tb = b.updated_at || b.created_at || ''
      return tb.localeCompare(ta) || a.name.localeCompare(b.name)
    })
  } else {
    items.sort((a, b) => {
      if (searchStr) {
        const aExact = a.name.toLowerCase() === searchStr
        const bExact = b.name.toLowerCase() === searchStr
        if (aExact !== bExact) return aExact ? -1 : 1
        const aPrefix = a.name.toLowerCase().startsWith(searchStr)
        const bPrefix = b.name.toLowerCase().startsWith(searchStr)
        if (aPrefix !== bPrefix) return aPrefix ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })
  }

  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 24))
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / safeLimit))
  const safePage = Math.max(1, Math.min(totalPages, Number(page) || 1))
  const start = (safePage - 1) * safeLimit
  const paged = items.slice(start, start + safeLimit)

  return {
    items: paged,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages,
    counts,
  }
}

async function getPackageDetail(name) {
  if (!validatePackageName(name)) {
    const err = new Error(`Invalid package name: ${name}`)
    err.statusCode = 400
    throw err
  }
  const [customMeta, ctanMeta, tlMeta, commMeta] = await Promise.all([
    customSource.getMetadata(name),
    ctanSource.getMetadata(name),
    texliveSource.getMetadata(name),
    communitySource.getMetadata(name),
  ])
  if (customMeta) return customMeta
  if (ctanMeta?.installed && (!tlMeta || !tlMeta.installed)) return ctanMeta
  return tlMeta || ctanMeta || commMeta || null
}

function assertUploadPathAllowed(filePath) {
  const resolved = path.resolve(String(filePath || ''))
  const ok = ALLOWED_UPLOAD_STAGES.some(base => isPathEqualOrInside(resolved, base))
  if (!ok) {
    const err = new Error('Upload temp file path is outside allowed staging root')
    err.statusCode = 400
    throw err
  }
  if (!fs.existsSync(resolved)) {
    const err = new Error('Uploaded file not found on disk')
    err.statusCode = 400
    throw err
  }
  return resolved
}

async function handleDockerCommitSnapshot(userEmail) {
  const tag = `custom-${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)}`
  const dockerSock = '/var/run/docker.sock'
  const hostname = process.env.HOSTNAME || 'sharelatex'

  // Always save a persistent snapshot manifest under /var/lib/overleaf/package-hub/snapshots
  const snapDir = path.resolve(
    process.env.PACKAGE_HUB_SNAPSHOT_DIR || '/var/lib/overleaf/package-hub/snapshots'
  )
  await fsp.mkdir(snapDir, { recursive: true, mode: 0o755 })
  const manifestSnapPath = path.join(snapDir, `snapshot-${tag}.json`)
  await fsp.writeFile(
    manifestSnapPath,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        createdBy: userEmail || 'admin',
        tag,
        persistentState: stateStore.getState(),
        mirrorUrl: stateStore.getMirrorUrl(),
        texmfLocal: TEXMFLOCAL,
      },
      null,
      2
    ) + '\n',
    'utf8'
  )

  if (!fs.existsSync(dockerSock)) {
    return {
      ok: true,
      mode: 'manifest-snapshot',
      tag,
      snapshotPath: manifestSnapPath,
      message: `Saved persistent Package Hub snapshot (${tag}). Volume mount at ${TEXMFLOCAL} preserves all packages automatically.`,
    }
  }

  // Trigger Docker engine commit via Unix socket
  const commitResult = await new Promise((resolve, reject) => {
    const query = new URLSearchParams({
      container: hostname,
      repo: 'codemolabs/overleaf',
      tag,
      comment: `COSL Overleaf Package Hub snapshot ${tag}`,
    })
    const req = http.request(
      {
        socketPath: dockerSock,
        path: `/commit?${query.toString()}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': 2 },
        timeout: 120000,
      },
      res => {
        const chunks = []
        res.on('data', c => chunks.push(c))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          try {
            const parsed = JSON.parse(text)
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed)
            } else {
              reject(new Error(parsed.message || `Docker commit HTTP ${res.statusCode}`))
            }
          } catch {
            reject(new Error(text || `Docker commit HTTP ${res.statusCode}`))
          }
        })
      }
    )
    req.on('error', reject)
    req.write('{}')
    req.end()
  })

  return {
    ok: true,
    mode: 'docker-commit',
    image: `codemolabs/overleaf:${tag}`,
    imageId: commitResult.Id || '',
    snapshotPath: manifestSnapPath,
    message: `Committed container image codemolabs/overleaf:${tag}`,
  }
}

async function handleRequest(req, res) {
  const parsedUrl = new URL(req.url, 'http://localhost')
  const pathname = parsedUrl.pathname
  const query = Object.fromEntries(parsedUrl.searchParams.entries())

  try {
    // Health
    if (req.method === 'GET' && pathname === '/health') {
      const texliveList = await texliveSource.list()
      return sendJson(res, 200, {
        ok: true,
        service: 'package-hub',
        installedCount: texliveList.filter(p => p.installed).length,
        availableCount: texliveList.length,
        mirrorUrl: stateStore.getMirrorUrl(),
        lastReconciledAt: stateStore.getState().lastReconciledAt,
      })
    }

    // OpenAPI spec
    if (req.method === 'GET' && pathname === '/docs') {
      return sendJson(res, 200, getOpenApiSpec())
    }

    // List all packages (paginated, cached)
    if (req.method === 'GET' && pathname === '/packages') {
      const data = await aggregatePackages(query)
      return sendJson(res, 200, data)
    }

    // Installed packages
    if (req.method === 'GET' && pathname === '/packages/installed') {
      const [tl, ct, cu] = await Promise.all([
        texliveSource.getInstalled(),
        ctanSource.list().then(l => l.filter(p => p.installed)),
        customSource.list(),
      ])
      return sendJson(res, 200, [...cu, ...ct, ...tl])
    }

    // Search
    if (req.method === 'GET' && pathname === '/packages/search') {
      const q = String(query.q || '').trim()
      if (!q) {
        return sendJson(res, 200, [])
      }
      const [tl, cu, comm, ct] = await Promise.all([
        texliveSource.search(q),
        customSource.search(q),
        communitySource.search(q),
        ctanSource.search(q),
      ])
      const seen = new Set()
      const merged = []
      for (const item of [...cu, ...ct, ...comm, ...tl]) {
        const k = `${item.source}:${item.name}`
        if (!seen.has(k)) {
          seen.add(k)
          merged.push(item)
        }
      }
      return sendJson(res, 200, merged.slice(0, 100))
    }

    // Updates
    if (req.method === 'GET' && pathname === '/packages/updates') {
      const updates = await texliveSource.getUpdates()
      return sendJson(res, 200, updates)
    }

    // Audit log
    if (req.method === 'GET' && pathname === '/audit') {
      const limit = Number(query.limit || 100)
      return sendJson(res, 200, { ok: true, items: jobQueue.getAuditLogs(limit) })
    }

    // Jobs list
    if (req.method === 'GET' && pathname === '/jobs') {
      const limit = Number(query.limit || 40)
      return sendJson(res, 200, { ok: true, items: jobQueue.listJobs(limit) })
    }

    // Single job poll
    const jobPollMatch = pathname.match(/^\/jobs\/([^/]+)$/)
    if (req.method === 'GET' && jobPollMatch) {
      const job = jobQueue.getJob(decodeURIComponent(jobPollMatch[1]))
      if (!job) return sendJson(res, 404, { ok: false, error: 'Job not found' })
      return sendJson(res, 200, job)
    }

    // Job SSE stream
    const jobStreamMatch = pathname.match(/^\/jobs\/([^/]+)\/stream$/)
    if (req.method === 'GET' && jobStreamMatch) {
      const jobId = decodeURIComponent(jobStreamMatch[1])
      const job = jobQueue.getJob(jobId)
      if (!job) return sendJson(res, 404, { ok: false, error: 'Job not found' })

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      })

      const writeEvent = payload => {
        res.write(`data: ${JSON.stringify(payload)}\n\n`)
      }

      // Send current snapshot immediately
      writeEvent({
        jobId: job.id,
        type: job.type,
        status: job.status,
        phase: job.phase,
        message: job.message,
        percent: job.progress,
        error: job.error,
        result: job.result,
        log: job.log,
      })

      if (job.status === 'success' || job.status === 'failed') {
        res.end()
        return
      }

      const listener = ev => {
        writeEvent(ev)
        if (ev.status === 'success' || ev.status === 'failed') {
          cleanup()
          res.end()
        }
      }
      const heartbeat = setInterval(() => {
        res.write(': keepalive\n\n')
      }, 15000)

      const cleanup = () => {
        clearInterval(heartbeat)
        jobQueue.off(`job:${jobId}`, listener)
      }

      jobQueue.on(`job:${jobId}`, listener)
      req.on('close', cleanup)
      return
    }

    // Package detail
    const pkgDetailMatch = pathname.match(/^\/packages\/([^/]+)$/)
    if (req.method === 'GET' && pkgDetailMatch) {
      const name = decodeURIComponent(pkgDetailMatch[1])
      const detail = await getPackageDetail(name)
      if (!detail) return sendJson(res, 404, { ok: false, error: `Package "${name}" not found` })
      return sendJson(res, 200, detail)
    }

    // Sources health & config
    if (req.method === 'GET' && pathname === '/sources') {
      const [tl, ct, cu, comm] = await Promise.all([
        texliveSource.list(),
        ctanSource.list(),
        customSource.list(),
        communitySource.listManifests(),
      ])
      return sendJson(res, 200, [
        {
          id: 'texlive',
          name: 'TeX Live (tlmgr / TLPDB)',
          healthy: true,
          mirrorUrl: stateStore.getMirrorUrl(),
          availableCount: tl.length,
          installedCount: tl.filter(p => p.installed).length,
        },
        {
          id: 'ctan',
          name: 'CTAN Mirrors (Direct Downloads)',
          healthy: true,
          endpoint: 'https://ctan.org/json/2.0',
          cachedCount: ct.length,
          installedCount: ct.filter(p => p.installed).length,
        },
        {
          id: 'custom',
          name: 'Custom Uploads (.sty/.cls/.zip)',
          healthy: true,
          texmfDir: path.join(TEXMFLOCAL, 'tex/latex/custom'),
          installedCount: cu.length,
        },
        {
          id: 'community',
          name: 'Community Package Sets',
          healthy: true,
          manifestCount: comm.length,
        },
      ])
    }

    if (req.method === 'GET' && pathname === '/sources/community') {
      const manifests = await communitySource.listManifests()
      return sendJson(res, 200, manifests)
    }

    // Mutating endpoints
    if (req.method === 'POST') {
      const body = await readJsonBody(req)
      const userId = body._userId || 'system'
      const userEmail = body._userEmail || 'system@overleaf.local'

      if (pathname === '/packages/install') {
        const names = Array.isArray(body.names) ? body.names : []
        const source = body.source || 'texlive'
        if (names.length === 0) {
          return sendJson(res, 400, { ok: false, error: 'names array is required' })
        }
        for (const n of names) {
          if (!validatePackageName(n)) {
            return sendJson(res, 400, { ok: false, error: `Invalid package name: ${n}` })
          }
        }

        const job = jobQueue.enqueue({
          type: source === 'community' ? 'community-install' : 'install',
          payload: { names, source },
          createdBy: userId,
          userEmail,
          handler: async ctx => {
            try {
              let out
              if (source === 'community') {
                const results = []
                for (const mName of names) {
                  results.push(await communitySource.installManifest(mName, ctx))
                }
                out = {
                  ok: true,
                  results,
                  message: results.map(r => r.message).join('; '),
                }
              } else if (source === 'ctan') {
                const ctanDone = []
                for (const n of names) {
                  try {
                    const r = await ctanSource.install([n], ctx)
                    ctanDone.push(...(r.installed || [n]))
                  } catch (ctanErr) {
                    const tlMeta = await tlpdbCache.getTexlivePackage(n)
                    if (tlMeta) {
                      ctx.appendLog(
                        `CTAN mirror fallback triggered for "${n}" (${ctanErr.message}); installing via TeX Live...`
                      )
                      const r = await texliveSource.install([n], ctx)
                      ctanDone.push(...(r.installed || [n]))
                    } else {
                      throw ctanErr
                    }
                  }
                }
                out = {
                  ok: true,
                  installed: ctanDone,
                  message: `Installed CTAN package(s): ${ctanDone.join(', ')}`,
                }
              } else {
                await tlpdbCache.ensureLoaded()
                const tlNames = []
                const ctanFallbackNames = []
                for (const n of names) {
                  const local = await tlpdbCache.getLocalEntry(n)
                  const remote = await tlpdbCache.getRemoteEntry(n)
                  if (local || remote) {
                    tlNames.push(n)
                  } else {
                    ctanFallbackNames.push(n)
                  }
                }
                const installedAll = []
                if (tlNames.length > 0) {
                  try {
                    const tlRes = await texliveSource.install(tlNames, ctx)
                    installedAll.push(...(tlRes.installed || tlNames))
                  } catch (tlErr) {
                    ctx.appendLog(
                      `TeX Live install failed (${tlErr.message}); trying CTAN fallback for ${tlNames.join(', ')}...`
                    )
                    const ctRes = await ctanSource.install(tlNames, ctx)
                    installedAll.push(...(ctRes.installed || tlNames))
                  }
                }
                if (ctanFallbackNames.length > 0) {
                  ctx.appendLog(
                    `Package(s) not in TeX Live catalog (${ctanFallbackNames.join(', ')}); installing via CTAN...`
                  )
                  const ctRes = await ctanSource.install(ctanFallbackNames, ctx)
                  installedAll.push(...(ctRes.installed || ctanFallbackNames))
                }
                out = {
                  ok: true,
                  installed: installedAll,
                  message: `Installed ${installedAll.join(', ')}`,
                }
              }
              for (const n of names) {
                jobQueue.recordAudit({
                  userId,
                  userEmail,
                  action: source === 'community' ? 'install-community-pack' : 'install',
                  packageName: n,
                  source,
                  result: 'success',
                  details: out.message,
                })
              }
              return out
            } catch (err) {
              for (const n of names) {
                jobQueue.recordAudit({
                  userId,
                  userEmail,
                  action: 'install',
                  packageName: n,
                  source,
                  result: 'failed',
                  details: err.message,
                })
              }
              throw err
            }
          },
        })
        return sendJson(res, 202, { ok: true, jobId: job.id, job })
      }

      if (pathname === '/packages/remove') {
        const names = Array.isArray(body.names) ? body.names : []
        const source = body.source || 'auto'
        if (names.length === 0) {
          return sendJson(res, 400, { ok: false, error: 'names array is required' })
        }
        for (const n of names) {
          if (!validatePackageName(n)) {
            return sendJson(res, 400, { ok: false, error: `Invalid package name: ${n}` })
          }
          if (isProtectedPackage(n)) {
            jobQueue.recordAudit({
              userId,
              userEmail,
              action: 'remove',
              packageName: n,
              source,
              result: 'blocked',
              details: 'Protected core package',
            })
            return sendJson(res, 409, {
              ok: false,
              error: `Package "${n}" is protected and cannot be removed because Overleaf / LaTeX Core depends on it.`,
              code: 'PROTECTED_PACKAGE',
            })
          }
        }

        const job = jobQueue.enqueue({
          type: 'remove',
          payload: { names, source },
          createdBy: userId,
          userEmail,
          handler: async ctx => {
            try {
              await tlpdbCache.ensureLoaded(true)
              const removedAll = []
              for (const n of names) {
                const isCustom = Boolean(stateStore.getState().customPackages?.[n])
                const isCtan = Boolean(stateStore.getState().ctanPackages?.[n])
                const isTexlive = Boolean(
                  (await tlpdbCache.getLocalEntry(n)) ||
                    stateStore.getState().texlivePackages?.[n]
                )
                let usedSource = source

                if (source === 'custom') {
                  await customSource.remove([n], ctx)
                  usedSource = 'custom'
                } else {
                  let removedAny = false
                  if (isCtan || source === 'ctan') {
                    await ctanSource.remove([n], ctx)
                    usedSource = 'ctan'
                    removedAny = true
                  }
                  if (isTexlive || source === 'texlive') {
                    await texliveSource.remove([n], ctx)
                    usedSource = isCtan ? 'ctan+texlive' : 'texlive'
                    removedAny = true
                  }
                  if (!removedAny && isCustom) {
                    await customSource.remove([n], ctx)
                    usedSource = 'custom'
                    removedAny = true
                  }
                  if (!removedAny) {
                    await texliveSource.remove([n], ctx)
                  }
                }
                removedAll.push(n)
                jobQueue.recordAudit({
                  userId,
                  userEmail,
                  action: 'remove',
                  packageName: n,
                  source: usedSource,
                  result: 'success',
                  details: `Removed ${n}`,
                })
              }
              return { ok: true, removed: removedAll, message: `Removed ${removedAll.join(', ')}` }
            } catch (err) {
              for (const n of names) {
                jobQueue.recordAudit({
                  userId,
                  userEmail,
                  action: 'remove',
                  packageName: n,
                  source,
                  result: 'failed',
                  details: err.message,
                })
              }
              throw err
            }
          },
        })
        return sendJson(res, 202, { ok: true, jobId: job.id, job })
      }

      if (pathname === '/packages/update') {
        const names = Array.isArray(body.names) ? body.names : []
        const all = Boolean(body.all)
        if (!all && names.length === 0) {
          return sendJson(res, 400, { ok: false, error: 'Provide names array or all: true' })
        }
        for (const n of names) {
          if (!validatePackageName(n)) {
            return sendJson(res, 400, { ok: false, error: `Invalid package name: ${n}` })
          }
        }

        const job = jobQueue.enqueue({
          type: 'update',
          payload: { names, all },
          createdBy: userId,
          userEmail,
          handler: async ctx => {
            try {
              let out
              if (all) {
                out = await texliveSource.update(names, true, ctx)
              } else {
                const ctanState = stateStore.getState().ctanPackages || {}
                const ctanTargets = names.filter(n => Boolean(ctanState[n]))
                const tlTargets = names.filter(n => !ctanState[n])
                const updatedAll = []
                if (tlTargets.length > 0) {
                  const tlOut = await texliveSource.update(tlTargets, false, ctx)
                  updatedAll.push(...(tlOut.updated || []))
                }
                if (ctanTargets.length > 0) {
                  const ctOut = await ctanSource.update(ctanTargets, ctx)
                  updatedAll.push(...(ctOut.updated || []))
                }
                out = {
                  ok: true,
                  updated: updatedAll,
                  message: `Updated ${updatedAll.join(', ')}`,
                }
              }
              jobQueue.recordAudit({
                userId,
                userEmail,
                action: 'update',
                packageName: all ? '--all' : names.join(','),
                source: 'texlive',
                result: 'success',
                details: out.message,
              })
              return out
            } catch (err) {
              jobQueue.recordAudit({
                userId,
                userEmail,
                action: 'update',
                packageName: all ? '--all' : names.join(','),
                source: 'texlive',
                result: 'failed',
                details: err.message,
              })
              throw err
            }
          },
        })
        return sendJson(res, 202, { ok: true, jobId: job.id, job })
      }

      if (pathname === '/packages/upload/validate') {
        const safePath = assertUploadPathAllowed(body.tempFilePath)
        const validation = await customSource.validateUpload(
          safePath,
          body.originalName,
          body.packageName
        )
        return sendJson(res, 200, validation)
      }

      if (pathname === '/packages/upload') {
        const safePath = assertUploadPathAllowed(body.tempFilePath)
        // Quick pre-check of filename & extension before queuing
        const dryPreviewName = body.packageName || body.originalName || 'custom-pkg'
        const job = jobQueue.enqueue({
          type: 'upload',
          payload: { originalName: body.originalName, packageName: body.packageName },
          createdBy: userId,
          userEmail,
          handler: async ctx => {
            try {
              const out = await customSource.installUpload(
                safePath,
                body.originalName,
                {
                  packageName: body.packageName,
                  description: body.description,
                  version: body.version,
                  userId,
                  userEmail,
                },
                ctx
              )
              jobQueue.recordAudit({
                userId,
                userEmail,
                action: 'upload',
                packageName: out.packageName,
                source: 'custom',
                result: 'success',
                details: out.message,
              })
              return out
            } catch (err) {
              jobQueue.recordAudit({
                userId,
                userEmail,
                action: 'upload',
                packageName: dryPreviewName,
                source: 'custom',
                result: 'failed',
                details: err.message,
              })
              throw err
            }
          },
        })
        return sendJson(res, 202, { ok: true, jobId: job.id, packageName: dryPreviewName, job })
      }

      if (pathname === '/packages/reconcile') {
        const report = await scanAndReconcile()
        jobQueue.recordAudit({
          userId,
          userEmail,
          action: 'reconcile',
          packageName: '*',
          source: 'filesystem',
          result: 'success',
          details: `Custom +${report.discoveredCustom.length}, CTAN +${report.discoveredCtan.length}, Repaired +${report.repairedTexlive.length}`,
        })
        return sendJson(res, 200, { ok: true, report })
      }

      if (pathname === '/packages/snapshot') {
        const snap = await handleDockerCommitSnapshot(userEmail)
        jobQueue.recordAudit({
          userId,
          userEmail,
          action: 'snapshot',
          packageName: snap.image || snap.tag || 'snapshot',
          source: 'system',
          result: 'success',
          details: snap.message,
        })
        return sendJson(res, 200, snap)
      }

      if (pathname === '/sources/community') {
        const manifest = await communitySource.registerManifest({
          manifestUrl: body.manifestUrl,
          manifest: body.manifest,
        })
        jobQueue.recordAudit({
          userId,
          userEmail,
          action: 'register-community-manifest',
          packageName: manifest.name,
          source: 'community',
          result: 'success',
          details: `Registered ${manifest.name} v${manifest.version}`,
        })
        return sendJson(res, 200, { ok: true, manifest })
      }

      if (pathname === '/sources/texlive/mirror') {
        const out = await texliveSource.setMirror(body.url)
        jobQueue.recordAudit({
          userId,
          userEmail,
          action: 'set-mirror',
          packageName: 'texlive',
          source: 'texlive',
          result: 'success',
          details: `Switched repository mirror to ${out.mirrorUrl}`,
        })
        return sendJson(res, 200, out)
      }

      if (pathname === '/history/clear' || pathname === '/jobs/clear') {
        const scope = ['all', 'jobs', 'audit'].includes(body.scope)
          ? body.scope
          : 'all'
        const out = await jobQueue.clearHistory(scope)
        return sendJson(res, 200, out)
      }
    }

    // DELETE /packages/custom/:name
    const customDelMatch = pathname.match(/^\/packages\/custom\/([^/]+)$/)
    if (req.method === 'DELETE' && customDelMatch) {
      const name = decodeURIComponent(customDelMatch[1])
      const userId = query.userId || 'system'
      const userEmail = query.userEmail || 'system@overleaf.local'
      const out = await customSource.remove([name])
      jobQueue.recordAudit({
        userId,
        userEmail,
        action: 'delete-custom',
        packageName: name,
        source: 'custom',
        result: 'success',
        details: out.message,
      })
      return sendJson(res, 200, out)
    }

    return sendJson(res, 404, { ok: false, error: 'Not found' })
  } catch (err) {
    const status = err?.statusCode || 500
    log('error', 'package-hub request failed', {
      method: req.method,
      url: req.url,
      status,
      err: err?.message || String(err),
    })
    return sendJson(res, status, {
      ok: false,
      error: err?.message || 'Internal package-hub error',
    })
  }
}

async function main() {
  await stateStore.init()
  await jobQueue.init()
  await tlpdbCache.ensureLoaded(true)

  // Reconcile persisted packages in background on startup
  scanAndReconcile()
    .then(report => {
      log('info', 'initial filesystem reconciliation complete', report)
    })
    .catch(err => {
      log('error', 'initial reconciliation failed', { err: err?.message })
    })

  // Unix domain socket server (primary IPC for services/web)
  try {
    await fsp.mkdir(path.dirname(SOCKET_PATH), { recursive: true, mode: 0o755 })
    await fsp.unlink(SOCKET_PATH)
  } catch {}

  const unixServer = http.createServer(handleRequest)
  unixServer.listen(SOCKET_PATH, () => {
    try {
      fs.chmodSync(SOCKET_PATH, 0o666)
    } catch (err) {
      log('warn', 'could not chmod socket', { SOCKET_PATH, err: err?.message })
    }
    log('info', 'package-hub unix socket listening', { socketPath: SOCKET_PATH })
  })

  // Optional internal loopback HTTP server on 127.0.0.1:3045 for direct CLI inspection
  const tcpServer = http.createServer(handleRequest)
  tcpServer.listen(HTTP_PORT, HTTP_HOST, () => {
    log('info', 'package-hub tcp server listening', { host: HTTP_HOST, port: HTTP_PORT })
  })

  function shutdown() {
    unixServer.close(() => {
      try {
        fs.unlinkSync(SOCKET_PATH)
      } catch {}
    })
    tcpServer.close(() => process.exit(0))
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    log('error', 'fatal startup error', { err: err?.stack || err?.message })
    process.exit(1)
  })
}
