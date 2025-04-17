import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import {
  deleteJSON,
  FetchError,
  getUserFacingMessage,
  getJSON,
  postJSON,
  putJSON,
} from '../../../frontend/js/infrastructure/fetch-json'

describe('fetchJSON', function () {
  before(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }

  it('handles GET requests', function () {
    fetchMock.once(
      { method: 'GET', url: '/test', headers },
      { status: 200, body: { result: 'success' } }
    )

    return expect(getJSON('/test')).to.eventually.deep.equal({
      result: 'success',
    })
  })

  it('handles 4xx responses', function () {
    fetchMock.get('/test', {
      status: 400,
      body: { message: 'The request was invalid' },
    })

    return expect(getJSON('/test'))
      .to.eventually.be.rejectedWith('Bad Request')
      .and.be.an.instanceOf(FetchError)
      .to.nested.include({
        message: 'Bad Request',
        'data.message': 'The request was invalid',
        'response.status': 400,
        'info.statusCode': 400,
      })
  })

  it('handles 5xx responses', async function () {
    fetchMock.get('/test', { status: 500 })

    return expect(getJSON('/test'))
      .to.eventually.be.rejectedWith('Internal Server Error')
      .and.be.an.instanceOf(FetchError)
      .to.nested.include({
        'response.status': 500,
        'info.statusCode': 500,
      })
  })

  it('handles JSON error responses', async function () {
    fetchMock.get('/test', {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: { message: 'lorem ipsum' },
    })

    return expect(getJSON('/test'))
      .to.eventually.be.rejectedWith('Internal Server Error')
      .and.be.an.instanceOf(FetchError)
      .to.nested.include({
        'data.message': 'lorem ipsum',
      })
  })

  it('handles text error responses', async function () {
    fetchMock.get('/test', {
      status: 500,
      headers: {
        'Content-Type': 'text/plain',
      },
      body: 'lorem ipsum',
    })

    return expect(getJSON('/test'))
      .to.eventually.be.rejectedWith('Internal Server Error')
      .and.be.an.instanceOf(FetchError)
      .to.nested.include({
        'data.message': 'lorem ipsum',
      })
  })

  it('handles text error responses sent as HTML', async function () {
    fetchMock.get('/test', {
      status: 500,
      headers: {
        'Content-Type': 'text/html',
      },
      body: 'lorem ipsum',
    })

    return expect(getJSON('/test'))
      .to.eventually.be.rejectedWith('Internal Server Error')
      .and.be.an.instanceOf(FetchError)
      .to.nested.include({
        'data.message': 'lorem ipsum',
      })
  })

  it('handles (ignores) HTML error responses sent as HTML', async function () {
    fetchMock.get('/test', {
      status: 500,
      headers: {
        'Content-Type': 'text/html',
      },
      body: '<!doctype html><html lang="en"><body><p>lorem ipsum</p></body></html>',
    })

    const promise = getJSON('/test')

    expect(promise)
      .to.eventually.be.rejectedWith('Internal Server Error')
      .and.be.an.instanceOf(FetchError)

    try {
      await promise
    } catch (error) {
      expect(error.data).to.eql({})
    }
  })

  it('handles 5xx responses without a status message', async function () {
    fetchMock.get('/test', { status: 599 })

    return expect(getJSON('/test'))
      .to.eventually.be.rejectedWith('Unexpected Error: 599')
      .and.be.an.instanceOf(FetchError)
      .to.nested.include({
        'response.status': 599,
        'info.statusCode': 599,
        message: 'Unexpected Error: 599',
      })
  })

  it('handles POST requests', function () {
    const body = { example: true }

    fetchMock.once(
      { method: 'POST', url: '/test', headers, body },
      { status: 200, body: { result: 'success' } }
    )

    return expect(postJSON('/test', { body })).to.eventually.deep.equal({
      result: 'success',
    })
  })

  it('handles PUT requests', function () {
    const body = { example: true }

    fetchMock.once(
      { method: 'PUT', url: '/test', headers, body },
      { status: 200, body: { result: 'success' } }
    )

    return expect(putJSON('/test', { body })).to.eventually.deep.equal({
      result: 'success',
    })
  })

  it('handles DELETE requests', function () {
    fetchMock.once({ method: 'DELETE', url: '/test', headers }, { status: 204 })

    return expect(deleteJSON('/test')).to.eventually.deep.equal({})
  })

  describe('getUserFacingMessage()', function () {
    it('returns the error facing message for FetchError instances', function () {
      const error = new FetchError(
        '403 error',
        'http:/example.com',
        {},
        { status: 403 }
      )
      expect(getUserFacingMessage(error)).to.equal(
        'Session error. Please check you have cookies enabled. If the problem persists, try clearing your cache and cookies.'
      )
    })

    it('returns `message` for Error instances different than FetchError', function () {
      const error = new Error('403 error')
      expect(getUserFacingMessage(error)).to.equal('403 error')
    })

    it('returns `undefined` for non-Error instances', function () {
      expect(getUserFacingMessage(undefined)).to.be.undefined
      expect(getUserFacingMessage(null)).to.be.undefined
      expect(getUserFacingMessage('error')).to.be.undefined
    })
  })
})
