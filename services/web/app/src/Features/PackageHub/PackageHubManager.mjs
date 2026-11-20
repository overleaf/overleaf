import http from 'node:http'
import logger from '@overleaf/logger'
import { PackageHubAuditLog } from '../../models/PackageHubAuditLog.mjs'
import { PackageHubJob } from '../../models/PackageHubJob.mjs'
import { PackageHubManifest } from '../../models/PackageHubManifest.mjs'
import { PackageHubPackage } from '../../models/PackageHubPackage.mjs'

const SOCKET_PATH =
  process.env.PACKAGE_HUB_SOCKET_PATH || '/run/overleaf-package-hub/hub.sock'

function callHubDaemon(method, endpoint, body, timeoutMs = 120000) {
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
            parsed = { ok: false, error: raw || 'Invalid Package Hub response' }
          }
          resolve({ statusCode: res.statusCode || 500, data: parsed })
        })
      }
    )

    req.on('timeout', () => {
      req.destroy(new Error('Package Hub daemon timed out'))
    })
    req.on('error', err => {
      reject(
        new Error(
          `Package Hub daemon unavailable (${err?.code || err?.message})`
        )
      )
    })

    if (payload != null) req.write(payload)
    req.end()
  })
}

async function mirrorJobToMongo(job) {
  if (!job?.id) return
  try {
    await PackageHubJob.updateOne(
      { jobId: job.id },
      {
        $set: {
          jobId: job.id,
          type: job.type,
          payload: job.payload || {},
          status: job.status,
          progress: job.progress ?? 0,
          phase: job.phase || 'Queued',
          log: Array.isArray(job.log) ? job.log : [],
          error: job.error || null,
          started_at: job.started_at ? new Date(job.started_at) : null,
          finished_at: job.finished_at ? new Date(job.finished_at) : null,
          created_by: job.created_by || 'system',
        },
        $setOnInsert: {
          created_at: job.created_at ? new Date(job.created_at) : new Date(),
        },
      },
      { upsert: true }
    )
  } catch (err) {
    logger.warn({ err }, 'failed to mirror package hub job to mongo')
  }
}

async function recordAuditInMongo({
  userId,
  userEmail,
  action,
  packageName,
  source,
  result,
  details,
}) {
  try {
    await PackageHubAuditLog.create({
      user_id: String(userId || 'system'),
      user_email: String(userEmail || ''),
      action,
      package_name: String(packageName || '*'),
      source: String(source || 'texlive'),
      result: String(result || 'success'),
      details: String(details || ''),
      timestamp: new Date(),
    })
  } catch (err) {
    logger.warn({ err }, 'failed to record package hub audit log to mongo')
  }
}

async function mirrorManifestToMongo(manifest) {
  if (!manifest?.name) return
  try {
    await PackageHubManifest.updateOne(
      { name: manifest.name },
      {
        $set: {
          name: manifest.name,
          url: manifest.url || '',
          version: manifest.version || '1.0.0',
          description: manifest.description || '',
          author: manifest.author || 'community',
          packages: Array.isArray(manifest.packages) ? manifest.packages : [],
          custom_files: Array.isArray(manifest.custom_files)
            ? manifest.custom_files
            : [],
          last_synced_at: new Date(),
        },
      },
      { upsert: true }
    )
  } catch (err) {
    logger.warn({ err }, 'failed to mirror manifest to mongo')
  }
}

async function syncInstalledPackagesToMongo(items) {
  if (!Array.isArray(items)) return
  try {
    for (const item of items) {
      if (!item?.name || !item?.source) continue
      await PackageHubPackage.updateOne(
        { name: item.name, source: item.source },
        {
          $set: {
            version: item.version || '',
            description: item.shortdesc || item.description || '',
            license: item.license || '',
            author: item.author || '',
            size_kb: item.size_kb || 0,
            installed: Boolean(item.installed),
            installed_version: item.installed_version || null,
            update_available: Boolean(item.update_available),
            uploaded_by: item.uploaded_by || null,
            updated_at: new Date(),
          },
          $setOnInsert: { created_at: new Date() },
        },
        { upsert: true }
      )
    }
  } catch (err) {
    logger.warn({ err }, 'failed to mirror packages to mongo')
  }
}

function streamJobEvents(jobId, expressRes, expressReq) {
  expressRes.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  const upstreamReq = http.request(
    {
      socketPath: SOCKET_PATH,
      path: `/jobs/${encodeURIComponent(jobId)}/stream`,
      method: 'GET',
      headers: { Accept: 'text/event-stream' },
    },
    upstreamRes => {
      if (upstreamRes.statusCode && upstreamRes.statusCode >= 400) {
        expressRes.write(
          `data: ${JSON.stringify({ status: 'failed', error: 'Job not found' })}\n\n`
        )
        expressRes.end()
        return
      }
      upstreamRes.on('data', chunk => {
        expressRes.write(chunk)
        if (typeof expressRes.flush === 'function') {
          expressRes.flush()
        }
      })
      upstreamRes.on('end', () => {
        expressRes.end()
      })
    }
  )

  upstreamReq.on('error', err => {
    expressRes.write(
      `data: ${JSON.stringify({ status: 'failed', error: err.message })}\n\n`
    )
    expressRes.end()
  })

  expressReq.on('close', () => {
    upstreamReq.destroy()
  })

  upstreamReq.end()
}

export default {
  callHubDaemon,
  mirrorJobToMongo,
  recordAuditInMongo,
  mirrorManifestToMongo,
  syncInstalledPackagesToMongo,
  streamJobEvents,
}
