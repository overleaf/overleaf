// Bidirectional sync between a working directory and an Overleaf project.
//
//   Outbound (FS → Overleaf)
//     edit text doc       diff vs shadow → POST /inject-op
//     create text file    POST /internal/ai-sync/.../doc
//     create folder       POST /internal/ai-sync/.../folder
//     delete file/folder  DELETE /internal/ai-sync/.../entity/...
//
//   Inbound (Overleaf → FS)
//     applied-op SSE      apply ops to shadow → write file
//     editor-events SSE   reciveNewDoc/Folder/File, reciveEntityRename,
//                         reciveEntityMove, removeEntity → mutate workspace
//
// Loop guards:
//   * Outbound ops carry source = this.sourceTag (random) on OT ops, and
//     'claude-sync' on structural changes. Inbound echoes matching are
//     dropped.
//   * Every workspace write bumps a per-path ignoreFsWrites counter so the
//     next chokidar callback for that path is swallowed.
//
// Both directions handle binary files: bootstrap downloads them through
// the filestore-backed internal endpoint, and outbound uploads them via
// /internal/ai-sync/.../file (raw octet-stream). Works on Overleaf CE
// without git-bridge.

const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const chokidar = require('chokidar')
const { textToOps, applyOps } = require('./diff')
const { StructureIndex } = require('./structure')

const DEBOUNCE_MS = 150
const STRUCT_SOURCE = 'claude-sync'

// Extensions we treat as text (round-trip through doc-updater as OT ops).
// Anything else is uploaded as a binary file (no OT — replaces on each
// edit). Keep aligned with settings.defaults.js#defaultTextExtensions
// where reasonable.
const TEXT_EXTENSIONS = new Set([
  'tex', 'latex', 'sty', 'cls', 'bst', 'bib', 'bibtex', 'txt', 'tikz', 'mtx',
  'rtex', 'md', 'asy', 'lbx', 'bbx', 'cbx', 'm', 'lco', 'dtx', 'ins', 'ltx',
  'sbx', 'def', 'clo', 'ldf', 'rmd', 'lua', 'gv', 'mf', 'yml', 'yaml', 'json',
  'js', 'ts', 'tsx', 'jsx', 'py', 'sh', 'r', 'csv', 'tsv', 'xml', 'html',
  'css', 'svg',
])

function isTextPath(pathname) {
  const ext = path.extname(pathname).slice(1).toLowerCase()
  return TEXT_EXTENSIONS.has(ext)
}

class Syncer {
  constructor({ client, workspace, userId, log }) {
    this.client = client
    this.workspace = path.resolve(workspace)
    this.userId = userId || null
    this.log = log || (() => {})
    this.sourceTag = `${STRUCT_SOURCE}:${crypto.randomBytes(4).toString('hex')}`

    this.structure = new StructureIndex()
    // docId -> { pathname, version, shadow }
    this.docs = new Map()
    // pathname -> count of incoming writes to ignore from chokidar
    this.ignoreFsWrites = new Map()

    this.appliedOpsStream = null
    this.editorEventsStream = null
    this.watcher = null
    this.flushTimers = new Map() // docId -> Timeout
    this.structTimers = new Map() // pathname -> Timeout (for add/unlink)
  }

  async start() {
    await fs.mkdir(this.workspace, { recursive: true })
    await this._bootstrap()
    this._openAppliedOpsStream()
    this._openEditorEventsStream()
    this._startWatcher()
    this.log('syncer started', {
      workspace: this.workspace,
      docs: this.docs.size,
      source: this.sourceTag,
    })
  }

  async stop() {
    if (this.watcher) await this.watcher.close()
    if (this.appliedOpsStream) this.appliedOpsStream.close()
    if (this.editorEventsStream) this.editorEventsStream.close()
    for (const t of this.flushTimers.values()) clearTimeout(t)
    for (const t of this.structTimers.values()) clearTimeout(t)
  }

  // -------------------- bootstrap --------------------

  async _bootstrap() {
    if (!this.userId) throw new Error('userId required to call joinProject')
    const joined = await this.client.joinProject(this.userId)
    if (!joined?.project) throw new Error('joinProject returned no project')
    this.structure.loadFromRootFolder(joined.project.rootFolder || [])

    // Materialize each entry. Docs go through doc-updater (so we get a
    // current version stamp); files come from filestore.
    for (const [pathname, entry] of this.structure.byPath) {
      if (!pathname) continue // skip root
      const absPath = path.join(this.workspace, pathname)
      if (entry.type === 'folder') {
        await fs.mkdir(absPath, { recursive: true })
      } else if (entry.type === 'doc') {
        await fs.mkdir(path.dirname(absPath), { recursive: true })
        const doc = await this.client.getDoc(entry.id)
        const text = (doc.lines || []).join('\n')
        await this._writeWorkspaceFile(pathname, text)
        this.docs.set(entry.id, {
          pathname,
          version: doc.version,
          shadow: text,
        })
      } else if (entry.type === 'file') {
        await fs.mkdir(path.dirname(absPath), { recursive: true })
        try {
          const buf = await this.client.getFile(entry.id)
          await this._writeWorkspaceFileRaw(pathname, buf)
        } catch (err) {
          this.log('bootstrap: skipping binary file (fetch failed)', {
            pathname,
            err: err.message,
          })
        }
      }
    }
  }

  // -------------------- applied-ops (text content) --------------------

  _openAppliedOpsStream() {
    this.appliedOpsStream = this.client.openAppliedOpsStream()
    this.appliedOpsStream.on('open', () => this.log('applied-ops stream open'))
    this.appliedOpsStream.on('error', err =>
      this.log('applied-ops stream error', { err: err.message })
    )
    this.appliedOpsStream.on('message', msg =>
      this._onAppliedOp(msg).catch(err =>
        this.log('applied-op handler failed', { err: err.message })
      )
    )
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
    if (!state) return // doc we don't know yet — will be picked up by editor-events
    const source = applied.meta?.source
    if (source === this.sourceTag) {
      if (typeof applied.v === 'number') state.version = applied.v + 1
      return
    }
    let newShadow
    try {
      newShadow = applyOps(state.shadow, applied.op || [])
    } catch (err) {
      this.log('shadow apply failed — resyncing doc', { docId, err: err.message })
      await this._resyncDoc(docId)
      return
    }
    state.shadow = newShadow
    if (typeof applied.v === 'number') state.version = applied.v + 1
    await this._writeWorkspaceFile(state.pathname, newShadow)
  }

  async _resyncDoc(docId) {
    const doc = await this.client.getDoc(docId)
    const text = (doc.lines || []).join('\n')
    const state = this.docs.get(docId) || {}
    state.pathname = doc.pathname || state.pathname
    state.version = doc.version
    state.shadow = text
    this.docs.set(docId, state)
    if (state.pathname) {
      if (!this.structure.lookupPath(state.pathname)) {
        this.structure.add(state.pathname, 'doc', docId)
      }
      await this._writeWorkspaceFile(state.pathname, text)
    }
  }

  // -------------------- editor-events (structural) --------------------

  _openEditorEventsStream() {
    this.editorEventsStream = this.client.openEditorEventsStream()
    this.editorEventsStream.on('open', () =>
      this.log('editor-events stream open')
    )
    this.editorEventsStream.on('error', err =>
      this.log('editor-events stream error', { err: err.message })
    )
    this.editorEventsStream.on('message', msg =>
      this._onEditorEvent(msg).catch(err =>
        this.log('editor-event handler failed', { err: err.message })
      )
    )
  }

  async _onEditorEvent(msg) {
    if (!msg || msg.type === 'ready') return
    const { message, payload } = msg
    if (!message || !Array.isArray(payload)) return

    switch (message) {
      case 'reciveNewDoc': {
        const [folderId, doc, source] = payload
        if (source === STRUCT_SOURCE) return // our own create
        if (this.structure.lookupId(doc._id)) return
        await this._inboundNewDoc(folderId, doc)
        break
      }
      case 'reciveNewFile': {
        const [folderId, fileRef, source] = payload
        if (source === STRUCT_SOURCE) return
        if (this.structure.lookupId(fileRef._id)) return
        await this._inboundNewFile(folderId, fileRef)
        break
      }
      case 'reciveNewFolder': {
        const [parentFolderId, folder] = payload
        if (this.structure.lookupId(folder._id)) return
        await this._inboundNewFolder(parentFolderId, folder)
        break
      }
      case 'reciveEntityRename': {
        const [entityId, newName] = payload
        await this._inboundRename(entityId, newName)
        break
      }
      case 'reciveEntityMove': {
        const [entityId, newParentFolderId] = payload
        await this._inboundMove(entityId, newParentFolderId)
        break
      }
      case 'removeEntity': {
        const [entityId, source] = payload
        if (source === STRUCT_SOURCE) return // our own delete
        await this._inboundRemove(entityId)
        break
      }
      default:
        // Many editor-events aren't relevant (e.g. clientTracking).
        break
    }
  }

  async _inboundNewDoc(folderId, doc) {
    const parentPath = this.structure.lookupId(folderId)
    if (!parentPath) return
    const pathname = joinPath(parentPath.pathname, doc.name)
    this.structure.add(pathname, 'doc', doc._id)
    const text = Array.isArray(doc.lines) ? doc.lines.join('\n') : ''
    this.docs.set(String(doc._id), { pathname, version: 0, shadow: text })
    await this._writeWorkspaceFile(pathname, text)
    // We bootstrapped 'shadow' from the payload but `version` is only
    // accurate once doc-updater loads the doc. Resync to be sure.
    this._resyncDoc(String(doc._id)).catch(err =>
      this.log('post-create resync failed', { err: err.message })
    )
  }

  async _inboundNewFile(folderId, fileRef) {
    const parentPath = this.structure.lookupId(folderId)
    if (!parentPath) return
    const pathname = joinPath(parentPath.pathname, fileRef.name)
    this.structure.add(pathname, 'file', fileRef._id)
    try {
      const buf = await this.client.getFile(fileRef._id)
      await this._writeWorkspaceFileRaw(pathname, buf)
    } catch (err) {
      this.log('inbound file fetch failed', { pathname, err: err.message })
    }
  }

  async _inboundNewFolder(parentFolderId, folder) {
    const parentPath = this.structure.lookupId(parentFolderId)
    if (!parentPath) return
    const pathname = joinPath(parentPath.pathname, folder.name)
    this.structure.add(pathname, 'folder', folder._id)
    const abs = path.join(this.workspace, pathname)
    this._bumpIgnore(pathname)
    await fs.mkdir(abs, { recursive: true })
  }

  async _inboundRename(entityId, newName) {
    const found = this.structure.lookupId(entityId)
    if (!found) return
    const oldPath = found.pathname
    const parentPath = path.posix.dirname(oldPath)
    const newPath = joinPath(parentPath === '.' ? '' : parentPath, newName)
    await this._inboundRelocate(entityId, oldPath, newPath)
  }

  async _inboundMove(entityId, newParentFolderId) {
    const found = this.structure.lookupId(entityId)
    if (!found) return
    const oldPath = found.pathname
    const parentPath = this.structure.lookupId(newParentFolderId)
    if (!parentPath) return
    const name = path.posix.basename(oldPath)
    const newPath = joinPath(parentPath.pathname, name)
    await this._inboundRelocate(entityId, oldPath, newPath)
  }

  async _inboundRelocate(entityId, oldPath, newPath) {
    if (oldPath === newPath) return
    const oldAbs = path.join(this.workspace, oldPath)
    const newAbs = path.join(this.workspace, newPath)
    this._bumpIgnore(oldPath)
    this._bumpIgnore(newPath)
    await fs.mkdir(path.dirname(newAbs), { recursive: true })
    try {
      await fs.rename(oldAbs, newAbs)
    } catch (err) {
      this.log('inbound rename failed', {
        oldPath,
        newPath,
        err: err.message,
      })
    }
    // Update index: removeByPath cleans up children too if it was a folder.
    const entry = this.structure.removeByPath(oldPath)
    if (entry) {
      this.structure.add(newPath, entry.type, entry.id)
      // For docs, also update shadow state pathname.
      const docState = this.docs.get(String(entityId))
      if (docState) docState.pathname = newPath
    }
  }

  async _inboundRemove(entityId) {
    const found = this.structure.lookupId(entityId)
    if (!found) return
    const pathname = found.pathname
    const abs = path.join(this.workspace, pathname)
    this._bumpIgnore(pathname)
    try {
      await fs.rm(abs, { recursive: true, force: true })
    } catch (err) {
      this.log('inbound remove fs failed', { pathname, err: err.message })
    }
    this.structure.removeByPath(pathname)
    this.docs.delete(String(entityId))
  }

  // -------------------- filesystem watcher (outbound) --------------------

  _startWatcher() {
    this.watcher = chokidar.watch(this.workspace, {
      ignoreInitial: true,
      ignored: [/(^|[\\/])\.git([\\/]|$)/, /node_modules[\\/]/, /(^|[\\/])\.claude([\\/]|$)/],
      awaitWriteFinish: { stabilityThreshold: 80, pollInterval: 30 },
    })
    this.watcher.on('change', p => this._onFsChange(p))
    this.watcher.on('add', p => this._onFsAdd(p))
    this.watcher.on('addDir', p => this._onFsAddDir(p))
    this.watcher.on('unlink', p => this._onFsUnlink(p))
    this.watcher.on('unlinkDir', p => this._onFsUnlink(p))
    this.watcher.on('error', err =>
      this.log('chokidar error', { err: err.message })
    )
  }

  _onFsChange(absPath) {
    const rel = this._relPath(absPath)
    if (this._consumeIgnore(rel)) return
    const entry = this.structure.lookupPath(rel)
    if (!entry) return
    if (entry.type === 'doc') {
      this._scheduleFlush(entry.id)
    } else if (entry.type === 'file') {
      // Binary content changed — re-upload (upsertFile replaces in place).
      this._scheduleStruct(rel, () => this._uploadFile(rel))
    }
  }

  _onFsAdd(absPath) {
    const rel = this._relPath(absPath)
    if (this._consumeIgnore(rel)) return
    const entry = this.structure.lookupPath(rel)
    if (entry) {
      // Already known — treat as change.
      if (entry.type === 'doc') this._scheduleFlush(entry.id)
      else if (entry.type === 'file') {
        this._scheduleStruct(rel, () => this._uploadFile(rel))
      }
      return
    }
    if (isTextPath(rel)) {
      this._scheduleStruct(rel, () => this._createDoc(rel))
    } else {
      this._scheduleStruct(rel, () => this._uploadFile(rel))
    }
  }

  _onFsAddDir(absPath) {
    const rel = this._relPath(absPath)
    if (!rel) return // workspace root itself
    if (this._consumeIgnore(rel)) return
    if (this.structure.lookupPath(rel)) return
    this._scheduleStruct(rel, () => this._createFolder(rel))
  }

  _onFsUnlink(absPath) {
    const rel = this._relPath(absPath)
    if (this._consumeIgnore(rel)) return
    const entry = this.structure.lookupPath(rel)
    if (!entry) return
    this._scheduleStruct(rel, () => this._deleteEntity(rel, entry))
  }

  // -------------------- outbound primitives --------------------

  async _createDoc(pathname) {
    await this._ensureParentFolders(pathname)
    const parentFolderId = this.structure.parentFolderIdOf(pathname)
    if (!parentFolderId) {
      this.log('createDoc: no parent folder', { pathname })
      return
    }
    let text = ''
    try {
      text = await fs.readFile(path.join(this.workspace, pathname), 'utf8')
    } catch (_) {
      /* may have been removed since the event fired */
      return
    }
    const lines = text.split('\n')
    const name = path.posix.basename(pathname)
    try {
      const doc = await this.client.addDoc({
        userId: this.userId,
        name,
        parentFolderId,
        lines,
      })
      const docId = String(doc._id)
      this.structure.add(pathname, 'doc', docId)
      this.docs.set(docId, { pathname, version: 0, shadow: text })
      // Resync to learn the actual current version.
      this._resyncDoc(docId).catch(() => {})
    } catch (err) {
      this.log('addDoc failed', { pathname, err: err.message })
    }
  }

  async _uploadFile(pathname) {
    await this._ensureParentFolders(pathname)
    const parentFolderId = this.structure.parentFolderIdOf(pathname)
    if (!parentFolderId) {
      this.log('uploadFile: no parent folder', { pathname })
      return
    }
    let buffer
    try {
      buffer = await fs.readFile(path.join(this.workspace, pathname))
    } catch (err) {
      if (err.code === 'ENOENT') return
      throw err
    }
    try {
      const fileRef = await this.client.addFile({
        userId: this.userId,
        name: path.posix.basename(pathname),
        parentFolderId,
        buffer,
      })
      // upsertFile replaces in place: the old entry (if any) keeps the
      // pathname but its id changes. Re-index with the new id.
      const prev = this.structure.lookupPath(pathname)
      if (prev) this.structure.removeByPath(pathname)
      this.structure.add(pathname, 'file', fileRef._id)
    } catch (err) {
      this.log('addFile failed', { pathname, err: err.message })
    }
  }

  async _createFolder(pathname) {
    await this._ensureParentFolders(pathname)
    const parentFolderId = this.structure.parentFolderIdOf(pathname)
    if (!parentFolderId) {
      this.log('createFolder: no parent folder', { pathname })
      return
    }
    const name = path.posix.basename(pathname)
    try {
      const folder = await this.client.addFolder({
        userId: this.userId,
        name,
        parentFolderId,
      })
      this.structure.add(pathname, 'folder', folder._id)
    } catch (err) {
      this.log('addFolder failed', { pathname, err: err.message })
    }
  }

  async _ensureParentFolders(pathname) {
    const parentPath = path.posix.dirname(pathname)
    if (parentPath === '.' || parentPath === '') return
    if (this.structure.lookupPath(parentPath)) return
    // Recursively create the parent first.
    await this._ensureParentFolders(parentPath)
    const parentParentId = this.structure.parentFolderIdOf(parentPath)
    if (!parentParentId) return
    try {
      const folder = await this.client.addFolder({
        userId: this.userId,
        name: path.posix.basename(parentPath),
        parentFolderId: parentParentId,
      })
      this.structure.add(parentPath, 'folder', folder._id)
    } catch (err) {
      this.log('ensureParentFolders: addFolder failed', {
        parentPath,
        err: err.message,
      })
    }
  }

  async _deleteEntity(pathname, entry) {
    try {
      await this.client.deleteEntity({
        userId: this.userId,
        entityType: entry.type,
        entityId: entry.id,
      })
      this.structure.removeByPath(pathname)
      this.docs.delete(entry.id)
    } catch (err) {
      this.log('deleteEntity failed', { pathname, err: err.message })
    }
  }

  // -------------------- text-doc flush (debounced) --------------------

  _scheduleFlush(docId) {
    if (this.flushTimers.has(docId)) clearTimeout(this.flushTimers.get(docId))
    this.flushTimers.set(
      docId,
      setTimeout(() => {
        this.flushTimers.delete(docId)
        this._flushDoc(docId).catch(err =>
          this.log('flushDoc failed', { docId, err: err.message })
        )
      }, DEBOUNCE_MS)
    )
  }

  _scheduleStruct(pathname, action) {
    if (this.structTimers.has(pathname)) {
      clearTimeout(this.structTimers.get(pathname))
    }
    this.structTimers.set(
      pathname,
      setTimeout(() => {
        this.structTimers.delete(pathname)
        action().catch(err =>
          this.log('struct action failed', { pathname, err: err.message })
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
      if (err.code === 'ENOENT') return
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

  // -------------------- workspace I/O helpers --------------------

  async _writeWorkspaceFile(pathname, text) {
    const abs = path.join(this.workspace, pathname)
    this._bumpIgnore(pathname)
    await fs.mkdir(path.dirname(abs), { recursive: true })
    await fs.writeFile(abs, text, 'utf8')
  }

  async _writeWorkspaceFileRaw(pathname, buffer) {
    const abs = path.join(this.workspace, pathname)
    this._bumpIgnore(pathname)
    await fs.mkdir(path.dirname(abs), { recursive: true })
    await fs.writeFile(abs, buffer)
  }

  _bumpIgnore(pathname) {
    this.ignoreFsWrites.set(
      pathname,
      (this.ignoreFsWrites.get(pathname) || 0) + 1
    )
  }

  _consumeIgnore(pathname) {
    const n = this.ignoreFsWrites.get(pathname) || 0
    if (n <= 0) return false
    if (n === 1) this.ignoreFsWrites.delete(pathname)
    else this.ignoreFsWrites.set(pathname, n - 1)
    return true
  }

  _relPath(absPath) {
    return path.relative(this.workspace, absPath).replace(/\\/g, '/')
  }
}

function joinPath(prefix, name) {
  return prefix ? `${prefix}/${name}` : name
}

// Kept for backward-compat with the existing test.
function walkRootFolder(rootFolder, prefix = '') {
  const out = []
  for (const folder of rootFolder) {
    for (const doc of folder.docs || []) {
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
