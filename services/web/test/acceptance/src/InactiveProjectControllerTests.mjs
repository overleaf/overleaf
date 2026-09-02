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

describe('InactiveProjectController', function () {
  describe('POST /internal/project/:project_id/deactivate', function () {
    // The happy path (real archiving via docstore) isn't exercised here:
    // MockDocstoreApi doesn't implement the archive endpoint this hits, so a
    // full round trip 500s regardless of request validation. That behavior
    // (mocked-manager only) is covered at the unit level instead; this file
    // covers the request-validation wiring.
    it('should reject a malformed project id with 404', async function () {
      const response = await privateApiRequest({
        method: 'post',
        url: `/internal/project/not-an-object-id/deactivate`,
      })
      expectValidationErrorRaw(response, 404, 'project_id')
    })
  })

  describe('POST /internal/deactivateOldProjects', function () {
    it('should reject a non-numeric numberOfProjectsToArchive', async function () {
      const response = await privateApiRequest({
        method: 'post',
        url: '/internal/deactivateOldProjects',
        json: { numberOfProjectsToArchive: 'not-a-number' },
      })
      expectValidationErrorRaw(response, 400, 'numberOfProjectsToArchive')
    })
  })
})
