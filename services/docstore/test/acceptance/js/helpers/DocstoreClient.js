import {
  fetchNothing,
  fetchJson,
  fetchJsonWithResponse,
} from '@overleaf/fetch-utils'
import settings from '@overleaf/settings'
import Persistor from '../../../../app/js/PersistorManager.js'

let DocstoreClient

async function streamToString(stream) {
  const chunks = []
  return await new Promise((resolve, reject) => {
    stream.on('data', chunk => chunks.push(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
  })
}

async function getStringFromPersistor(persistor, bucket, key) {
  const stream = await persistor.getObjectStream(bucket, key, {})
  stream.resume()
  return await streamToString(stream)
}

export default DocstoreClient = {
  async createDoc(projectId, docId, lines, version, ranges) {
    return await DocstoreClient.updateDoc(
      projectId,
      docId,
      lines,
      version,
      ranges
    )
  },

  async getDoc(projectId, docId, qs = {}) {
    const url = new URL(
      `http://127.0.0.1:${settings.internal.docstore.port}/project/${projectId}/doc/${docId}`
    )
    for (const [key, value] of Object.entries(qs)) {
      url.searchParams.append(key, value)
    }
    return await fetchJson(url)
  },

  async peekDoc(projectId, docId, qs = {}) {
    const url = new URL(
      `http://127.0.0.1:${settings.internal.docstore.port}/project/${projectId}/doc/${docId}/peek`
    )
    for (const [key, value] of Object.entries(qs)) {
      url.searchParams.append(key, value)
    }
    const { response, json } = await fetchJsonWithResponse(url)
    return { res: response, doc: json }
  },

  async isDocDeleted(projectId, docId) {
    const { response, json } = await fetchJsonWithResponse(
      `http://127.0.0.1:${settings.internal.docstore.port}/project/${projectId}/doc/${docId}/deleted`
    )
    return { res: response, body: json }
  },

  async getAllDocs(projectId) {
    return await fetchJson(
      `http://127.0.0.1:${settings.internal.docstore.port}/project/${projectId}/doc`
    )
  },

  async getAllDeletedDocs(projectId, callback) {
    return await fetchJson(
      `http://127.0.0.1:${settings.internal.docstore.port}/project/${projectId}/doc-deleted`
    )
  },

  async getAllRanges(projectId) {
    return await fetchJson(
      `http://127.0.0.1:${settings.internal.docstore.port}/project/${projectId}/ranges`
    )
  },

  async getCommentThreadIds(projectId, callback) {
    return await fetchJson(
      `http://127.0.0.1:${settings.internal.docstore.port}/project/${projectId}/comment-thread-ids`
    )
  },

  async getTrackedChangesUserIds(projectId) {
    return await fetchJson(
      `http://127.0.0.1:${settings.internal.docstore.port}/project/${projectId}/tracked-changes-user-ids`
    )
  },

  async updateDoc(projectId, docId, lines, version, ranges) {
    const res = await fetchJson(
      `http://127.0.0.1:${settings.internal.docstore.port}/project/${projectId}/doc/${docId}`,
      {
        method: 'POST',
        json: {
          lines,
          version,
          ranges,
        },
      }
    )
    return res
  },

  async deleteDoc(projectId, docId) {
    return await DocstoreClient.deleteDocWithDateAndName(
      projectId,
      docId,
      new Date(),
      'main.tex'
    )
  },

  async deleteDocWithDate(projectId, docId, date) {
    return await DocstoreClient.deleteDocWithDateAndName(
      projectId,
      docId,
      date,
      'main.tex'
    )
  },

  async deleteDocWithName(projectId, docId, name) {
    return await DocstoreClient.deleteDocWithDateAndName(
      projectId,
      docId,
      new Date(),
      name
    )
  },

  async deleteDocWithDateAndName(projectId, docId, deletedAt, name) {
    return await fetchNothing(
      `http://127.0.0.1:${settings.internal.docstore.port}/project/${projectId}/doc/${docId}`,
      { method: 'PATCH', json: { name, deleted: true, deletedAt } }
    )
  },

  async archiveAllDoc(projectId) {
    return await fetchNothing(
      `http://127.0.0.1:${settings.internal.docstore.port}/project/${projectId}/archive`,
      { method: 'POST' }
    )
  },

  async archiveDoc(projectId, docId) {
    return await fetchNothing(
      `http://127.0.0.1:${settings.internal.docstore.port}/project/${projectId}/doc/${docId}/archive`,
      { method: 'POST' }
    )
  },

  async destroyAllDoc(projectId) {
    await fetchNothing(
      `http://127.0.0.1:${settings.internal.docstore.port}/project/${projectId}/destroy`,
      { method: 'POST' }
    )
  },

  async healthCheck() {
    return await fetchNothing(
      `http://127.0.0.1:${settings.internal.docstore.port}/health_check`
    )
  },

  async getS3Doc(projectId, docId) {
    const data = await getStringFromPersistor(
      Persistor,
      settings.docstore.bucket,
      `${projectId}/${docId}`
    )
    return JSON.parse(data)
  },
}
