const { db, ObjectId } = require('./mongodb')
const _ = require('lodash')
const crypto = require('node:crypto')
const settings = require('@overleaf/settings')
const { port } = settings.internal.docstore
const logger = require('@overleaf/logger')
const { fetchNothing, fetchJson } = require('@overleaf/fetch-utils')

async function check() {
  const docId = new ObjectId()
  const projectId = new ObjectId(settings.docstore.healthCheck.project_id)
  const url = `http://127.0.0.1:${port}/project/${projectId}/doc/${docId}`
  const lines = [
    'smoke test - delete me',
    `${crypto.randomBytes(32).toString('hex')}`,
  ]
  logger.debug({ lines, url, docId, projectId }, 'running health check')
  let body
  try {
    await fetchNothing(url, {
      method: 'POST',
      json: { lines, version: 42, ranges: {} },
      signal: AbortSignal.timeout(3_000),
    })
    body = await fetchJson(url, { signal: AbortSignal.timeout(3_000) })
  } finally {
    await db.docs.deleteOne({ _id: docId, project_id: projectId })
  }
  if (!_.isEqual(body?.lines, lines)) {
    throw new Error(`health check lines not equal ${body.lines} != ${lines}`)
  }
}
module.exports = {
  check,
}
