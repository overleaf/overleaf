import esmock from 'esmock'
import sinon from 'sinon'
import MockResponse from '../helpers/MockResponse.js'
const modulePath = new URL(
  '../../../../app/src/Features/Spelling/SpellingController.mjs',
  import.meta.url
).pathname

const TEN_SECONDS = 1000 * 10

const SPELLING_HOST = 'http://spelling.service.test'
const SPELLING_URL = 'http://spelling.service.test'

describe('SpellingController', function () {
  const userId = '123nd3ijdks'

  beforeEach(async function () {
    this.requestStreamPipe = sinon.stub()
    this.requestStreamOn = sinon
      .stub()
      .returns({ pipe: this.requestStreamPipe })
    this.request = sinon.stub().returns({
      on: this.requestStreamOn,
    })

    this.AuthenticationController = {
      getLoggedInUserId: req => req.session.user._id,
    }
    this.controller = await esmock.strict(modulePath, {
      '../../../../app/src/Features/Spelling/LearnedWordsManager': {},
      request: this.request,
      '@overleaf/settings': {
        languages: [
          { name: 'English', code: 'en' },
          { name: 'French', code: 'fr' },
        ],
        apis: { spelling: { host: SPELLING_HOST, url: SPELLING_URL } },
      },
      '../../../../app/src/Features/Authentication/AuthenticationController':
        this.AuthenticationController,
    })
    this.req = {
      url: '/spelling/check',
      method: 'POST',
      params: {},
      session: {
        user: {
          _id: userId,
        },
      },
      headers: { Host: SPELLING_HOST },
    }

    this.res = new MockResponse()
  })

  describe('proxyCheckRequestToSpellingApi', function () {
    describe('on successful call', function () {
      beforeEach(function () {
        this.req.session.user._id = this.userId = 'user-id-123'
        this.req.body = { language: 'en', words: ['blab'] }
        this.controller.proxyCheckRequestToSpellingApi(this.req, this.res)
      })

      it('should send a request to the spelling host', function () {
        this.request
          .calledWith({
            url: `${SPELLING_URL}/user/${this.userId}/check`,
            method: this.req.method,
            headers: this.req.headers,
            json: this.req.body,
            timeout: TEN_SECONDS,
          })
          .should.equal(true)
      })

      it('should stream the response to the request', function () {
        this.requestStreamPipe.calledWith(this.res).should.equal(true)
      })

      it('should add an error callback to the request', function () {
        this.requestStreamOn.calledWith('error').should.equal(true)
      })
    })

    describe('when the requested language is not supported', function () {
      beforeEach(function () {
        this.req.session.user._id = this.userId = 'user-id-123'
        this.req.body = { language: 'fi', words: ['blab'] }
        this.controller.proxyCheckRequestToSpellingApi(this.req, this.res)
      })

      it('should not send a request to the spelling host', function () {
        this.request.called.should.equal(false)
      })

      it('should return an empty misspellings array', function () {
        this.res.json.calledWith({ misspellings: [] }).should.equal(true)
      })

      it('should return a 422 status', function () {
        this.res.status.calledWith(422).should.equal(true)
      })
    })

    describe('when no language is indicated', function () {
      beforeEach(function () {
        this.req.session.user._id = this.userId = 'user-id-123'
        this.req.body = { words: ['blab'] }
        this.controller.proxyCheckRequestToSpellingApi(this.req, this.res)
      })

      it('should not send a request to the spelling host', function () {
        this.request.called.should.equal(false)
      })

      it('should return an empty misspellings array', function () {
        this.res.json.calledWith({ misspellings: [] }).should.equal(true)
      })

      it('should return a 422 status', function () {
        this.res.status.calledWith(422).should.equal(true)
      })
    })
  })
})
