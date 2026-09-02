/* eslint-disable
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import sinon from 'sinon'
import express from 'express'
import { z, zz, parseReq } from '@overleaf/validation-tools'

let MockDocUpdaterServer

// Mirrors the request shape of document-updater's real routes (see
// services/document-updater/app/js/HttpController.js).
const getDocumentRequestSchema = z.object({
  params: z.strictObject({
    project_id: zz.objectId(),
    doc_id: zz.objectId(),
  }),
  query: z.strictObject({
    fromVersion: z.coerce.number().int().optional(),
    // sent by real-time's DocumentUpdaterManager.getDocument alongside
    // fromVersion; unused here since this mock only reads fromVersion.
    historyOTSupport: z.stringbool().optional(),
  }),
})

const deleteProjectRequestSchema = z.object({
  params: z.strictObject({
    project_id: zz.objectId(),
  }),
})

export default MockDocUpdaterServer = {
  docs: {},

  createMockDoc(projectId, docId, data) {
    return (MockDocUpdaterServer.docs[`${projectId}:${docId}`] = data)
  },

  getDocument(projectId, docId, fromVersion, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return callback(null, MockDocUpdaterServer.docs[`${projectId}:${docId}`])
  },

  deleteProject: sinon.stub().callsArg(1),

  getDocumentRequest(req, res, next) {
    const { params, query } = parseReq(req, getDocumentRequestSchema)
    const { project_id: projectId, doc_id: docId } = params
    const { fromVersion } = query
    return MockDocUpdaterServer.getDocument(
      projectId,
      docId,
      fromVersion,
      (error, data) => {
        if (error != null) {
          return next(error)
        }
        if (!data) {
          return res.sendStatus(404)
        }
        return res.json(data)
      }
    )
  },

  deleteProjectRequest(req, res, next) {
    const { params } = parseReq(req, deleteProjectRequestSchema)
    const { project_id: projectId } = params
    return MockDocUpdaterServer.deleteProject(projectId, error => {
      if (error != null) {
        return next(error)
      }
      return res.sendStatus(204)
    })
  },

  running: false,
  run(callback) {
    if (callback == null) {
      callback = function () {}
    }
    if (MockDocUpdaterServer.running) {
      return callback()
    }
    const app = express()
    app.get(
      '/project/:project_id/doc/:doc_id',
      MockDocUpdaterServer.getDocumentRequest
    )
    app.delete(
      '/project/:project_id',
      MockDocUpdaterServer.deleteProjectRequest
    )
    return app
      .listen(3003, error => {
        MockDocUpdaterServer.running = true
        return callback(error)
      })
      .on('error', error => {
        console.error('error starting MockDocUpdaterServer:', error.message)
        return process.exit(1)
      })
  },
}

sinon.spy(MockDocUpdaterServer, 'getDocument')
