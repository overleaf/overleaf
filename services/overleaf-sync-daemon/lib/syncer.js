// Bidirectional OT sync between a working directory and an Overleaf project.
//
// FS  -> Overleaf : fs.watch debounce → diff vs shadow → POST inject-op
// Overleaf -> FS  : SSE applied-ops   → apply to shadow → write file
//
// Loop guard: each outbound op carries a unique source tag. Echoes that match
// our source are dropped. Inbound applies also bump an "ignore next FS event"
// counter so chokidar callbacks from our own writes don't trigger re-diffs.

const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const chokidar = require('chokidar')
const { textToOps, applyOps } = require('./diff')

const DEBOUNCE_MS = 150

class Syncer {
  constructor({ client, workspace, userId, log }) {
    this.client = client
    this.workspace = path.resolve(workspace)
    this.userId = userId || null
    this.log = log || (() => {})
    this.sourceTag = `claude-sync:${crypto.randomBytes(4).toString('hex')}`

    // docId -> { pathname, version, shadow, pendingFlush, ignoreFsWrites }
    this.docs = new Map()
    // pathname -> docId
    this.pathnameToDocId = new Map()
    this.stream = null
    this.watcher = null
    this.debounceTimers = new Map()
  }

  async start() {
    await fs.mkdir(this.workspace, { recursive: true })
    await this._bootstrap()
    this._openStream()
    this._startWatcher()
    this.log('syncer started', {
      workspace: this.workspace,
      docs: this.docs.size,
      source: this.sourceTag,
    })
  }

  async stop() {
    if (this.watcher) await this.watcher.close()
    if (this.stream) this.stream.close()
    for (const t of this.debounceTimers.values()) clearTimeout(t)
  }

  async _bootstrap() {
    if (!this.userId) {
      throw new Error('userId required to call joinProject')
    }
    const joined = await this.client.joinProject(this.userId)
    if (!joined || !joined.project) {
      throw new Error('joinProject returned no project')
    }
    const entries = walkRootFolder(joined.project.rootFolder || [])
    for (const { docId, pathname } of entries) {
      const doc = await this.client.getDoc(docId)
      const text = (doc.lines || []).join('\n')
      const filePath = path.join(this.workspace, pathname)
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, text, 'utf8')
      this.docs.set(docId, {
        pathname,
        version: doc.version,
        shadow: text,
        ignoreFsWrites: 1, // skip the writeFile event we just caused
      })
      this.pathnameToDocId.set(pathname, docId)
    }
  }

  _openStream() {
    this.stream = this.client.openAppliedOpsStream()
    this.stream.on('open', () => this.log('applied-ops stream open'))
    this.stream.on('error', err =>
      this.log('applied-ops stream error', { err: err.message })
    )
    this.stream.on('message', msg => this._onAppliedOp(msg).catch(err => {
      this.log('applied-op handler failed', { err: err.message })
    }))
  }

  async _onAppliedOp(msg) {
    if (!msg || msg.type === 'ready') return
    if (msg.error) {
      this.log('applied-op error from server', { msg })
      return
    }
    const docId = msg.doc_id
    const applied = msg.op
    if (!docId || !applied) return
    const state = this.docs.get(docId)
    if (!state) {
      // Unknown doc — could be a newly created doc; ignore for MVP.
      return
    }
    // Loop guard: skip echoes of our own injected ops.
    const source = applied.meta && applied.meta.source
    if (source === this.sourceTag) {
      // Still advance our version tracking — server has accepted it.
      if (typeof applied.v === 'number') state.version = applied.v + 1
      return
    }

    let newShadow
    try {
      newShadow = applyOps(state.shadow, applied.op || [])
    } catch (err) {
      this.log('shadow apply failed — will resync this doc', {
        docId,
        err: err.message,
      })
      await this._resyncDoc(docId)
      return
    }

    state.shadow = newShadow
    if (typeof applied.v === 'number') state.version = applied.v + 1
    state.ignoreFsWrites = (state.ignoreFsWrites || 0) + 1

    const filePath = path.join(this.workspace, state.pathname)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, newShadow, 'utf8')
  }

  async _resyncDoc(docId) {
    const doc = await this.client.getDoc(docId)
    const text = (doc.lines || []).join('\n')
    const state = this.docs.get(docId) || {}
    state.pathname = doc.pathname || state.pathname
    state.version = doc.version
    state.shadow = text
    state.ignoreFsWrites = (state.ignoreFsWrites || 0) + 1
    this.docs.set(docId, state)
    if (state.pathname) this.pathnameToDocId.set(state.pathname, docId)
    const filePath = path.join(this.workspace, state.pathname)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, text, 'utf8')
  }

  _startWatcher() {
    this.watcher = chokidar.watch(this.workspace, {
      ignoreInitial: true,
      ignored: [/\.git\//, /node_modules\//],
      awaitWriteFinish: { stabilityThreshold: 80, pollInterval: 30 },
    })
    this.watcher.on('change', p => this._onFsChange(p))
    this.watcher.on('add', p => this._onFsChange(p))
    this.watcher.on('error', err =>
      this.log('chokidar error', { err: err.message })
    )
  }

  _onFsChange(absPath) {
    const rel = path.relative(this.workspace, absPath)
    const docId = this.pathnameToDocId.get(rel)
    if (!docId) return // unknown file (binary, new file — TODO: handle creation)
    const state = this.docs.get(docId)
    if (!state) return
    if (state.ignoreFsWrites && state.ignoreFsWrites > 0) {
      state.ignoreFsWrites -= 1
      return
    }
    // Debounce per-doc so a burst of writes coalesces.
    if (this.debounceTimers.has(docId)) {
      clearTimeout(this.debounceTimers.get(docId))
    }
    this.debounceTimers.set(
      docId,
      setTimeout(() => {
        this.debounceTimers.delete(docId)
        this._flushDoc(docId).catch(err =>
          this.log('flushDoc failed', { docId, err: err.message })
        )
      }, DEBOUNCE_MS)
    )
  }

  async _flushDoc(docId) {
    const state = this.docs.get(docId)
    if (!state) return
    const filePath = path.join(this.workspace, state.pathname)
    let current
    try {
      current = await fs.readFile(filePath, 'utf8')
    } catch (err) {
      if (err.code === 'ENOENT') return // file deleted — TODO handle
      throw err
    }
    if (current === state.shadow) return

    const ops = textToOps(state.shadow, current)
    if (ops.length === 0) return

    try {
      await this.client.injectOp(docId, {
        op: ops,
        v: state.version,
        userId: this.userId,
        source: this.sourceTag,
      })
      // Optimistically advance shadow + version. The applied-op echo will
      // confirm via _onAppliedOp's loop-guard branch.
      state.shadow = current
      state.version = state.version + 1
    } catch (err) {
      this.log('inject-op rejected, resyncing doc', {
        docId,
        err: err.message,
      })
      await this._resyncDoc(docId)
    }
  }
}

// Recursively walk a project rootFolder (the structure web/joinProject
// returns) into a flat list of { docId, pathname } for every doc.
function walkRootFolder(rootFolder, prefix = '') {
  const out = []
  for (const folder of rootFolder) {
    const docs = folder.docs || []
    for (const doc of docs) {
      out.push({
        docId: String(doc._id),
        pathname: prefix ? `${prefix}/${doc.name}` : doc.name,
      })
    }
    for (const sub of folder.folders || []) {
      const subPrefix = prefix ? `${prefix}/${sub.name}` : sub.name
      out.push(...walkRootFolder([sub], subPrefix))
    }
  }
  return out
}

module.exports = { Syncer, walkRootFolder }
