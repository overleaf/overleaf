let MockAnalyticsApi
const express = require('express')
const app = express()

module.exports = MockAnalyticsApi = {
  updates: {},

  run() {
    app.get('/graphs/:graph', (req, res, next) => {
      return res.json({})
    })

    app
      .listen(3050, error => {
        if (error) {
          throw error
        }
      })
      .on('error', error => {
        console.error('error starting MockAnalyticsApi:', error.message)
        return process.exit(1)
      })
  }
}

MockAnalyticsApi.run()
