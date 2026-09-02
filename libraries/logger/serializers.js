const OError = require('@overleaf/o-error')
const { getRawReqInput } = require('@overleaf/validation-tools')

function errSerializer(err) {
  if (!err) {
    return err
  }
  let message = err.message
  if (err.path) {
    // filter paths from the message to avoid duplicate errors with different path in message
    // (e.g. errors from `fs` methods which have a path attribute)
    message = message.replace(` '${err.path}'`, '')
  }
  return {
    message,
    name: err.name,
    stack: OError.getFullStack(err),
    info: OError.getFullInfo(err),
    code: err.code,
    signal: err.signal,
    path: err.path,
  }
}

function reqSerializer(req) {
  if (!req) {
    return req
  }
  const headers = req.headers || {}
  const entry = {
    method: req.method,
    url: req.originalUrl || req.url,
    remoteAddress: getRemoteIp(req),
    headers: {
      referer: headers.referer || headers.referrer,
      'user-agent': headers['user-agent'],
      'content-length': headers['content-length'],
    },
  }
  // raw access justified: case 2 (final error-handler logging) — this
  // serializer must not throw while extracting log context, and bunyan
  // silently drops the whole `req` field (with a stderr warning) if it did
  const { params } = getRawReqInput(req)
  if (params) {
    const projectId = params.projectId || params.project_id || params.Project_id
    const userId = params.userId || params.user_id
    const docId = params.docId || params.doc_id
    if (projectId) {
      entry.projectId = projectId
    }
    if (userId) {
      entry.userId = userId
    }
    if (docId) {
      entry.docId = docId
    }
  }
  return entry
}

function resSerializer(res) {
  if (!res) {
    return res
  }
  return {
    statusCode: res.statusCode,
    headers: {
      'content-length': res.getHeader && res.getHeader('content-length'),
    },
  }
}

function getRemoteIp(req) {
  if (req.ip) {
    return req.ip
  }
  if (req.socket) {
    if (req.socket.socket && req.socket.socket.remoteAddress) {
      return req.socket.socket.remoteAddress
    } else if (req.socket.remoteAddress) {
      return req.socket.remoteAddress
    }
  }
  return null
}

module.exports = {
  err: errSerializer,
  error: errSerializer,
  req: reqSerializer,
  res: resSerializer,
}
