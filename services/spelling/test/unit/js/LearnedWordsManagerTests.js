/* eslint-disable
    handle-callback-err,
    no-undef
*/
// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const chai = require('chai')
const { expect } = chai
const SandboxedModule = require('sandboxed-module')
const modulePath = require('path').join(
  __dirname,
  '../../../app/js/LearnedWordsManager'
)
const { assert } = require('chai')
describe('LearnedWordsManager', function() {
  beforeEach(function() {
    this.token = 'a6b3cd919ge'
    this.callback = sinon.stub()
    this.db = {
      spellingPreferences: {
        update: sinon.stub().callsArg(3)
      }
    }
    this.cache = {
      get: sinon.stub(),
      set: sinon.stub(),
      del: sinon.stub()
    }
    return (this.LearnedWordsManager = SandboxedModule.require(modulePath, {
      requires: {
        './DB': this.db,
        './MongoCache': this.cache,
        'logger-sharelatex': {
          log() {},
          err() {},
          info() {}
        },
        'metrics-sharelatex': {
          timeAsyncMethod: sinon.stub(),
          inc: sinon.stub()
        }
      }
    }))
  })

  describe('learnWord', function() {
    beforeEach(function() {
      this.word = 'instanton'
      return this.LearnedWordsManager.learnWord(
        this.token,
        this.word,
        this.callback
      )
    })

    it('should insert the word in the word list in the database', function() {
      return expect(
        this.db.spellingPreferences.update.calledWith(
          {
            token: this.token
          },
          {
            $push: { learnedWords: this.word }
          },
          {
            upsert: true
          }
        )
      ).to.equal(true)
    })

    return it('should call the callback', function() {
      return expect(this.callback.called).to.equal(true)
    })
  })

  describe('getLearnedWords', function() {
    beforeEach(function() {
      this.wordList = ['apples', 'bananas', 'pears']
      this.db.spellingPreferences.findOne = (conditions, callback) => {
        return callback(null, { learnedWords: this.wordList })
      }
      sinon.spy(this.db.spellingPreferences, 'findOne')
      return this.LearnedWordsManager.getLearnedWords(this.token, this.callback)
    })

    it('should get the word list for the given user', function() {
      return expect(
        this.db.spellingPreferences.findOne.calledWith({ token: this.token })
      ).to.equal(true)
    })

    return it('should return the word list in the callback', function() {
      return expect(this.callback.calledWith(null, this.wordList)).to.equal(
        true
      )
    })
  })

  describe('caching the result', function() {
    it('should use the cache first if it is primed', function(done) {
      this.wordList = ['apples', 'bananas', 'pears']
      this.cache.get.returns(this.wordList)
      this.db.spellingPreferences.findOne = sinon.stub()
      return this.LearnedWordsManager.getLearnedWords(
        this.token,
        (err, spellings) => {
          this.db.spellingPreferences.findOne.called.should.equal(false)
          assert.deepEqual(this.wordList, spellings)
          return done()
        }
      )
    })

    it('should set the cache after hitting the db', function(done) {
      this.wordList = ['apples', 'bananas', 'pears']
      this.db.spellingPreferences.findOne = sinon
        .stub()
        .callsArgWith(1, null, { learnedWords: this.wordList })
      return this.LearnedWordsManager.getLearnedWords(
        this.token,
        (err, spellings) => {
          this.cache.set
            .calledWith(this.token, this.wordList)
            .should.equal(true)
          return done()
        }
      )
    })

    return it('should break cache when update is called', function(done) {
      this.word = 'instanton'
      return this.LearnedWordsManager.learnWord(this.token, this.word, () => {
        this.cache.del.calledWith(this.token).should.equal(true)
        return done()
      })
    })
  })

  return describe('deleteUsersLearnedWords', function() {
    beforeEach(function() {
      return (this.db.spellingPreferences.remove = sinon.stub().callsArgWith(1))
    })

    return it('should get the word list for the given user', function(done) {
      return this.LearnedWordsManager.deleteUsersLearnedWords(
        this.token,
        () => {
          this.db.spellingPreferences.remove
            .calledWith({ token: this.token })
            .should.equal(true)
          return done()
        }
      )
    })
  })
})
