const { expect } = require('chai')

const MockWebApi = require('./helpers/MockWebApi')
const DocUpdaterClient = require('./helpers/DocUpdaterClient')
const DocUpdaterApp = require('./helpers/DocUpdaterApp')
const { RequestFailedError } = require('@overleaf/fetch-utils')

describe('Getting documents for project', function () {
  before(async function () {
    this.lines = ['one', 'two', 'three']
    this.version = 42
    await DocUpdaterApp.ensureRunning()
  })

  describe('when project state hash does not match', function () {
    it('should return a 409 Conflict response', async function () {
      const projectStateHash = DocUpdaterClient.randomId()
      const projectId = DocUpdaterClient.randomId()
      const docId = DocUpdaterClient.randomId()
      MockWebApi.insertDoc(projectId, docId, {
        lines: this.lines,
        version: this.version,
      })
      await DocUpdaterClient.preloadDoc(projectId, docId)
      await expect(DocUpdaterClient.getProjectDocs(projectId, projectStateHash))
        .to.be.rejectedWith(RequestFailedError)
        .and.eventually.have.nested.property('response.status', 409)
    })
  })

  describe('when project state hash matches', function () {
    it('should return the documents', async function () {
      const projectStateHash = DocUpdaterClient.randomId()
      const projectId = DocUpdaterClient.randomId()
      const docId = DocUpdaterClient.randomId()
      MockWebApi.insertDoc(projectId, docId, {
        lines: this.lines,
        version: this.version,
      })
      await DocUpdaterClient.preloadDoc(projectId, docId)
      // set the hash
      await expect(DocUpdaterClient.getProjectDocs(projectId, projectStateHash))
        .to.be.rejectedWith(RequestFailedError)
        .and.eventually.have.nested.property('response.status', 409)

      const returnedDocs1 = await DocUpdaterClient.getProjectDocs(
        projectId,
        projectStateHash
      )
      // the hash should now match
      returnedDocs1.should.deep.equal([
        { _id: docId, lines: this.lines, v: this.version },
      ])
    })
  })

  describe('when the doc has been removed', function () {
    it('should return a 409 Conflict response', async function () {
      const projectStateHash = DocUpdaterClient.randomId()
      const projectId = DocUpdaterClient.randomId()
      const docId = DocUpdaterClient.randomId()
      MockWebApi.insertDoc(projectId, docId, {
        lines: this.lines,
        version: this.version,
      })
      await DocUpdaterClient.preloadDoc(projectId, docId)
      await expect(DocUpdaterClient.getProjectDocs(projectId, projectStateHash))
        .to.be.rejectedWith(RequestFailedError)
        .and.eventually.have.nested.property('response.status', 409)
      await DocUpdaterClient.deleteDoc(projectId, docId)
      // the hash would match, but the doc has been deleted
      await expect(DocUpdaterClient.getProjectDocs(projectId, projectStateHash))
        .to.be.rejectedWith(RequestFailedError)
        .and.eventually.have.nested.property('response.status', 409)
    })
  })
})
