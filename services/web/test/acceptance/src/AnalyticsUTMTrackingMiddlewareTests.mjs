import { expect } from 'chai'
import http from 'node:http'
import { fetchRedirect } from '@overleaf/fetch-utils'

const HTTP_TEST_HOST = process.env.HTTP_TEST_HOST || '127.0.0.1'
const HTTP_TEST_PORT = 23000
const BASE_URL = `http://${HTTP_TEST_HOST}:${HTTP_TEST_PORT}`

// Sends a request with the given raw path, bypassing the WHATWG URL parsing
// that fetch()/URL would otherwise use to resolve dot-segments client-side
// before the request ever reaches the wire.
function rawRequest(rawPath) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: HTTP_TEST_HOST,
        port: HTTP_TEST_PORT,
        path: rawPath,
        method: 'GET',
      },
      res => {
        res.resume()
        res.on('end', () => resolve(res))
      }
    )
    req.on('error', reject)
    req.end()
  })
}

describe('AnalyticsUTMTrackingMiddleware', function () {
  it('redirects a normal request to the path without the utm query params', async function () {
    const location = await fetchRedirect(`${BASE_URL}/project?utm_source=foo`)
    expect(location).to.equal(`${BASE_URL}/project`)
  })

  it('redirects a normal request with other params without the utm query params', async function () {
    const location = await fetchRedirect(
      `${BASE_URL}/project?utm_source=foo&other=bar`
    )
    expect(location).to.equal(`${BASE_URL}/project?other=bar`)
  })

  it('redirects to / with other params without the utm query params', async function () {
    const location = await fetchRedirect(
      `${BASE_URL}/?utm_source=foo&other=bar`
    )
    expect(location).to.equal(`${BASE_URL}/?other=bar`)
  })

  it('should block open redirect with a raw path with a plain dot-segment', async function () {
    const res = await rawRequest('/.//evil.com/x?utm_source=foo')
    expect(res.statusCode).to.be.within(300, 399)
    expect(res.headers.location).to.equal('/x')
  })

  it('should block open redirect with a raw path with a percent-encoded dot-segment', async function () {
    const res = await rawRequest('/%2e//evil.com/x?utm_source=foo')
    expect(res.statusCode).to.be.within(300, 399)
    expect(res.headers.location).to.equal('/x')
  })
})
