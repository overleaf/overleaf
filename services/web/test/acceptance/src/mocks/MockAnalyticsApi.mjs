import AbstractMockApi from './AbstractMockApi.mjs'

class MockAnalyticsApi extends AbstractMockApi {
  reset() {
    this.updates = {}
  }

  applyRoutes() {
    this.app.get('/graphs/:graph', (req, res) => {
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
