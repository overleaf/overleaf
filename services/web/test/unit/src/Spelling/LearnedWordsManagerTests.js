const sinon = require('sinon')
const { expect } = require('chai')
const SandboxedModule = require('sandboxed-module')
const modulePath = require('path').join(
  __dirname,
  '/../../../../app/src/Features/Spelling/LearnedWordsManager'
)
const { InvalidError } = require('../../../../app/src/Features/Errors/Errors')

describe('LearnedWordsManager', function () {
  beforeEach(function () {
    this.token = 'a6b3cd919ge'
    this.callback = sinon.stub()
    this.db = {
      spellingPreferences: {
        updateOne: sinon.stub().yields(),
        findOne: sinon.stub().yields(null, ['pear']),
      },
    }
    this.LearnedWordsManager = SandboxedModule.require(modulePath, {
      requires: {
        '../../infrastructure/mongodb': { db: this.db },
        '@overleaf/metrics': {
          inc: sinon.stub(),
        },
        '@overleaf/settings': {
          maxDictionarySize: 20,
        },
      },
    })
  })

  describe('learnWord', function () {
    describe('under size limit', function () {
      beforeEach(function () {
        this.word = 'instanton'
        this.LearnedWordsManager.learnWord(this.token, this.word, this.callback)
      })

      it('should insert the word in the word list in the database', function () {
        expect(
          this.db.spellingPreferences.updateOne.calledWith(
            {
              token: this.token,
            },
            {
              $addToSet: { learnedWords: this.word },
            },
            {
              upsert: true,
            }
          )
        ).to.equal(true)
      })

      it('should call the callback without error', function () {
        sinon.assert.called(this.callback)
        expect(this.callback.lastCall.args.length).to.equal(0)
      })
    })

    describe('over size limit', function () {
      beforeEach(function () {
        this.word = 'superlongwordthatwillgobeyondthelimit'
        this.LearnedWordsManager.learnWord(this.token, this.word, this.callback)
      })

      it('should not insert the word in the word list in the database', function () {
        expect(this.db.spellingPreferences.updateOne.notCalled).to.equal(true)
      })

      it('should call the callback with error', function () {
        sinon.assert.called(this.callback)
        expect(this.callback.lastCall.args[0]).to.be.instanceof(InvalidError)
      })
    })
  })

  describe('unlearnWord', function () {
    beforeEach(function () {
      this.word = 'instanton'
      this.LearnedWordsManager.unlearnWord(this.token, this.word, this.callback)
    })

    it('should remove the word from the word list in the database', function () {
      expect(
        this.db.spellingPreferences.updateOne.calledWith(
          {
            token: this.token,
          },
          {
            $pull: { learnedWords: this.word },
          }
        )
      ).to.equal(true)
    })

    it('should call the callback', function () {
      expect(this.callback.called).to.equal(true)
    })
  })

  describe('getLearnedWords', function () {
    beforeEach(function () {
      this.wordList = ['apples', 'bananas', 'pears']
      this.wordListWithDuplicates = this.wordList.slice()
      this.wordListWithDuplicates.push('bananas')
      this.db.spellingPreferences.findOne = (conditions, callback) => {
        callback(null, { learnedWords: this.wordListWithDuplicates })
      }
      sinon.spy(this.db.spellingPreferences, 'findOne')
      this.LearnedWordsManager.getLearnedWords(this.token, this.callback)
    })

    it('should get the word list for the given user', function () {
      expect(
        this.db.spellingPreferences.findOne.calledWith({ token: this.token })
      ).to.equal(true)
    })

    it('should return the word list in the callback without duplicates', function () {
      expect(this.callback.calledWith(null, this.wordList)).to.equal(true)
    })
  })

  describe('getLearnedWordsSize', function () {
    it('should return the word list size in the callback', function () {
      this.db.spellingPreferences.findOne = (conditions, callback) => {
        callback(null, {
          learnedWords: ['apples', 'bananas', 'pears', 'bananas'],
        })
      }
      this.LearnedWordsManager.getLearnedWordsSize(this.token, this.callback)
      sinon.assert.calledWith(this.callback, null, 38)
    })
  })

  describe('deleteUsersLearnedWords', function () {
    beforeEach(function () {
      this.db.spellingPreferences.deleteOne = sinon.stub().callsArgWith(1)
    })

    it('should get the word list for the given user', function (done) {
      this.LearnedWordsManager.deleteUsersLearnedWords(this.token, () => {
        this.db.spellingPreferences.deleteOne
          .calledWith({ token: this.token })
          .should.equal(true)
        done()
      })
    })
  })
})
