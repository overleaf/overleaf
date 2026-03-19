import { expect } from 'chai'
import V1Api from '../../../app/src/Features/V1/V1Api.mjs'
import MockV1ApiClass from './mocks/MockV1Api.mjs'
import Features from '../../../app/src/infrastructure/Features.mjs'

describe('V1Api', function () {
  const testPath = '/api/v1/overleaf/fake_route_api_handler_tests'

  function testPathWithResponse(statusCode, body = '') {
    const encodedBody = encodeURIComponent(JSON.stringify(body))
    return `${testPath}?expectedStatus=${statusCode}&expectedBody=${encodedBody}`
  }

  beforeEach(function () {
    if (!Features.hasFeature('saas')) {
      this.skip()
    }

    MockV1ApiClass.instance()
  })

  it('returns errors from request handling', async function () {
    let error
    try {
      await V1Api.promises.request({})
    } catch (e) {
      error = e
    }
    expect(error).to.exist
    expect(error.cause.message).to.equal(
      'options.uri must be a string when using options.baseUrl'
    )
  })

  it('returns 500 errors', async function () {
    let error
    const expectedBody = { testing: 'test' }
    const url = testPathWithResponse(500, expectedBody)

    try {
      await V1Api.promises.request({ url })
    } catch (e) {
      error = e
    }
    expect(error).to.exist
    expect(error.message).to.equal('error from V1 API')
    expect(error.info.status).to.equal(500)
    expect(error.info.body).to.deep.equal(expectedBody)
  })

  it('returns 2xx status responses', async function () {
    const expectedBody = { testing: 'success' }
    const url = testPathWithResponse(200, expectedBody)
    const response = await V1Api.promises.request({ url })
    expect(response.response.statusCode).to.equal(200)
    expect(response.body).to.deep.equal(expectedBody)
  })

  it('returns 403 errors', async function () {
    let error
    const url = testPathWithResponse(403)

    try {
      await V1Api.promises.request({ url })
    } catch (e) {
      error = e
    }
    expect(error).to.exist
    expect(error.message).to.equal('overleaf v1 returned forbidden')
    expect(error.statusCode).to.equal(403)
  })

  it('returns 404 errors', async function () {
    let error
    const url = testPathWithResponse(404)

    try {
      await V1Api.promises.request({ uri: url, method: 'GET' })
    } catch (e) {
      error = e
    }
    expect(error).to.exist
    expect(error.message).to.equal(
      `overleaf v1 returned non-success code: 404 GET ${url}`
    )
    expect(error.statusCode).to.equal(404)
  })

  it('returns errors', async function () {
    let error
    const url = testPathWithResponse(402)

    try {
      await V1Api.promises.request({ uri: url, method: 'GET' })
    } catch (e) {
      error = e
    }
    expect(error).to.exist
    expect(error.message).to.equal('overleaf v1 returned non-success code')
    expect(error.statusCode).to.equal(402)
  })

  it('does not return error if expected status', async function () {
    const url = testPathWithResponse(404)
    const response = await V1Api.promises.request({
      url,
      expectedStatusCodes: [404],
    })
    expect(response.response.statusCode).to.equal(404)
  })
})
