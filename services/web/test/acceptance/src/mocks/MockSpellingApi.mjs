import AbstractMockApi from './AbstractMockApi.mjs'
import { parseReq, z, zz } from '@overleaf/validation-tools'

const userParamsSchema = z.object({
  params: z.strictObject({ userId: zz.objectId() }),
})

const wordSchema = z.object({
  params: z.strictObject({ userId: zz.objectId() }),
  // learn/unlearn silently no-op on a missing word (see the `if (word)`
  // checks below), so word is optional rather than required.
  body: z.strictObject({ word: z.string().optional() }),
})

class MockSpellingApi extends AbstractMockApi {
  reset() {
    this.words = {}
  }

  applyRoutes() {
    this.app.get('/user/:userId', (req, res) => {
      const { params } = parseReq(req, userParamsSchema)
      const words = this.words[params.userId] || []
      res.json(words)
    })

    this.app.delete('/user/:userId', (req, res) => {
      const { params } = parseReq(req, userParamsSchema)
      this.words.delete(params.userId)
      res.sendStatus(200)
    })

    this.app.post('/user/:userId/learn', (req, res) => {
      const { params, body } = parseReq(req, wordSchema)
      const word = body.word
      const { userId } = params
      if (word) {
        this.words[userId] = this.words[userId] || []
        if (!this.words[userId].includes(word)) {
          this.words[userId].push(word)
        }
      }
      res.sendStatus(200)
    })

    this.app.post('/user/:userId/unlearn', (req, res) => {
      const { params, body } = parseReq(req, wordSchema)
      const word = body.word
      const { userId } = params
      if (word && this.words[userId]) {
        const wordIndex = this.words[userId].indexOf(word)
        if (wordIndex !== -1) {
          this.words[userId].splice(wordIndex, 1)
        }
      }
      res.sendStatus(200)
    })
  }
}

export default MockSpellingApi

// type hint for the inherited `instance` method
/**
 * @function instance
 * @memberOf MockSpellingApi
 * @static
 * @returns {MockSpellingApi}
 */
