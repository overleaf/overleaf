import AbstractMockApi from './AbstractMockApi.mjs'
import { parseReq, z, zz } from '@overleaf/validation-tools'
import { zipAttachment } from '../../../../app/src/infrastructure/Response.mjs'

// Mirrors services/clsi/app/js/CompileController.js's projectOrUserParamsSchema
// (this mock stands in for clsi's own API in web's acceptance tests).
const compileParamsSchema = z.object({
  params: z.strictObject({
    project_id: zz.objectId().or(zz.submissionId()),
    user_id: zz.objectId().optional(),
  }),
})

// The wordcount request carries the same {compile: {...}} payload as a compile
// request; the tests only assert on the resources web sent, so keep the body
// loose here and let clsi's own schema be the strict one.
const wordcountSchema = z.object({
  params: compileParamsSchema.shape.params,
  body: z.object({ compile: z.looseObject({}) }),
})

// Mirrors services/clsi/app/js/OutputController.js's createOutputZipSchema
// (this mock stands in for clsi's own output.zip archive generation, as
// opposed to clsi-nginx's static file serving handled by
// MockClsiNginxApi.mjs).
const outputZipParamsSchema = z.object({
  params: z.strictObject({
    project_id: zz.objectId().or(zz.submissionId()),
    user_id: zz.objectId().optional(),
    build_id: zz.buildId(),
  }),
})

class MockClsiApi extends AbstractMockApi {
  static compile(req, res) {
    const { params } = parseReq(req, compileParamsSchema)
    res.json({
      compile: {
        status: 'success',
        error: null,
        outputFiles: [
          {
            url: `http://clsi:8080/project/${params.project_id}/build/1234-5678/output/output.pdf`,
            path: 'output.pdf',
            type: 'pdf',
            build: '1234-5678',
          },
          {
            url: `http://clsi:8080/project/${params.project_id}/build/1234-5678/output/output.log`,
            path: 'output.log',
            type: 'log',
            build: '1234-5678',
          },
        ],
      },
    })
  }

  static wordcount(req, res) {
    const { body } = parseReq(req, wordcountSchema)
    MockClsiApi.instance().lastWordcountRequestBody = body
    res.json({
      texcount: {
        encode: 'utf8',
        textWords: 12,
        headWords: 1,
        outside: 0,
        headers: 1,
        elements: 0,
        mathInline: 0,
        mathDisplay: 0,
        errors: 0,
        messages: '',
      },
    })
  }

  static outputZip(req, res) {
    const { params } = parseReq(req, outputZipParamsSchema)
    zipAttachment(res, `mock-zip: ${params.build_id}`, 'output.zip')
  }

  applyRoutes() {
    this.app.post('/project/:project_id/compile', MockClsiApi.compile)
    this.app.post(
      '/project/:project_id/user/:user_id/compile',
      MockClsiApi.compile
    )

    this.app.post('/project/:project_id/wordcount', MockClsiApi.wordcount)
    this.app.post(
      '/project/:project_id/user/:user_id/wordcount',
      MockClsiApi.wordcount
    )

    this.app.get('/project/:project_id/status', (req, res) => {
      res.sendStatus(200)
    })

    this.app.get(
      '/project/:project_id/build/:build_id/output/output.zip',
      MockClsiApi.outputZip
    )
    this.app.get(
      '/project/:project_id/user/:user_id/build/:build_id/output/output.zip',
      MockClsiApi.outputZip
    )
  }
}

export default MockClsiApi

// type hint for the inherited `instance` method
/**
 * @function instance
 * @memberOf MockClsiApi
 * @static
 * @returns {MockClsiApi}
 */
