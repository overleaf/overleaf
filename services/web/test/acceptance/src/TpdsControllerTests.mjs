import request from './helpers/request.js'
import { expectValidationErrorRaw } from '@overleaf/validation-tools/testUtils.js'

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

describe('TpdsController', function () {
  describe('POST /user/:user_id/project/new', function () {
    it('should reject a malformed user_id with 404', async function () {
      const response = await privateApiRequest({
        method: 'post',
        url: '/user/not-an-object-id/project/new',
        json: { projectName: 'foo' },
      })
      expectValidationErrorRaw(response, 404, 'user_id')
    })
  })

  describe('POST /user/:user_id/project/resolve', function () {
    it('should reject a malformed user_id with 404', async function () {
      const response = await privateApiRequest({
        method: 'post',
        url: '/user/not-an-object-id/project/resolve',
        json: { projectName: 'foo' },
      })
      expectValidationErrorRaw(response, 404, 'user_id')
    })
  })

  describe('POST /tpds/folder-update', function () {
    it('should reject a malformed userId with 400', async function () {
      const response = await privateApiRequest({
        method: 'post',
        url: '/tpds/folder-update',
        json: { userId: 'not-an-object-id', path: '/a/b' },
      })
      expectValidationErrorRaw(response, 400, 'userId')
    })
  })

  describe('POST /user/:user_id/update/:path(.+)', function () {
    it('should reject a malformed user_id with 404', async function () {
      const response = await privateApiRequest({
        method: 'post',
        url: '/user/not-an-object-id/update/project-name/file.tex',
      })
      expectValidationErrorRaw(response, 404, 'user_id')
    })
  })

  describe('POST /project/:project_id/contents/:path(.+)', function () {
    it('should reject a malformed project_id with 404', async function () {
      const response = await privateApiRequest({
        method: 'post',
        url: '/project/not-an-object-id/contents/chapters/main.tex',
      })
      expectValidationErrorRaw(response, 404, 'project_id')
    })

    it('should reject a path traversal payload with 404', async function () {
      const response = await privateApiRequest({
        method: 'post',
        url: '/project/507f191e810c19729de860ea/contents/../../../../etc/passwd',
      })
      expectValidationErrorRaw(response, 404, 'params.path')
    })
  })
})
