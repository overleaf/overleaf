let MockProjectHistoryApi
const { expressify } = require('@overleaf/promise-utils')
const express = require('express')
const {
  handleValidationError,
  parseReq,
  z,
  zz,
} = require('@overleaf/validation-tools')
const app = express()

const flushProjectSchema = z.object({
  params: z.strictObject({
    project_id: zz.objectId(),
  }),
})

module.exports = MockProjectHistoryApi = {
  async flushProject(docId) {},

  run() {
    app.post(
      '/project/:project_id/flush',
      expressify(async (req, res, next) => {
        const { params } = parseReq(req, flushProjectSchema)
        try {
          await this.flushProject(params.project_id)
          return res.sendStatus(204)
        } catch (error) {
          return res.sendStatus(500)
        }
      })
    )

    app.use(handleValidationError)

    return app.listen(3054, error => {
      if (error != null) {
        throw error
      }
    })
  },
}

MockProjectHistoryApi.run()
