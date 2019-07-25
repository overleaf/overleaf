/* eslint-disable
    handle-callback-err
*/
const sinon = require('sinon')
const chai = require('chai')
const { expect } = chai
chai.should()
const SandboxedModule = require('sandboxed-module')
const modulePath = require('path').join(
  __dirname,
  '../../../app/js/SpellingAPIManager'
)

const promiseStub = val => new Promise(resolve => resolve(val))

describe('SpellingAPIManager', function() {
  beforeEach(function() {
    this.token = 'user-id-123'
    this.ASpell = {}
    this.learnedWords = ['lerned']
    this.LearnedWordsManager = {
      getLearnedWords: sinon.stub().callsArgWith(1, null, this.learnedWords),
      learnWord: sinon.stub().callsArg(2),
      unlearnWord: sinon.stub().callsArg(2),
      promises: {
        getLearnedWords: sinon.stub().returns(promiseStub(this.learnedWords))
      }
    }

    this.SpellingAPIManager = SandboxedModule.require(modulePath, {
      requires: {
        './ASpell': this.ASpell,
        './LearnedWordsManager': this.LearnedWordsManager
      }
    })
  })

  describe('runRequest', function() {
    beforeEach(function() {
      this.nonLearnedWords = [
        'some',
        'words',
        'htat',
        'are',
        'speled',
        'rong',
        'lerned'
      ]
      this.allWords = this.nonLearnedWords.concat(this.learnedWords)
      this.misspellings = [
        { index: 2, suggestions: ['that'] },
        { index: 4, suggestions: ['spelled'] },
        { index: 5, suggestions: ['wrong', 'ring'] },
        { index: 6, suggestions: ['learned'] }
      ]
      this.misspellingsWithoutLearnedWords = this.misspellings.slice(0, 3)

      this.ASpell.checkWords = (lang, word, callback) => {
        callback(null, this.misspellings)
      }
      this.ASpell.promises = {
        checkWords: sinon.stub().returns(promiseStub(this.misspellings))
      }
      sinon.spy(this.ASpell, 'checkWords')
    })

    describe('with sensible JSON', function() {
      beforeEach(function(done) {
        this.SpellingAPIManager.runRequest(
          this.token,
          { words: this.allWords },
          (error, result) => {
            this.result = result
            done()
          }
        )
      })

      it('should return the words that are spelled incorrectly and not learned', function() {
        expect(this.result.misspellings).to.deep.equal(
          this.misspellingsWithoutLearnedWords
        )
      })
    })

    describe('with a missing words array', function() {
      beforeEach(function(done) {
        this.SpellingAPIManager.runRequest(this.token, {}, (error, result) => {
          this.error = error
          this.result = result
          done()
        })
      })

      it('should return an error', function() {
        expect(this.error).to.exist
        expect(this.error).to.be.instanceof(Error)
        expect(this.error.message).to.equal('malformed JSON')
      })
    })

    describe('with a missing token', function() {
      beforeEach(function(done) {
        this.SpellingAPIManager.runRequest(
          null,
          { words: this.allWords },
          (error, result) => {
            this.error = error
            this.result = result
            done()
          }
        )
      })

      it('should spell check without using any learned words', function() {
        this.LearnedWordsManager.getLearnedWords.called.should.equal(false)
      })
    })

    describe('without a language', function() {
      beforeEach(function(done) {
        this.SpellingAPIManager.runRequest(
          this.token,
          { words: this.allWords },
          (error, result) => {
            this.result = result
            done()
          }
        )
      })

      it('should use en as the default', function() {
        this.ASpell.promises.checkWords.calledWith('en').should.equal(true)
      })
    })

    describe('with a language', function() {
      beforeEach(function(done) {
        this.language = 'fr'
        this.SpellingAPIManager.runRequest(
          this.token,
          {
            words: this.allWords,
            language: this.language
          },
          (error, result) => {
            this.result = result
            done()
          }
        )
      })

      it('should use the language', function() {
        this.ASpell.promises.checkWords
          .calledWith(this.language)
          .should.equal(true)
      })
    })

    describe('with words from the whitelist', function() {
      beforeEach(function(done) {
        this.whitelistWord = this.SpellingAPIManager.whitelist[0]
        this.words = ['One', 'Two', this.whitelistWord]
        this.SpellingAPIManager.runRequest(
          this.token,
          { words: this.words },
          (error, result) => {
            this.result = result
            done()
          }
        )
      })

      it('should ignore the white-listed word', function() {
        expect(this.result.misspellings.length).to.equal(
          this.misspellings.length - 1
        )
      })
    })
  })

  describe('learnWord', function() {
    describe('without a token', function() {
      beforeEach(function(done) {
        this.SpellingAPIManager.learnWord(null, { word: 'banana' }, error => {
          this.error = error
          done()
        })
      })

      it('should return an error', function() {
        expect(this.error).to.exist
        expect(this.error).to.be.instanceof(Error)
        expect(this.error.message).to.equal('no token provided')
      })
    })

    describe('without a word', function() {
      beforeEach(function(done) {
        this.SpellingAPIManager.learnWord(this.token, {}, error => {
          this.error = error
          done()
        })
      })

      it('should return an error', function() {
        expect(this.error).to.exist
        expect(this.error).to.be.instanceof(Error)
        expect(this.error.message).to.equal('malformed JSON')
      })
    })

    describe('with a word and a token', function() {
      beforeEach(function(done) {
        this.word = 'banana'
        this.SpellingAPIManager.learnWord(
          this.token,
          { word: this.word },
          error => {
            this.error = error
            done()
          }
        )
      })

      it('should call LearnedWordsManager.learnWord', function() {
        this.LearnedWordsManager.learnWord
          .calledWith(this.token, this.word)
          .should.equal(true)
      })
    })
  })

  describe('unlearnWord', function() {
    describe('without a token', function() {
      beforeEach(function(done) {
        this.SpellingAPIManager.unlearnWord(null, { word: 'banana' }, error => {
          this.error = error
          done()
        })
      })

      it('should return an error', function() {
        expect(this.error).to.exist
        expect(this.error).to.be.instanceof(Error)
        expect(this.error.message).to.equal('no token provided')
      })
    })

    describe('without a word', function() {
      beforeEach(function(done) {
        this.SpellingAPIManager.unlearnWord(this.token, {}, error => {
          this.error = error
          done()
        })
      })

      it('should return an error', function() {
        expect(this.error).to.exist
        expect(this.error).to.be.instanceof(Error)
        expect(this.error.message).to.equal('malformed JSON')
      })
    })

    describe('with a word and a token', function() {
      beforeEach(function(done) {
        this.word = 'banana'
        this.SpellingAPIManager.unlearnWord(
          this.token,
          { word: this.word },
          error => {
            this.error = error
            done()
          }
        )
      })

      it('should call LearnedWordsManager.unlearnWord', function() {
        this.LearnedWordsManager.unlearnWord
          .calledWith(this.token, this.word)
          .should.equal(true)
      })
    })
  })
})
