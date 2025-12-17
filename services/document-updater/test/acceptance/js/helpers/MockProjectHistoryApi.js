let MockProjectHistoryApi
const { expressify } = require('@overleaf/promise-utils')
const express = require('express')
const app = express()

module.exports = MockProjectHistoryApi = {
  async flushProject(docId) {},

  run() {
    app.post(
      '/project/:project_id/flush',
      expressify(async (req, res, next) => {
        try {
          await this.flushProject(req.params.project_id)
          return res.sendStatus(204)
        } catch (error) {
          return res.sendStatus(500)
        }
      })
    )

    return app.listen(3054, error => {
      if (error != null) {
        throw error
      }
    })
  },
}

MockProjectHistoryApi.run()
