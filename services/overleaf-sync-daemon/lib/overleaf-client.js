// Thin HTTP client for the two document-updater endpoints we depend on.
// All calls are project-scoped; auth happens at the platform edge.

const http = require('node:http')
const https = require('node:https')
const { URL } = require('node:url')

class OverleafClient {
  constructor({ docUpdaterUrl, webUrl, webAuth, projectId }) {
    if (!docUpdaterUrl) throw new Error('docUpdaterUrl required')
    if (!webUrl) throw new Error('webUrl required')
    if (!webAuth || !webAuth.user) throw new Error('webAuth required')
    if (!projectId) throw new Error('projectId required')
    this.docUpdaterUrl = docUpdaterUrl.replace(/\/$/, '')
    this.webUrl = webUrl.replace(/\/$/, '')
    this.webAuth = webAuth
    this.projectId = projectId
  }

  // POST /project/:projectId/join — returns the full project structure
  // (rootFolder tree with all docs + their pathnames). Mirrors what
  // services/real-time does on Socket.IO joinProject.
  async joinProject(userId) {
    const url = `${this.webUrl}/project/${this.projectId}/join`
    const body = JSON.stringify({ userId, anonymousAccessToken: null })
    const res = await request('POST', url, body, this.webAuth)
    if (res.statusCode !== 200) {
      throw new Error(`joinProject failed: ${res.statusCode} ${res.body}`)
    }
    return JSON.parse(res.body)
  }

  // GET /project/:p/doc/:d — returns { lines, version, pathname, ranges, ops }
  // This will lazy-load the doc from web into doc-updater if necessary.
  async getDoc(docId) {
    const url = `${this.docUpdaterUrl}/project/${this.projectId}/doc/${docId}`
    const res = await request('GET', url)
    if (res.statusCode !== 200) {
      throw new Error(`getDoc failed: ${res.statusCode} ${res.body}`)
    }
    return JSON.parse(res.body)
  }

  async injectOp(docId, { op, v, userId, source, hash }) {
    const url = `${this.docUpdaterUrl}/project/${this.projectId}/doc/${docId}/inject-op`
    const body = JSON.stringify({ op, v, userId, source, hash })
    const res = await request('POST', url, body)
    if (res.statusCode !== 202) {
      throw new Error(`injectOp failed: ${res.statusCode} ${res.body}`)
    }
    return JSON.parse(res.body || '{}')
  }

  // Returns an EventSource-like object with .on('event', cb) and .close().
  openAppliedOpsStream() {
    const url = `${this.docUpdaterUrl}/project/${this.projectId}/applied-ops/stream`
    return new SSEStream(url)
  }

  openEditorEventsStream() {
    const url = `${this.webUrl}/internal/ai-sync/project/${this.projectId}/editor-events/stream`
    return new SSEStream(url, this.webAuth)
  }

  async addDoc({ userId, name, parentFolderId, lines }) {
    const url = `${this.webUrl}/internal/ai-sync/project/${this.projectId}/doc`
    const body = JSON.stringify({
      userId,
      name,
      parent_folder_id: parentFolderId,
      lines,
    })
    const res = await request('POST', url, body, this.webAuth)
    if (res.statusCode !== 200) {
      throw new Error(`addDoc failed: ${res.statusCode} ${res.body}`)
    }
    return JSON.parse(res.body)
  }

  async addFolder({ userId, name, parentFolderId }) {
    const url = `${this.webUrl}/internal/ai-sync/project/${this.projectId}/folder`
    const body = JSON.stringify({
      userId,
      name,
      parent_folder_id: parentFolderId,
    })
    const res = await request('POST', url, body, this.webAuth)
    if (res.statusCode !== 200) {
      throw new Error(`addFolder failed: ${res.statusCode} ${res.body}`)
    }
    return JSON.parse(res.body)
  }

  async deleteEntity({ userId, entityType, entityId }) {
    const url = `${this.webUrl}/internal/ai-sync/project/${this.projectId}/entity/${entityType}/${entityId}`
    const body = JSON.stringify({ userId })
    const res = await request('DELETE', url, body, this.webAuth)
    if (res.statusCode !== 204) {
      throw new Error(`deleteEntity failed: ${res.statusCode} ${res.body}`)
    }
  }

  async getProjectStructure() {
    const url = `${this.webUrl}/internal/ai-sync/project/${this.projectId}/structure`
    const res = await request('GET', url, null, this.webAuth)
    if (res.statusCode !== 200) {
      throw new Error(`getProjectStructure failed: ${res.statusCode} ${res.body}`)
    }
    return JSON.parse(res.body)
  }

  // Returns a Promise<Buffer> for a binary file.
  getFile(fileId) {
    const url = `${this.webUrl}/internal/ai-sync/project/${this.projectId}/file/${fileId}`
    return requestRaw('GET', url, null, this.webAuth)
  }

  // Upload a binary file (or replace one with the same name in the same
  // folder). Returns the new fileRef as JSON.
  async addFile({ userId, name, parentFolderId, buffer }) {
    const q = new URLSearchParams({
      userId,
      name,
      parent_folder_id: parentFolderId,
    }).toString()
    const url = `${this.webUrl}/internal/ai-sync/project/${this.projectId}/file?${q}`
    const res = await requestBinary('POST', url, buffer, this.webAuth)
    if (res.statusCode !== 200) {
      throw new Error(`addFile failed: ${res.statusCode} ${res.body}`)
    }
    return JSON.parse(res.body)
  }
}

// POST a Buffer body with content-type application/octet-stream and return
// {statusCode, body: string} like the JSON request() does. Used for file
// uploads — distinct from requestRaw which only handles GET-and-buffer.
function requestBinary(method, urlStr, buffer, basicAuth) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr)
    const lib = url.protocol === 'https:' ? https : http
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'content-type': 'application/octet-stream',
        'content-length': buffer.length,
      },
    }
    if (basicAuth) {
      const token = Buffer.from(
        `${basicAuth.user}:${basicAuth.password || ''}`
      ).toString('base64')
      opts.headers.authorization = `Basic ${token}`
    }
    const req = lib.request(opts, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () =>
        resolve({
          statusCode: res.statusCode,
          body: Buffer.concat(chunks).toString('utf8'),
        })
      )
    })
    req.on('error', reject)
    req.write(buffer)
    req.end()
  })
}

function requestRaw(method, urlStr, body, basicAuth) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr)
    const lib = url.protocol === 'https:' ? https : http
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {},
    }
    if (body) opts.headers['content-length'] = Buffer.byteLength(body)
    if (basicAuth) {
      const token = Buffer.from(
        `${basicAuth.user}:${basicAuth.password || ''}`
      ).toString('base64')
      opts.headers.authorization = `Basic ${token}`
    }
    const req = lib.request(opts, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(
            new Error(
              `requestRaw ${method} ${urlStr} failed: ${res.statusCode}`
            )
          )
        } else {
          resolve(Buffer.concat(chunks))
        }
      })
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

function request(method, urlStr, body, basicAuth) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr)
    const lib = url.protocol === 'https:' ? https : http
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
    }
    if (body) opts.headers['content-length'] = Buffer.byteLength(body)
    if (basicAuth) {
      const token = Buffer.from(
        `${basicAuth.user}:${basicAuth.password || ''}`
      ).toString('base64')
      opts.headers.authorization = `Basic ${token}`
    }
    const req = lib.request(opts, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () =>
        resolve({
          statusCode: res.statusCode,
          body: Buffer.concat(chunks).toString('utf8'),
        })
      )
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

// Minimal SSE client — Node has no built-in EventSource, and we don't want
// the npm `eventsource` dep for one consumer.
class SSEStream {
  constructor(urlStr, basicAuth) {
    this.urlStr = urlStr
    this.basicAuth = basicAuth || null
    this.listeners = new Map()
    this.buffer = ''
    this.closed = false
    this._connect()
  }

  on(event, cb) {
    if (!this.listeners.has(event)) this.listeners.set(event, [])
    this.listeners.get(event).push(cb)
  }

  _emit(event, payload) {
    const cbs = this.listeners.get(event) || []
    for (const cb of cbs) {
      try {
        cb(payload)
      } catch (err) {
        // Errors in user code shouldn't kill the stream.
        // eslint-disable-next-line no-console
        console.error('SSE listener error', err)
      }
    }
  }

  _connect() {
    if (this.closed) return
    const url = new URL(this.urlStr)
    const lib = url.protocol === 'https:' ? https : http
    const headers = { accept: 'text/event-stream' }
    if (this.basicAuth) {
      const token = Buffer.from(
        `${this.basicAuth.user}:${this.basicAuth.password || ''}`
      ).toString('base64')
      headers.authorization = `Basic ${token}`
    }
    const req = lib.request(
      {
        method: 'GET',
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        headers,
      },
      res => {
        if (res.statusCode !== 200) {
          this._emit('error', new Error(`SSE status ${res.statusCode}`))
          res.resume()
          this._reconnect()
          return
        }
        res.setEncoding('utf8')
        res.on('data', chunk => this._onChunk(chunk))
        res.on('end', () => this._reconnect())
        res.on('error', err => {
          this._emit('error', err)
          this._reconnect()
        })
        this._emit('open', null)
      }
    )
    req.on('error', err => {
      this._emit('error', err)
      this._reconnect()
    })
    req.end()
    this._currentReq = req
  }

  _onChunk(chunk) {
    this.buffer += chunk
    let idx
    while ((idx = this.buffer.indexOf('\n\n')) !== -1) {
      const frame = this.buffer.slice(0, idx)
      this.buffer = this.buffer.slice(idx + 2)
      this._onFrame(frame)
    }
  }

  _onFrame(frame) {
    const lines = frame.split('\n')
    let data = ''
    for (const line of lines) {
      if (line.startsWith('data:')) {
        data += line.slice(5).trimStart() + '\n'
      }
    }
    if (data.length === 0) return
    let parsed
    try {
      parsed = JSON.parse(data.trim())
    } catch (err) {
      return
    }
    this._emit('message', parsed)
  }

  _reconnect() {
    if (this.closed) return
    setTimeout(() => this._connect(), 2000)
  }

  close() {
    this.closed = true
    if (this._currentReq) {
      try {
        this._currentReq.destroy()
      } catch (_) {
        /* ignore */
      }
    }
  }
}

module.exports = { OverleafClient }
