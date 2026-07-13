import AbstractMockApi from './AbstractMockApi.mjs'

class MockAnalyticsApi extends AbstractMockApi {
  reset() {
    this.updates = {}
    this.lastGraphRequest = null
  }

  getLastGraphRequest() {
    return this.lastGraphRequest
  }

  applyRoutes() {
    this.app.get('/graphs/:graph', (req, res) => {
      this.lastGraphRequest = { path: req.path, query: req.query }
      return res.json({})
    })

    this.app.get('/recentInstitutionActivity', (req, res) => {
      res.json({
        institutionId: 123,
        day: {
          projects: 0,
          users: 0,
        },
        week: {
          projects: 0,
          users: 0,
        },
        month: {
          projects: 1,
          users: 2,
        },
      })
    })
  }
}

export default MockAnalyticsApi

// type hint for the inherited `instance` method
/**
 * @function instance
 * @memberOf MockAnalyticsApi
 * @static
 * @returns {MockAnalyticsApi}
 */
