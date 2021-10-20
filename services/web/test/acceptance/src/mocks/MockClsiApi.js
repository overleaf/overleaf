const AbstractMockApi = require('./AbstractMockApi')

class MockClsiApi extends AbstractMockApi {
  static compile(req, res) {
    res.status(200).send({
      compile: {
        status: 'success',
        error: null,
        outputFiles: [
          {
            url: `http://clsi:3013/project/${req.params.project_id}/build/1234/output/project.pdf`,
            path: 'project.pdf',
            type: 'pdf',
            build: 1234,
          },
          {
            url: `http://clsi:3013/project/${req.params.project_id}/build/1234/output/project.log`,
            path: 'project.log',
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

    this.app.get(
      '/project/:project_id/build/:build_id/output/*',
      (req, res) => {
        const filename = req.params[0]
        if (filename === 'project.pdf') {
          res.status(200).send('mock-pdf')
        } else if (filename === 'project.log') {
          res.status(200).send('mock-log')
        } else {
          res.sendStatus(404)
        }
      }
    )

    this.app.get(
      '/project/:project_id/user/:user_id/build/:build_id/output/:output_path',
      (req, res) => {
        res.status(200).send('hello')
      }
    )

    this.app.get('/project/:project_id/status', (req, res) => {
      res.status(200).send()
    })
  }
}

module.exports = MockClsiApi

// type hint for the inherited `instance` method
/**
 * @function instance
 * @memberOf MockClsiApi
 * @static
 * @returns {MockClsiApi}
 */
