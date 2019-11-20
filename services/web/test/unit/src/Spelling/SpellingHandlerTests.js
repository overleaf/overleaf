const SandboxedModule = require('sandboxed-module')
const { expect } = require('chai')
const sinon = require('sinon')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Spelling/SpellingHandler.js'
)

const TIMEOUT = 1000 * 10

const SPELLING_HOST = 'http://spelling.service.test'
const SPELLING_URL = 'http://spelling.service.test'

describe('SpellingHandler', function() {
  let userId, word, dictionary, dictionaryString, request, SpellingHandler

  beforeEach(function() {
    userId = 'wombat'
    word = 'potato'
    dictionary = ['wombaat', 'woombat']
    dictionaryString = JSON.stringify(dictionary)
    request = {
      get: sinon
        .stub()
        .yields(null, { statusCode: 200, body: dictionaryString }),
      post: sinon.stub().yields(null, { statusCode: 204 }),
      delete: sinon.stub().yields(null, { statusCode: 204 })
    }

    SpellingHandler = SandboxedModule.require(modulePath, {
      requires: {
        request: request,
        'logger-sharelatex': {
          warn() {},
          error() {},
          info() {}
        },
        'settings-sharelatex': {
          apis: { spelling: { host: SPELLING_HOST, url: SPELLING_URL } }
        }
      }
    })
  })

  describe('getUserDictionary', function() {
    it('calls the spelling API', function(done) {
      SpellingHandler.getUserDictionary(userId, () => {
        expect(request.get).to.have.been.calledWith({
          url: 'http://spelling.service.test/user/wombat',
          timeout: TIMEOUT
        })
        done()
      })
    })

    it('returns the dictionary', function(done) {
      SpellingHandler.getUserDictionary(userId, (err, dictionary) => {
        expect(err).not.to.exist
        expect(dictionary).to.deep.equal(dictionary)
        done()
      })
    })

    it('returns an error when the request fails', function(done) {
      request.get = sinon.stub().yields(new Error('ugh'))
      SpellingHandler.getUserDictionary(userId, err => {
        expect(err).to.exist
        done()
      })
    })
  })

  describe('deleteWordFromUserDictionary', function() {
    it('calls the spelling API', function(done) {
      SpellingHandler.deleteWordFromUserDictionary(userId, word, () => {
        expect(request.post).to.have.been.calledWith({
          url: 'http://spelling.service.test/user/wombat/unlearn',
          json: {
            word: word
          },
          timeout: TIMEOUT
        })
        done()
      })
    })

    it('does not return an error', function(done) {
      SpellingHandler.deleteWordFromUserDictionary(userId, word, err => {
        expect(err).not.to.exist
        done()
      })
    })

    it('returns an error when the request fails', function(done) {
      request.post = sinon.stub().yields(new Error('ugh'))
      SpellingHandler.deleteWordFromUserDictionary(userId, word, err => {
        expect(err).to.exist
        done()
      })
    })
  })

  describe('deleteUserDictionary', function() {
    it('calls the spelling API', function(done) {
      SpellingHandler.deleteUserDictionary(userId, () => {
        expect(request.delete).to.have.been.calledWith({
          url: 'http://spelling.service.test/user/wombat',
          timeout: TIMEOUT
        })
        done()
      })
    })

    it('does not return an error', function(done) {
      SpellingHandler.deleteUserDictionary(userId, err => {
        expect(err).not.to.exist
        done()
      })
    })

    it('returns an error when the request fails', function(done) {
      request.delete = sinon.stub().yields(new Error('ugh'))
      SpellingHandler.deleteUserDictionary(userId, err => {
        expect(err).to.exist
        done()
      })
    })
  })
})
