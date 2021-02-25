const AbstractMockApi = require('./AbstractMockApi')

// Currently there is nothing implemented here as we have no acceptance tests
// for the notifications API. This does however stop errors appearing in the
// output when the acceptance tests try to connect.

class MockNotificationsApi extends AbstractMockApi {
  applyRoutes() {
    this.app.get('/*', (req, res) => res.sendStatus(200))
    this.app.post('/*', (req, res) => res.sendStatus(200))
  }
}

module.exports = MockNotificationsApi

// type hint for the inherited `instance` method
/**
 * @function instance
 * @memberOf MockNotificationsApi
 * @static
 * @returns {MockNotificationsApi}
 */
