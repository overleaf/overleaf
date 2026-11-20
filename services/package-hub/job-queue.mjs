import crypto from 'node:crypto'
import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'

export const STATE_DIR = path.resolve(
  process.env.PACKAGE_HUB_STATE_DIR || '/var/lib/overleaf/package-hub/state'
)
const JOBS_FILE = path.join(STATE_DIR, 'jobs.json')
const AUDIT_FILE = path.join(STATE_DIR, 'audit_log.json')
const MAX_STORED_JOBS = 100
const MAX_STORED_AUDIT = 500
const MAX_CONCURRENT_JOBS = Math.max(
  1,
  Number(process.env.PACKAGE_HUB_MAX_CONCURRENT_JOBS || 3)
)

class JobQueue extends EventEmitter {
  constructor() {
    super()
    this.setMaxListeners(100)
    /** @type {Map<string, any>} */
    this.jobs = new Map()
    /** @type {Array<any>} */
    this.auditLog = []
    this.queue = []
    this.activeCount = 0
    this.tlmgrLock = Promise.resolve()
    this.initialized = false
  }

  async init() {
    if (this.initialized) return
    await fsp.mkdir(STATE_DIR, { recursive: true, mode: 0o755 })
    try {
      const rawJobs = await fsp.readFile(JOBS_FILE, 'utf8')
      const parsed = JSON.parse(rawJobs)
      if (Array.isArray(parsed)) {
        for (const j of parsed.slice(0, MAX_STORED_JOBS)) {
          // Any job still marked running from a previous process crash is marked failed
          if (j.status === 'running' || j.status === 'queued') {
            j.status = 'failed'
            j.phase = 'interrupted'
            j.error = 'Service restarted before job completed'
            j.finished_at = j.finished_at || new Date().toISOString()
          }
          this.jobs.set(j.id, j)
        }
      }
    } catch {}

    try {
      const rawAudit = await fsp.readFile(AUDIT_FILE, 'utf8')
      const parsed = JSON.parse(rawAudit)
      if (Array.isArray(parsed)) {
        this.auditLog = parsed.slice(0, MAX_STORED_AUDIT)
      }
    } catch {}

    this.initialized = true
  }

  async _persistJobs() {
    try {
      await fsp.mkdir(STATE_DIR, { recursive: true, mode: 0o755 })
      const arr = Array.from(this.jobs.values())
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, MAX_STORED_JOBS)
      const tmp = `${JOBS_FILE}.${process.pid}.tmp`
      await fsp.writeFile(tmp, JSON.stringify(arr, null, 2), 'utf8')
      await fsp.rename(tmp, JOBS_FILE)
    } catch {}
  }

  async _persistAudit() {
    try {
      await fsp.mkdir(STATE_DIR, { recursive: true, mode: 0o755 })
      const tmp = `${AUDIT_FILE}.${process.pid}.tmp`
      await fsp.writeFile(
        tmp,
        JSON.stringify(this.auditLog.slice(0, MAX_STORED_AUDIT), null, 2),
        'utf8'
      )
      await fsp.rename(tmp, AUDIT_FILE)
    } catch {}
  }

  /**
   * Serialize TeX Live database / mktexlsr mutations so concurrent jobs cannot corrupt tlpdb.
   */
  async withTlmgrLock(fn) {
    const prev = this.tlmgrLock
    let release
    this.tlmgrLock = new Promise(resolve => {
      release = resolve
    })
    await prev
    try {
      return await fn()
    } finally {
      release()
    }
  }

  recordAudit({ userId, userEmail, action, packageName, source, result, details }) {
    const entry = {
      id: crypto.randomUUID(),
      user_id: userId || 'system',
      user_email: userEmail || 'system@overleaf.local',
      action,
      package_name: packageName,
      source: source || 'texlive',
      result,
      details: details || '',
      timestamp: new Date().toISOString(),
    }
    this.auditLog.unshift(entry)
    if (this.auditLog.length > MAX_STORED_AUDIT) {
      this.auditLog.length = MAX_STORED_AUDIT
    }
    this._persistAudit()
    this.emit('audit', entry)
    return entry
  }

  getAuditLogs(limit = 100) {
    return this.auditLog.slice(0, limit)
  }

  getJob(jobId) {
    return this.jobs.get(jobId) || null
  }

  listJobs(limit = 50) {
    return Array.from(this.jobs.values())
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit)
  }

  async clearHistory(scope = 'all') {
    if (scope === 'all' || scope === 'jobs') {
      for (const [id, job] of this.jobs.entries()) {
        if (job.status !== 'running' && job.status !== 'queued') {
          this.jobs.delete(id)
        }
      }
      await this._persistJobs()
    }
    if (scope === 'all' || scope === 'audit') {
      this.auditLog = []
      await this._persistAudit()
    }
    return {
      ok: true,
      scope,
      remainingJobs: this.listJobs(50),
      remainingAuditCount: this.auditLog.length,
    }
  }

  enqueue({ type, payload, createdBy, userEmail, handler }) {
    const job = {
      id: crypto.randomUUID(),
      jobId: '',
      type,
      payload,
      status: 'queued',
      progress: 0,
      phase: 'Queued',
      message: `Queued ${type} job`,
      log: [],
      error: null,
      result: null,
      created_by: createdBy || 'system',
      created_by_email: userEmail || 'system@overleaf.local',
      created_at: new Date().toISOString(),
      started_at: null,
      finished_at: null,
    }
    job.jobId = job.id
    this.jobs.set(job.id, job)

    // Keep map bounded
    if (this.jobs.size > MAX_STORED_JOBS * 2) {
      const sorted = this.listJobs(MAX_STORED_JOBS)
      this.jobs = new Map(sorted.map(j => [j.id, j]))
    }

    this._persistJobs()
    this.queue.push({ job, handler })
    this._pump()
    return job
  }

  _emitJobEvent(job, extra = {}) {
    const event = {
      jobId: job.id,
      type: job.type,
      status: job.status,
      phase: job.phase,
      message: extra.message || job.message,
      percent: job.progress,
      logLine: extra.logLine || null,
      error: job.error,
      result: job.result,
      updatedAt: new Date().toISOString(),
    }
    this.emit(`job:${job.id}`, event)
    this.emit('job', event)
  }

  _pump() {
    while (this.activeCount < MAX_CONCURRENT_JOBS && this.queue.length > 0) {
      const nextItem = this.queue.shift()
      this.activeCount++
      this._runItem(nextItem).finally(() => {
        this.activeCount--
        this._pump()
      })
    }
  }

  async _runItem({ job, handler }) {
    job.status = 'running'
    job.started_at = new Date().toISOString()
    job.phase = 'Starting'
    job.progress = 5
    job.message = `Starting ${job.type}...`
    this._emitJobEvent(job)

    const ctx = {
      job,
      appendLog: line => {
        if (!line) return
        const text = String(line)
        job.log.push(`[${new Date().toISOString()}] ${text}`)
        if (job.log.length > 500) {
          job.log.shift()
        }
        this._emitJobEvent(job, { logLine: text })
      },
      setProgress: (percent, phase, message) => {
        job.progress = Math.max(0, Math.min(100, Math.round(percent)))
        if (phase) job.phase = phase
        if (message) {
          job.message = message
          job.log.push(`[${new Date().toISOString()}] ${message}`)
        }
        this._emitJobEvent(job, { message: message || job.message })
      },
      withTlmgrLock: fn => this.withTlmgrLock(fn),
    }

    try {
      const result = await handler(ctx)
      job.status = 'success'
      job.progress = 100
      job.phase = 'Completed'
      job.message = result?.message || 'Completed successfully'
      job.result = result || { ok: true }
      job.finished_at = new Date().toISOString()
      this._emitJobEvent(job)
    } catch (err) {
      job.status = 'failed'
      job.phase = 'Failed'
      job.error = err?.message || String(err)
      job.message = job.error
      job.log.push(`[${new Date().toISOString()}] ERROR: ${job.error}`)
      job.finished_at = new Date().toISOString()
      this._emitJobEvent(job)
    } finally {
      await this._persistJobs()
    }
  }
}

export const jobQueue = new JobQueue()
