import AbstractMockApi from './AbstractMockApi.mjs'

class MockClsiApi extends AbstractMockApi {
  static compile(req, res) {
    res.json({
      compile: {
        status: 'success',
        error: null,
        outputFiles: [
          {
            url: `http://clsi:8080/project/${req.params.project_id}/build/1234/output/output.pdf`,
            path: 'output.pdf',
            type: 'pdf',
            build: 1234,
          },
          {
            url: `http://clsi:8080/project/${req.params.project_id}/build/1234/output/output.log`,
            path: 'output.log',
            type: 'log',
            build: 1234,
          },
        ],
      },
    })
  }

  applyRoutes() {
    this.app.post('/project/:project_id/compile', MockClsiApi.compile)
    this.app.post(
      '/project/:project_id/user/:user_id/compile',
      MockClsiApi.compile
    )

    this.app.get('/project/:project_id/status', (req, res) => {
      res.sendStatus(200)
    })
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
