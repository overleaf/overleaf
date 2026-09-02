import { expect } from 'chai'
import UserHelper from './helpers/User.mjs'
import request from './helpers/request.js'
import { expectValidationErrorRaw } from '@overleaf/validation-tools/testUtils.js'

const User = UserHelper.promises
const authedRequest = request.promises

const auth = Buffer.from('overleaf:password').toString('base64')
function privateApiRequest(options) {
  return authedRequest.request({
    ...options,
    json: options.json === undefined ? true : options.json,
    headers: {
      ...options.headers,
      Authorization: `Basic ${auth}`,
    },
  })
}

describe('DocumentController', function () {
  let owner, projectId, docId

  beforeEach(async function () {
    owner = new User()
    await owner.login()
    projectId = await owner.createProject('document-controller-test', {
      template: 'blank',
    })
    const project = await owner.getProject(projectId)
    docId = project.rootFolder[0].docs[0]._id.toString()
  })

  describe('GET /project/:Project_id/doc/:doc_id', function () {
    it('should return the document as json', async function () {
      const response = await privateApiRequest({
        method: 'get',
        url: `/project/${projectId}/doc/${docId}`,
      })
      expect(response.statusCode).to.equal(200)
      expect(response.body.lines).to.be.an('array')
      expect(response.body.version).to.be.a('number')
      expect(response.body.pathname).to.equal('/main.tex')
    })

    it('should return the document as plain text when plain=true', async function () {
      const response = await privateApiRequest({
        method: 'get',
        url: `/project/${projectId}/doc/${docId}?plain=true`,
        json: false,
      })
      expect(response.statusCode).to.equal(200)
      expect(response.body).to.be.a('string')
    })

    it('should reject a malformed project id with 404', async function () {
      const response = await privateApiRequest({
        method: 'get',
        url: `/project/not-an-object-id/doc/${docId}`,
      })
      expectValidationErrorRaw(response, 404, 'Project_id')
    })

    it('should reject a malformed doc id with 404', async function () {
      const response = await privateApiRequest({
        method: 'get',
        url: `/project/${projectId}/doc/not-an-object-id`,
      })
      expectValidationErrorRaw(response, 404, 'doc_id')
    })
  })

  describe('POST /project/:Project_id/doc/:doc_id', function () {
    it('should update the document lines and version', async function () {
      const response = await privateApiRequest({
        method: 'post',
        url: `/project/${projectId}/doc/${docId}`,
        json: {
          lines: ['new content', 'second line'],
          version: 2,
          ranges: {},
          lastUpdatedAt: String(Date.now()),
          lastUpdatedBy: owner._id.toString(),
        },
      })
      expect(response.statusCode).to.equal(200)

      const getResponse = await privateApiRequest({
        method: 'get',
        url: `/project/${projectId}/doc/${docId}`,
      })
      expect(getResponse.body.lines).to.deep.equal([
        'new content',
        'second line',
      ])
      expect(getResponse.body.version).to.equal(2)
    })

    it('should accept a null lastUpdatedBy for system-initiated updates', async function () {
      const response = await privateApiRequest({
        method: 'post',
        url: `/project/${projectId}/doc/${docId}`,
        json: {
          lines: ['content'],
          version: 2,
          ranges: {},
          lastUpdatedAt: String(Date.now()),
          lastUpdatedBy: null,
        },
      })
      expect(response.statusCode).to.equal(200)
    })

    it('should reject a non-array lines field', async function () {
      const response = await privateApiRequest({
        method: 'post',
        url: `/project/${projectId}/doc/${docId}`,
        json: {
          lines: 'not-an-array',
          version: 2,
          ranges: {},
        },
      })
      expectValidationErrorRaw(response, 400, 'lines')
    })

    it('should reject a malformed lastUpdatedAt', async function () {
      const response = await privateApiRequest({
        method: 'post',
        url: `/project/${projectId}/doc/${docId}`,
        json: {
          lines: ['content'],
          version: 2,
          ranges: {},
          lastUpdatedAt: 'not-a-number',
          lastUpdatedBy: owner._id.toString(),
        },
      })
      expectValidationErrorRaw(response, 400, 'lastUpdatedAt')
    })
  })

  describe('POST /project/:Project_id/doc/:doc_id/changes/reject', function () {
    it('should accept the request and return 204', async function () {
      const response = await privateApiRequest({
        method: 'post',
        url: `/project/${projectId}/doc/${docId}/changes/reject`,
        json: {
          rejectedChangeAuthorIds: [owner._id.toString()],
          userId: owner._id.toString(),
        },
      })
      expect(response.statusCode).to.equal(204)
    })

    it('should accept the previews document-updater sends and return 204', async function () {
      const response = await privateApiRequest({
        method: 'post',
        url: `/project/${projectId}/doc/${docId}/changes/reject`,
        json: {
          rejectedChangeAuthorIds: [owner._id.toString()],
          userId: owner._id.toString(),
          // the shape buildSparseChangePreviews emits, one entry per cluster
          previews: [
            {
              sectionPath: ['Introduction'],
              startLine: 2,
              changes: [{ i: 'inserted', p: 5 }],
              slice: 'first line\nsecond line inserted',
              sliceStart: 0,
              userIds: [owner._id.toString()],
            },
            {
              sectionPath: [],
              startLine: 404,
              changes: [{ d: 'removed', p: 5000 }],
              slice: 'text around the second cluster',
              sliceStart: 4900,
              userIds: [owner._id.toString()],
            },
          ],
        },
      })
      expect(response.statusCode).to.equal(204)
    })

    it('should reject a non-ObjectId rejectedChangeAuthorIds entry', async function () {
      const response = await privateApiRequest({
        method: 'post',
        url: `/project/${projectId}/doc/${docId}/changes/reject`,
        json: {
          rejectedChangeAuthorIds: ['not-an-object-id'],
        },
      })
      expectValidationErrorRaw(response, 400, 'rejectedChangeAuthorIds')
    })
  })
})
