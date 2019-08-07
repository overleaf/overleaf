const express = require('express')
const app = express()

const MockTagsApi = {
  tags: {},

  run() {
    app.get('/user/:userId/tag', (req, res) => {
      const { userId } = req.params
      const tags = this.tags[userId]
      res.json(tags)
    })

    app.delete('/user/:user_id/project/:project_id', (req, res) => {
      res.sendStatus(200)
    })

    app
      .listen(3012, error => {
        if (error) {
          throw error
        }
      })
      .on('error', error => {
        console.error('error starting MockTagsApi:', error.message)
        process.exit(1)
      })
  }
}

MockTagsApi.run()

module.exports = MockTagsApi
