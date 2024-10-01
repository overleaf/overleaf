const OError = require('@overleaf/o-error')

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
  if (req.params) {
    const projectId =
      req.params.projectId || req.params.project_id || req.params.Project_id
    const userId = req.params.userId || req.params.user_id
    const docId = req.params.docId || req.params.doc_id
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

module.exports = { err: errSerializer, req: reqSerializer, res: resSerializer }
