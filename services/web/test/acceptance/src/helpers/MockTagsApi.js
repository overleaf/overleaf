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

    app
      .listen(3012, function(error) {
        if (error) {
          throw error
        }
      })
      .on('error', function(error) {
        console.error('error starting MockTagsApi:', error.message)
        process.exit(1)
      })
  }
}

MockTagsApi.run()

module.exports = MockTagsApi
