import AbstractMockApi from './AbstractMockApi.mjs'
import { getRawReqInput } from '@overleaf/validation-tools'

class MockAnalyticsApi extends AbstractMockApi {
  reset() {
    this.updates = {}
    this.lastGraphRequest = null
    this.lastSplitTestAssignmentsRequest = null
    this.lastSplitTestCalcRequest = null
    this.lastSplitTestEventsRequest = null
    this.lastUniExternalCollaborationRequest = null
  }

  getLastGraphRequest() {
    return this.lastGraphRequest
  }

  getLastSplitTestAssignmentsRequest() {
    return this.lastSplitTestAssignmentsRequest
  }

  getLastSplitTestCalcRequest() {
    return this.lastSplitTestCalcRequest
  }

  getLastSplitTestEventsRequest() {
    return this.lastSplitTestEventsRequest
  }

  getLastUniExternalCollaborationRequest() {
    return this.lastUniExternalCollaborationRequest
  }

  applyRoutes() {
    this.app.get('/graphs/:graph', (req, res) => {
      // case 3: recorded verbatim for later assertion by acceptance tests
      this.lastGraphRequest = {
        path: req.path,
        query: getRawReqInput(req).query,
      }
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

    this.app.get('/split-test/get_daily_assignments', (req, res) => {
      // case 3: recorded verbatim for later assertion by acceptance tests
      this.lastSplitTestAssignmentsRequest = {
        query: getRawReqInput(req).query,
      }
      res.json({ default: [0], 'variant-1': [0] })
    })

    this.app.post('/split-test/calc', (req, res) => {
      // case 3: recorded verbatim for later assertion by acceptance tests
      this.lastSplitTestCalcRequest = { body: getRawReqInput(req).body }
      res.json({
        durationDays: 14,
        currentConversionRate: 0.1,
        expectedConversionRate: 0.11,
        requiredCohortSize: 1000,
        totalRequiredUsers: 2000,
        usersPerDay: 100,
      })
    })

    this.app.get('/split-test/events', (req, res) => {
      // case 3: recorded verbatim for later assertion by acceptance tests
      this.lastSplitTestEventsRequest = { query: getRawReqInput(req).query }
      res.json({ 'editor-open': { source: ['ide-open'] } })
    })

    this.app.get('/uniExternalCollaboration', (req, res) => {
      // case 3: recorded verbatim for later assertion by acceptance tests
      this.lastUniExternalCollaborationRequest = {
        query: getRawReqInput(req).query,
      }
      res.json([{ university_id: 123, external_collaborations: 321 }])
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
