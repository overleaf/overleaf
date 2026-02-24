import AbstractMockApi from './AbstractMockApi.mjs'
import { plainTextResponse } from '../../../../app/src/infrastructure/Response.mjs'

class MockClsiNginxApi extends AbstractMockApi {
  applyRoutes() {
    this.app.get(
      '/project/:project_id/build/:build_id/output/*',
      (req, res) => {
        const filename = req.params[0]
        if (filename === 'output.pdf') {
          plainTextResponse(res, 'mock-pdf')
        } else if (filename === 'output.log') {
          plainTextResponse(res, 'mock-log')
        } else {
          res.sendStatus(404)
        }
      }
    )

    this.app.get(
      '/project/:project_id/user/:user_id/build/:build_id/output/:output_path',
      (req, res) => {
        plainTextResponse(res, 'hello')
      }
    )
  }
}

export default MockClsiNginxApi

// type hint for the inherited `instance` method
/**
 * @function instance
 * @memberOf MockClsiNginxApi
 * @static
 * @returns {MockClsiNginxApi}
 */
