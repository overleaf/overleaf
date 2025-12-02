import mongodb from './mongodb.js'
import _ from 'lodash'
import crypto from 'node:crypto'
import settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import { fetchNothing, fetchJson } from '@overleaf/fetch-utils'

const { db, ObjectId } = mongodb

const { port } = settings.internal.docstore

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

export default {
  check,
}
