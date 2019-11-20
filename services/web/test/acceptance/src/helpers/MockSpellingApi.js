const express = require('express')
const app = express()

const MockSpellingApi = {
  words: {},

  run() {
    app.get('/user/:userId', (req, res) => {
      const { userId } = req.params
      const words = this.words[userId] || []
      res.json(words)
    })

    app.delete('/user/:userId', (req, res) => {
      const { userId } = req.params
      this.words.delete(userId)
      res.sendStatus(200)
    })

    app.post('/user/:userId/learn', (req, res) => {
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

    app.post('/user/:userId/unlearn', (req, res) => {
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

    app
      .listen(3005, error => {
        if (error) {
          throw error
        }
      })
      .on('error', error => {
        console.error('error starting MockSpellingApi:', error.message)
        process.exit(1)
      })
  }
}

MockSpellingApi.run()

module.exports = MockSpellingApi
