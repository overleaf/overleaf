import AbstractMockApi from './AbstractMockApi.mjs'

class MockThirdPartyDataStoreApi extends AbstractMockApi {
  reset() {}

  deleteUser(req, res) {
    res.sendStatus(200)
  }

  unlinkUser(req, res) {
    res.sendStatus(200)
  }

  applyRoutes() {
    this.app.delete('/user/:user_id', (req, res) => this.deleteUser(req, res))
    this.app.delete('/user/:user_id/dropbox', (req, res) =>
      this.unlinkUser(req, res)
    )
  }
}

export default MockThirdPartyDataStoreApi

// type hint for the inherited `instance` method
/**
 * @function instance
 * @memberOf MockThirdPartyDataStoreApi
 * @static
 * @returns {MockThirdPartyDataStoreApi}
 */
