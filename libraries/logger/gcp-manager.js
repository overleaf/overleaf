const bunyan = require('bunyan')

/**
 * When we copy log entry fields, omit some bunyan core fields that are not
 * interesting, that have a special meaning in GCP, or that we will process
 * separately.
 */
const ENTRY_FIELDS_TO_OMIT = [
  'level',
  'name',
  'hostname',
  'v',
  'pid',
  'msg',
  'err',
  'error',
  'req',
  'res',
]

/**
 * Convert a bunyan log entry to a format that GCP understands
 */
function convertLogEntry(entry) {
  const gcpEntry = omit(entry, ENTRY_FIELDS_TO_OMIT)

  // Error information. In GCP, the stack trace goes in the message property.
  // This enables the error reporting feature.
  const err = entry.err || entry.error
  if (err) {
    if (err.info) {
      Object.assign(gcpEntry, err.info)
    }
    if (err.code) {
      gcpEntry.code = err.code
    }
    if (err.signal) {
      gcpEntry.signal = err.signal
    }
    const stack = err.stack
    if (stack && stack !== '(no stack)') {
      gcpEntry.message = stack
    } else if (err.message) {
      gcpEntry.message = err.message
    }
    if (entry.name) {
      gcpEntry.serviceContext = { service: entry.name }
    }
  }

  // Log message
  if (entry.msg) {
    if (gcpEntry.message) {
      // A message has already been extracted from the error. Keep the extra
      // message in the msg property.
      gcpEntry.msg = entry.msg
    } else {
      gcpEntry.message = entry.msg
    }
  }

  // Severity
  if (entry.level) {
    gcpEntry.severity = bunyan.nameFromLevel[entry.level]
  }

  // HTTP request information
  if (entry.req || entry.res || entry.responseTimeMs) {
    const httpRequest = {}
    if (entry.req) {
      const req = entry.req
      httpRequest.requestMethod = req.method
      httpRequest.requestUrl = req.url
      httpRequest.remoteIp = req.remoteAddress
      if (req.headers) {
        if (req.headers['content-length']) {
          httpRequest.requestSize = parseInt(req.headers['content-length'], 10)
        }
        httpRequest.userAgent = req.headers['user-agent']
        httpRequest.referer = req.headers.referer
      }
    }

    if (entry.res) {
      const res = entry.res
      httpRequest.status = res.statusCode
      if (res.headers && res.headers['content-length']) {
        if (res.headers['content-length']) {
          httpRequest.responseSize = parseInt(res.headers['content-length'], 10)
        }
      }
    }

    if (entry.responseTimeMs) {
      const responseTimeSec = entry.responseTimeMs / 1000
      httpRequest.latency = `${responseTimeSec}s`
    }
    gcpEntry.httpRequest = httpRequest
  }

  // Labels are indexed in GCP. We copy the project, doc and user ids to labels to enable fast filtering
  const projectId =
    gcpEntry.projectId ||
    gcpEntry.project_id ||
    (entry.req && entry.req.projectId)
  const userId =
    gcpEntry.userId || gcpEntry.user_id || (entry.req && entry.req.userId)
  const docId =
    gcpEntry.docId || gcpEntry.doc_id || (entry.req && entry.req.docId)
  if (projectId || userId || docId) {
    const labels = {}
    if (projectId) {
      labels.projectId = projectId
    }
    if (userId) {
      labels.userId = userId
    }
    if (docId) {
      labels.docId = docId
    }
    gcpEntry['logging.googleapis.com/labels'] = labels
  }

  return gcpEntry
}

function omit(obj, excludedFields) {
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => !excludedFields.includes(key))
  )
}

module.exports = { convertLogEntry }
