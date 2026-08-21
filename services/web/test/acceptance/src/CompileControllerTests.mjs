import { expect } from 'chai'
import UserHelper from './helpers/User.mjs'
import request from './helpers/request.js'
import settings from '@overleaf/settings'
import MockClsiApi from './mocks/MockClsiApi.mjs'
import MockV1HistoryApi from './mocks/MockV1HistoryApi.mjs'
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

describe('CompileController', function () {
  let owner, projectId

  beforeEach(async function () {
    owner = new User()
    await owner.login()
    projectId = await owner.createProject('compile-controller-test', {
      template: 'blank',
    })
  })

  describe('POST /project/:Project_id/compile', function () {
    it('should reject a malformed project id with 404', async function () {
      const { response, body } = await owner.doRequest('post', {
        url: '/project/not-an-object-id/compile',
        json: {},
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        404,
        'Project_id'
      )
    })

    it('should reject a non-boolean draft flag with 400', async function () {
      const { response, body } = await owner.doRequest('post', {
        url: `/project/${projectId}/compile`,
        json: { draft: 'not-a-boolean' },
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        400,
        'draft'
      )
    })
  })

  describe('POST /project/:Project_id/compile/stop', function () {
    it('should reject a malformed project id with 404', async function () {
      const { response, body } = await owner.doRequest('post', {
        url: '/project/not-an-object-id/compile/stop',
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        404,
        'Project_id'
      )
    })
  })

  describe('DELETE /project/:Project_id/output', function () {
    it('should reject a malformed project id with 404', async function () {
      const { response, body } = await owner.doRequest('delete', {
        url: '/project/not-an-object-id/output',
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        404,
        'Project_id'
      )
    })
  })

  describe('GET /project/:Project_id/wordcount', function () {
    it('should reject a malformed project id with 404', async function () {
      const { response, body } = await owner.doRequest('get', {
        url: '/project/not-an-object-id/wordcount',
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        404,
        'Project_id'
      )
    })

    async function requestWordCount() {
      const { response, body } = await owner.doRequest('get', {
        url: `/project/${projectId}/wordcount?rootResourcePath=main.tex`,
        json: true,
      })
      expect(response.statusCode).to.equal(200)
      expect(body.texcount.textWords).to.equal(12)
      return MockClsiApi.instance().lastWordcountRequestBody || {}
    }

    it('should send the project history snapshot to the clsi', async function () {
      const clsiRequestBody = await requestWordCount()
      expect(clsiRequestBody.compile.rootResourcePath).to.equal('main.tex')
      expect(clsiRequestBody.compile.options.syncType).to.equal('history-full')
      expect(clsiRequestBody.compile.rawSnapshot).to.exist
    })

    it('should fall back to the resource list when history is unavailable', async function () {
      MockV1HistoryApi.instance().latestHistoryUnavailable = true
      const clsiRequestBody = await requestWordCount()
      expect(clsiRequestBody.compile.rootResourcePath).to.equal('main.tex')
      expect(clsiRequestBody.compile.rawSnapshot).not.to.exist
      expect(clsiRequestBody.compile.resources.map(r => r.path)).to.include(
        'main.tex'
      )
    })
  })

  describe('GET /download/project/:Project_id/build/:build_id/output/output.pdf', function () {
    it('should reject a malformed build id with 404', async function () {
      const { response, body } = await owner.doRequest('get', {
        url: `/download/project/${projectId}/build/not-a-build-id/output/output.pdf`,
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        404,
        'build_id'
      )
    })

    it('should accept an enable_pdf_caching query param and proxy to CLSI', async function () {
      const { response, body } = await owner.doRequest('get', {
        url: `/download/project/${projectId}/build/18fbe9e7564-30dcb2f71250c690/output/output.pdf?enable_pdf_caching=true`,
      })
      expect(response.statusCode).to.equal(200)
      expect(body).to.equal('hello')
    })
  })

  describe('GET /project/:Project_id/build/:build_id/output/output.zip', function () {
    it('should reject a malformed build id with 404', async function () {
      const { response, body } = await owner.doRequest('get', {
        url: `/project/${projectId}/build/not-a-build-id/output/output.zip`,
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        404,
        'build_id'
      )
    })

    it('should accept an enable_pdf_caching query param and proxy to CLSI', async function () {
      const { response, body } = await owner.doRequest('get', {
        url: `/project/${projectId}/build/18fbe9e7564-30dcb2f71250c690/output/output.zip?enable_pdf_caching=true`,
      })
      expect(response.statusCode).to.equal(200)
      expect(body).to.equal('mock-zip: 18fbe9e7564-30dcb2f71250c690')
    })
  })

  describe('GET /project/:Project_id/build/:build_id/output/:file', function () {
    it('should reject a path traversal filename with 404', async function () {
      const { response, body } = await owner.doRequest('get', {
        url: `/project/${projectId}/build/18fbe9e7564-30dcb2f71250c690/output/../../../../etc/passwd`,
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        404,
        'file'
      )
    })

    it('should accept a genuine filename and proxy to CLSI', async function () {
      // This route resolves to a per-user build path (see
      // CompileController._getUserIdForCompile), which MockClsiNginxApi
      // (this test environment's stand-in CLSI) handles with an
      // unconditional 200 ("hello") -- proving the request reached CLSI,
      // rather than being rejected by the schema.
      const { response, body } = await owner.doRequest('get', {
        url: `/project/${projectId}/build/18fbe9e7564-30dcb2f71250c690/output/nested.txt`,
      })
      expect(response.statusCode).to.equal(200)
      expect(body).to.equal('hello')
    })

    it('should accept an enable_pdf_caching query param and proxy to CLSI', async function () {
      const { response, body } = await owner.doRequest('get', {
        url: `/project/${projectId}/build/18fbe9e7564-30dcb2f71250c690/output/nested.txt?enable_pdf_caching=true`,
      })
      expect(response.statusCode).to.equal(200)
      expect(body).to.equal('hello')
    })
  })

  describe('GET /project/:Project_id/sync/code', function () {
    it('should reject a non-numeric line with 400', async function () {
      const { response, body } = await owner.doRequest('get', {
        url: `/project/${projectId}/sync/code?file=main.tex&line=not-a-number&column=1&editorId=abc123&buildId=abc-123`,
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        400,
        'line'
      )
    })

    it('should reject a buildId that does not match the hex-hyphen-hex shape with 400', async function () {
      const { response, body } = await owner.doRequest('get', {
        url: `/project/${projectId}/sync/code?file=main.tex&line=1&column=1&editorId=abc123&buildId=not-a-valid-build-id`,
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        400,
        'buildId'
      )
    })
  })

  describe('GET /project/:Project_id/sync/pdf', function () {
    it('should reject a non-numeric page with 400', async function () {
      const { response, body } = await owner.doRequest('get', {
        url: `/project/${projectId}/sync/pdf?page=not-a-number&h=1.0&v=1.0&editorId=abc123&buildId=abc-123`,
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        400,
        'page'
      )
    })

    it('should reject a buildId that does not match the hex-hyphen-hex shape with 400', async function () {
      const { response, body } = await owner.doRequest('get', {
        url: `/project/${projectId}/sync/pdf?page=1&h=1.0&v=1.0&editorId=abc123&buildId=not-a-valid-build-id`,
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        400,
        'buildId'
      )
    })
  })

  describe('GET /internal/project/:project_id/compile/pdf', function () {
    it('should reject a malformed project id with 404', async function () {
      const response = await privateApiRequest({
        method: 'get',
        url: '/internal/project/not-an-object-id/compile/pdf',
      })
      expectValidationErrorRaw(response, 404, 'project_id')
    })
  })

  describe('POST /api/clsi/compile/:submission_id', function () {
    beforeEach(function () {
      // route is only registered by the publish-modal module (SaaS-only)
      if (!settings.moduleImportSequence.includes('publish-modal')) {
        this.skip()
      }
    })

    it('should reject a malformed submission_id with 404', async function () {
      const response = await privateApiRequest({
        method: 'post',
        url: '/api/clsi/compile/invalid submission id!',
        json: {},
      })
      expectValidationErrorRaw(response, 404, 'submission_id')
    })
  })

  describe('GET /api/clsi/compile/:submissionId/build/:build_id/output/:file', function () {
    beforeEach(function () {
      // route is only registered by the publish-modal module (SaaS-only)
      if (!settings.moduleImportSequence.includes('publish-modal')) {
        this.skip()
      }
    })

    it('should reject a malformed build_id with 404', async function () {
      const response = await privateApiRequest({
        method: 'get',
        url: '/api/clsi/compile/sub-1234/build/not-a-build-id/output/output.pdf',
      })
      expectValidationErrorRaw(response, 404, 'build_id')
    })

    it('should accept a blank compileGroup and proxy to CLSI', async function () {
      // V1's CLSI::Response#v2_api_url always appends compileGroup (taken
      // from the compile response); compileSubmission (above) never
      // populates that field, so it arrives here blank rather than one of
      // zz.compileGroup()'s enum values.
      const response = await privateApiRequest({
        method: 'get',
        url: '/api/clsi/compile/sub-1234/build/18fbe9e7564-30dcb2f71250c690/output/output.pdf?compileGroup=',
      })
      expect(response.statusCode).to.equal(200)
    })
  })
})
