import { expect } from 'chai'
import UserHelper from './helpers/User.mjs'
import { expectValidationErrorRaw } from '@overleaf/validation-tools/testUtils.js'
import MockClsiCacheClass from './mocks/MockClsiCache.mjs'

const User = UserHelper.promises

let MockClsiCache

before(function () {
  MockClsiCache = MockClsiCacheClass.instance()
})

describe('ClsiCacheController', function () {
  let owner, projectId

  beforeEach(async function () {
    owner = new User()
    await owner.login()
    projectId = await owner.createProject('clsi-cache-controller-test', {
      template: 'blank',
    })
  })

  describe('GET /project/:Project_id/output/cached/output.overleaf.json', function () {
    it('should reject a malformed project id with 404', async function () {
      const { response, body } = await owner.doRequest('get', {
        url: '/project/not-an-object-id/output/cached/output.overleaf.json',
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        404,
        'Project_id'
      )
    })

    it('should return 404 when nothing is cached', async function () {
      // getLatestBuildFromCache uses res.sendStatus(), unlike
      // downloadFromCache's res.status().end() -- sendStatus fills the
      // body with the status text, so this is genuinely different from
      // (and not to be confused with) an empty-body response.
      const { response, body } = await owner.doRequest('get', {
        url: `/project/${projectId}/output/cached/output.overleaf.json`,
      })
      expect(response.statusCode).to.equal(404)
      expect(body).to.equal('Not Found')
    })

    it('should return 410 when the cached build is stale', async function () {
      // isUpToDate compares this X-Last-Modified against the project's own
      // lastUpdated timestamp (always "now", since the project was just
      // created) -- an ancient date always loses that comparison.
      MockClsiCache.addEntry(
        `/project/${projectId}/user/${owner.id}/latest/output/output.overleaf.json`,
        {
          content: '{}',
          contentType: 'application/json',
          lastModified: new Date(0),
        }
      )
      const { response, body } = await owner.doRequest('get', {
        url: `/project/${projectId}/output/cached/output.overleaf.json`,
      })
      expect(response.statusCode).to.equal(410)
      expect(body).to.equal('Gone')
    })
  })

  describe('GET /download/project/:Project_id/build/:editorBuildId/output/cached/:filename', function () {
    it('should reject a malformed project id with 404', async function () {
      const { response, body } = await owner.doRequest('get', {
        url: '/download/project/not-an-object-id/build/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa-1111111-2222222/output/cached/output.pdf',
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        404,
        'Project_id'
      )
    })

    it('should reject a malformed editorBuildId with 404', async function () {
      const { response, body } = await owner.doRequest('get', {
        url: `/download/project/${projectId}/build/not-a-valid-build-id/output/cached/output.pdf`,
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        404,
        'editorBuildId'
      )
    })

    it('should reject a path traversal filename with 404', async function () {
      const { response, body } = await owner.doRequest('get', {
        url: `/download/project/${projectId}/build/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa-1111111-2222222/output/cached/..%2F..%2F..%2F..%2Fetc%2Fpasswd`,
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        404,
        'filename'
      )
    })

    it('should return 404 when nothing is cached for this build', async function () {
      // Asserting the empty body (rather than just the status code) is what
      // distinguishes "reached the handler and the real cache genuinely has
      // nothing" from "rejected by the schema", which also 404s but with a
      // JSON `{ error, statusCode }` body.
      const { response, body } = await owner.doRequest('get', {
        url: `/download/project/${projectId}/build/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa-1111111-2222222/output/cached/output.pdf`,
      })
      expect(response.statusCode).to.equal(404)
      expect(body).to.equal('')
    })

    it('should return the cached file when the build is genuinely cached', async function () {
      MockClsiCache.addEntry(
        `/project/${projectId}/user/${owner.id}/build/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa-1111111-2222222/search/output/output.pdf`,
        { content: 'mock-pdf-bytes', contentType: 'application/pdf' }
      )
      const { response, body } = await owner.doRequest('get', {
        url: `/download/project/${projectId}/build/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa-1111111-2222222/output/cached/output.pdf`,
      })
      expect(response.statusCode).to.equal(200)
      expect(body).to.equal('mock-pdf-bytes')
    })

    it('should return a nested filename when the build is genuinely cached', async function () {
      // some.blg is allowed by isAllowedFilename's `.blg` suffix branch
      // rather than its list of literal names -- proves that branch reaches
      // the cache lookup and back.
      MockClsiCache.addEntry(
        `/project/${projectId}/user/${owner.id}/build/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa-1111111-2222222/search/output/some.blg`,
        { content: 'mock-blg-bytes', contentType: 'text/plain' }
      )
      const { response, body } = await owner.doRequest('get', {
        url: `/download/project/${projectId}/build/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa-1111111-2222222/output/cached/some.blg`,
      })
      expect(response.statusCode).to.equal(200)
      expect(body).to.equal('mock-blg-bytes')
    })
  })
})
