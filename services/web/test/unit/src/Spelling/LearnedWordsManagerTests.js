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
    this.db = {
      spellingPreferences: {
        updateOne: sinon.stub().resolves(),
        findOne: sinon.stub().resolves(['pear']),
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
      beforeEach(async function () {
        this.word = 'instanton'
        await this.LearnedWordsManager.promises.learnWord(this.token, this.word)
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
    })

    describe('over size limit', function () {
      beforeEach(function () {
        this.word = 'superlongwordthatwillgobeyondthelimit'
      })

      it('should throw an error and not insert the word in the word list in the database', async function () {
        await expect(
          this.LearnedWordsManager.promises.learnWord(this.token, this.word)
        ).to.be.rejectedWith(InvalidError)
        expect(this.db.spellingPreferences.updateOne.notCalled).to.equal(true)
      })
    })
  })

  describe('unlearnWord', function () {
    beforeEach(async function () {
      this.word = 'instanton'
      await this.LearnedWordsManager.promises.unlearnWord(this.token, this.word)
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
  })

  describe('getLearnedWords', function () {
    beforeEach(async function () {
      this.wordList = ['apples', 'bananas', 'pears']
      this.wordListWithDuplicates = this.wordList.slice()
      this.wordListWithDuplicates.push('bananas')
      this.db.spellingPreferences.findOne = conditions => {
        return Promise.resolve({ learnedWords: this.wordListWithDuplicates })
      }
      sinon.spy(this.db.spellingPreferences, 'findOne')
      this.learnedWords =
        await this.LearnedWordsManager.promises.getLearnedWords(this.token)
    })

    it('should get the word list for the given user', function () {
      expect(
        this.db.spellingPreferences.findOne.calledWith({ token: this.token })
      ).to.equal(true)
    })

    it('should return the word list without duplicates', function () {
      expect(this.learnedWords).to.deep.equal(this.wordList)
    })
  })

  describe('getLearnedWordsSize', function () {
    it('should return the word list size in the callback', async function () {
      this.db.spellingPreferences.findOne = conditions => {
        return Promise.resolve({
          learnedWords: ['apples', 'bananas', 'pears', 'bananas'],
        })
      }
      const learnedWordsSize =
        await this.LearnedWordsManager.promises.getLearnedWordsSize(this.token)
      expect(learnedWordsSize).to.equal(38)
    })
  })

  describe('deleteUsersLearnedWords', function () {
    beforeEach(function () {
      this.db.spellingPreferences.deleteOne = sinon.stub().resolves()
    })

    it('should get the word list for the given user', async function () {
      await this.LearnedWordsManager.promises.deleteUsersLearnedWords(
        this.token
      )
      expect(
        this.db.spellingPreferences.deleteOne.calledWith({ token: this.token })
      ).to.equal(true)
    })
  })
})
