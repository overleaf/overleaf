import AbstractMockApi from './AbstractMockApi.mjs'

class MockSpellingApi extends AbstractMockApi {
  reset() {
    this.words = {}
  }

  applyRoutes() {
    this.app.get('/user/:userId', (req, res) => {
      const { userId } = req.params
      const words = this.words[userId] || []
      res.json(words)
    })

    this.app.delete('/user/:userId', (req, res) => {
      const { userId } = req.params
      this.words.delete(userId)
      res.sendStatus(200)
    })

    this.app.post('/user/:userId/learn', (req, res) => {
      const word = req.body.word
      const { userId } = req.params
      if (word) {
        this.words[userId] = this.words[userId] || []
        if (!this.words[userId].includes(word)) {
          this.words[userId].push(word)
        }
      }
      res.sendStatus(200)
    })

    this.app.post('/user/:userId/unlearn', (req, res) => {
      const word = req.body.word
      const { userId } = req.params
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
