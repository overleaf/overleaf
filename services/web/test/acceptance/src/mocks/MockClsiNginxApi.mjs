import AbstractMockApi from './AbstractMockApi.mjs'
import { plainTextResponse } from '../../../../app/src/infrastructure/Response.mjs'
import { parseReq, z, zz } from '@overleaf/validation-tools'

// Mirrors services/clsi/app/js/OutputController.js's createOutputZipSchema
// (this mock stands in for clsi-nginx's own output serving).
const outputWildcardSchema = z.object({
  params: z.strictObject({
    project_id: zz.objectId().or(zz.submissionId()),
    build_id: zz.buildId(),
    file: zz.filepath(),
  }),
})

class MockClsiNginxApi extends AbstractMockApi {
  applyRoutes() {
    this.app.get(
      '/project/:project_id/build/:build_id/output/:file(.+)',
      (req, res) => {
        const { params } = parseReq(req, outputWildcardSchema)
        const filename = params.file
        if (filename === 'output.pdf') {
          plainTextResponse(res, 'mock-pdf')
        } else if (filename === 'output.log') {
          plainTextResponse(res, 'mock-log')
        } else if (filename.endsWith('nested.txt')) {
          plainTextResponse(res, `nested.txt: ${req.originalUrl}`)
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
