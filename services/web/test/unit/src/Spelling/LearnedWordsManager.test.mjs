import { vi, expect } from 'vitest'
import Errors from '../../../../app/src/Features/Errors/Errors.js'

const modulePath =
  '../../../../app/src/Features/Spelling/LearnedWordsManager.mjs'

vi.mock('../../../../app/src/Features/Errors/Errors.js', () =>
  vi.importActual('../../../../app/src/Features/Errors/Errors.js')
)

describe('LearnedWordsManager', function () {
  beforeEach(async function (ctx) {
    ctx.token = 'a6b3cd919ge'
    ctx.db = {
      spellingPreferences: {
        updateOne: vi.fn(),
        findOne: vi.fn().mockResolvedValue(['pear']),
      },
    }

    vi.doMock('../../../../app/src/infrastructure/mongodb.mjs', () => ({
      default: { db: ctx.db },
    }))

    vi.doMock('@overleaf/metrics', () => ({
      default: {
        inc: vi.fn(),
      },
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: {
        maxDictionarySize: 20,
      },
    }))
    ctx.LearnedWordsManager = (await import(modulePath)).default
  })

  describe('learnWord', function () {
    describe('under size limit', function () {
      beforeEach(async function (ctx) {
        ctx.word = 'instanton'
        await ctx.LearnedWordsManager.promises.learnWord(ctx.token, ctx.word)
      })

      it('should insert the word in the word list in the database', function (ctx) {
        expect(ctx.db.spellingPreferences.updateOne).toHaveBeenCalledWith(
          {
            token: ctx.token,
          },
          {
            $addToSet: { learnedWords: ctx.word },
          },
          {
            upsert: true,
          }
        )
      })
    })

    describe('over size limit', function () {
      beforeEach(function (ctx) {
        ctx.word = 'superlongwordthatwillgobeyondthelimit'
      })

      it('should throw an error and not insert the word in the word list in the database', async function (ctx) {
        await expect(
          ctx.LearnedWordsManager.promises.learnWord(ctx.token, ctx.word)
        ).to.be.rejectedWith(Errors.InvalidError)
        expect(ctx.db.spellingPreferences.updateOne).not.toHaveBeenCalled()
      })
    })
  })

  describe('unlearnWord', function () {
    beforeEach(async function (ctx) {
      ctx.word = 'instanton'
      await ctx.LearnedWordsManager.promises.unlearnWord(ctx.token, ctx.word)
    })

    it('should remove the word from the word list in the database', function (ctx) {
      expect(ctx.db.spellingPreferences.updateOne).toHaveBeenCalledWith(
        {
          token: ctx.token,
        },
        {
          $pull: { learnedWords: ctx.word },
        }
      )
    })
  })

  describe('getLearnedWords', function () {
    beforeEach(async function (ctx) {
      ctx.wordList = ['apples', 'bananas', 'pears']
      ctx.wordListWithDuplicates = ctx.wordList.slice()
      ctx.wordListWithDuplicates.push('bananas')
      ctx.db.spellingPreferences.findOne = vi
        .fn()
        .mockResolvedValue({ learnedWords: ctx.wordListWithDuplicates })
      ctx.learnedWords = await ctx.LearnedWordsManager.promises.getLearnedWords(
        ctx.token
      )
    })

    it('should get the word list for the given user', function (ctx) {
      expect(ctx.db.spellingPreferences.findOne).toHaveBeenCalledWith({
        token: ctx.token,
      })
    })

    it('should return the word list without duplicates', function (ctx) {
      expect(ctx.learnedWords).to.deep.equal(ctx.wordList)
    })
  })

  describe('getLearnedWordsSize', function () {
    it('should return the word list size in the callback', async function (ctx) {
      ctx.db.spellingPreferences.findOne = conditions => {
        return Promise.resolve({
          learnedWords: ['apples', 'bananas', 'pears', 'bananas'],
        })
      }
      const learnedWordsSize =
        await ctx.LearnedWordsManager.promises.getLearnedWordsSize(ctx.token)
      expect(learnedWordsSize).to.equal(38)
    })
  })

  describe('deleteUsersLearnedWords', function () {
    beforeEach(function (ctx) {
      ctx.db.spellingPreferences.deleteOne = vi.fn()
    })

    it('should get the word list for the given user', async function (ctx) {
      await ctx.LearnedWordsManager.promises.deleteUsersLearnedWords(ctx.token)
      expect(ctx.db.spellingPreferences.deleteOne).toHaveBeenCalledWith({
        token: ctx.token,
      })
    })
  })
})
