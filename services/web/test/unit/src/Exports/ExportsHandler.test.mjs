// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import sinon from 'sinon'
import esmock from 'esmock'
import { expect } from 'chai'
const modulePath = '../../../../app/src/Features/Exports/ExportsHandler.mjs'

describe('ExportsHandler', function () {
  beforeEach(async function () {
    this.stubRequest = {}
    this.request = {
      defaults: () => {
        return this.stubRequest
      },
    }
    this.ExportsHandler = await esmock.strict(modulePath, {
      '../../../../app/src/Features/Project/ProjectGetter':
        (this.ProjectGetter = {}),
      '../../../../app/src/Features/Project/ProjectHistoryHandler':
        (this.ProjectHistoryHandler = {}),
      '../../../../app/src/Features/Project/ProjectLocator':
        (this.ProjectLocator = {}),
      '../../../../app/src/Features/Project/ProjectRootDocManager':
        (this.ProjectRootDocManager = {}),
      '../../../../app/src/Features/User/UserGetter': (this.UserGetter = {}),
      '@overleaf/settings': (this.settings = {}),
      request: this.request,
    })
    this.project_id = 'project-id-123'
    this.project_history_id = 987
    this.user_id = 'user-id-456'
    this.brand_variation_id = 789
    this.title = 'title'
    this.description = 'description'
    this.author = 'author'
    this.license = 'other'
    this.show_source = true
    this.export_params = {
      project_id: this.project_id,
      brand_variation_id: this.brand_variation_id,
      user_id: this.user_id,
      title: this.title,
      description: this.description,
      author: this.author,
      license: this.license,
      show_source: this.show_source,
    }
    return (this.callback = sinon.stub())
  })

  describe('exportProject', function () {
    beforeEach(function () {
      this.export_data = { iAmAnExport: true }
      this.response_body = { iAmAResponseBody: true }
      this.ExportsHandler._buildExport = sinon
        .stub()
        .yields(null, this.export_data)
      return (this.ExportsHandler._requestExport = sinon
        .stub()
        .yields(null, this.response_body))
    })

    describe('when all goes well', function () {
      beforeEach(function (done) {
        return this.ExportsHandler.exportProject(
          this.export_params,
          (error, exportData) => {
            this.callback(error, exportData)
            return done()
          }
        )
      })

      it('should build the export', function () {
        return this.ExportsHandler._buildExport
          .calledWith(this.export_params)
          .should.equal(true)
      })

      it('should request the export', function () {
        return this.ExportsHandler._requestExport
          .calledWith(this.export_data)
          .should.equal(true)
      })

      it('should return the export', function () {
        return this.callback
          .calledWith(null, this.export_data)
          .should.equal(true)
      })
    })

    describe("when request can't be built", function () {
      beforeEach(function (done) {
        this.ExportsHandler._buildExport = sinon
          .stub()
          .yields(new Error('cannot export project without root doc'))
        return this.ExportsHandler.exportProject(
          this.export_params,
          (error, exportData) => {
            this.callback(error, exportData)
            return done()
          }
        )
      })

      it('should return an error', function () {
        return (this.callback.args[0][0] instanceof Error).should.equal(true)
      })
    })

    describe('when export request returns an error to forward to the user', function () {
      beforeEach(function (done) {
        this.error_json = { status: 422, message: 'nope' }
        this.ExportsHandler._requestExport = sinon
          .stub()
          .yields(null, { forwardResponse: this.error_json })
        return this.ExportsHandler.exportProject(
          this.export_params,
          (error, exportData) => {
            this.callback(error, exportData)
            return done()
          }
        )
      })

      it('should return success and the response to forward', function () {
        ;(this.callback.args[0][0] instanceof Error).should.equal(false)
        return this.callback.calledWith(null, {
          forwardResponse: this.error_json,
        })
      })
    })
  })

  describe('_buildExport', function () {
    beforeEach(function (done) {
      this.project = {
        id: this.project_id,
        rootDoc_id: 'doc1_id',
        compiler: 'pdflatex',
        imageName: 'mock-image-name',
        overleaf: {
          id: this.project_history_id, // for projects imported from v1
          history: {
            id: this.project_history_id,
          },
        },
      }
      this.user = {
        id: this.user_id,
        first_name: 'Arthur',
        last_name: 'Author',
        email: 'arthur.author@arthurauthoring.org',
        overleaf: {
          id: 876,
        },
      }
      this.rootDocPath = 'main.tex'
      this.historyVersion = 777
      this.ProjectGetter.getProject = sinon.stub().yields(null, this.project)
      this.ProjectHistoryHandler.ensureHistoryExistsForProject = sinon
        .stub()
        .yields(null)
      this.ProjectLocator.findRootDoc = sinon
        .stub()
        .yields(null, [null, { fileSystem: 'main.tex' }])
      this.ProjectRootDocManager.ensureRootDocumentIsValid = sinon
        .stub()
        .callsArgWith(1, null)
      this.UserGetter.getUser = sinon.stub().yields(null, this.user)
      this.ExportsHandler._requestVersion = sinon
        .stub()
        .yields(null, this.historyVersion)
      return done()
    })

    describe('when all goes well', function () {
      beforeEach(function (done) {
        return this.ExportsHandler._buildExport(
          this.export_params,
          (error, exportData) => {
            this.callback(error, exportData)
            return done()
          }
        )
      })

      it('should ensure the project has history', function () {
        return this.ProjectHistoryHandler.ensureHistoryExistsForProject.called.should.equal(
          true
        )
      })

      it('should request the project history version', function () {
        return this.ExportsHandler._requestVersion.called.should.equal(true)
      })

      it('should return export data', function () {
        const expectedExportData = {
          project: {
            id: this.project_id,
            rootDocPath: this.rootDocPath,
            historyId: this.project_history_id,
            historyVersion: this.historyVersion,
            v1ProjectId: this.project_history_id,
            metadata: {
              compiler: 'pdflatex',
              imageName: 'mock-image-name',
              title: this.title,
              description: this.description,
              author: this.author,
              license: this.license,
              showSource: this.show_source,
            },
          },
          user: {
            id: this.user_id,
            firstName: this.user.first_name,
            lastName: this.user.last_name,
            email: this.user.email,
            orcidId: null,
            v1UserId: 876,
          },
          destination: {
            brandVariationId: this.brand_variation_id,
          },
          options: {
            callbackUrl: null,
          },
        }
        return this.callback
          .calledWith(null, expectedExportData)
          .should.equal(true)
      })
    })

    describe('when we send replacement user first and last name', function () {
      beforeEach(function (done) {
        this.custom_first_name = 'FIRST'
        this.custom_last_name = 'LAST'
        this.export_params.first_name = this.custom_first_name
        this.export_params.last_name = this.custom_last_name
        return this.ExportsHandler._buildExport(
          this.export_params,
          (error, exportData) => {
            this.callback(error, exportData)
            return done()
          }
        )
      })

      it('should send the data from the user input', function () {
        const expectedExportData = {
          project: {
            id: this.project_id,
            rootDocPath: this.rootDocPath,
            historyId: this.project_history_id,
            historyVersion: this.historyVersion,
            v1ProjectId: this.project_history_id,
            metadata: {
              compiler: 'pdflatex',
              imageName: 'mock-image-name',
              title: this.title,
              description: this.description,
              author: this.author,
              license: this.license,
              showSource: this.show_source,
            },
          },
          user: {
            id: this.user_id,
            firstName: this.custom_first_name,
            lastName: this.custom_last_name,
            email: this.user.email,
            orcidId: null,
            v1UserId: 876,
          },
          destination: {
            brandVariationId: this.brand_variation_id,
          },
          options: {
            callbackUrl: null,
          },
        }
        return this.callback
          .calledWith(null, expectedExportData)
          .should.equal(true)
      })
    })

    describe('when project is not found', function () {
      beforeEach(function (done) {
        this.ProjectGetter.getProject = sinon
          .stub()
          .yields(new Error('project not found'))
        return this.ExportsHandler._buildExport(
          this.export_params,
          (error, exportData) => {
            this.callback(error, exportData)
            return done()
          }
        )
      })

      it('should return an error', function () {
        return (this.callback.args[0][0] instanceof Error).should.equal(true)
      })
    })

    describe('when project has no root doc', function () {
      describe('when a root doc can be set automatically', function () {
        beforeEach(function (done) {
          this.project.rootDoc_id = null
          this.ProjectLocator.findRootDoc = sinon
            .stub()
            .yields(null, [null, { fileSystem: 'other.tex' }])
          return this.ExportsHandler._buildExport(
            this.export_params,
            (error, exportData) => {
              this.callback(error, exportData)
              return done()
            }
          )
        })

        it('should set a root doc', function () {
          return this.ProjectRootDocManager.ensureRootDocumentIsValid.called.should.equal(
            true
          )
        })

        it('should return export data', function () {
          const expectedExportData = {
            project: {
              id: this.project_id,
              rootDocPath: 'other.tex',
              historyId: this.project_history_id,
              historyVersion: this.historyVersion,
              v1ProjectId: this.project_history_id,
              metadata: {
                compiler: 'pdflatex',
                imageName: 'mock-image-name',
                title: this.title,
                description: this.description,
                author: this.author,
                license: this.license,
                showSource: this.show_source,
              },
            },
            user: {
              id: this.user_id,
              firstName: this.user.first_name,
              lastName: this.user.last_name,
              email: this.user.email,
              orcidId: null,
              v1UserId: 876,
            },
            destination: {
              brandVariationId: this.brand_variation_id,
            },
            options: {
              callbackUrl: null,
            },
          }
          return this.callback
            .calledWith(null, expectedExportData)
            .should.equal(true)
        })
      })
    })

    describe('when project has an invalid root doc', function () {
      describe('when a new root doc can be set automatically', function () {
        beforeEach(function (done) {
          this.fakeDoc_id = '1a2b3c4d5e6f'
          this.project.rootDoc_id = this.fakeDoc_id
          this.ProjectLocator.findRootDoc = sinon
            .stub()
            .yields(null, [null, { fileSystem: 'other.tex' }])
          return this.ExportsHandler._buildExport(
            this.export_params,
            (error, exportData) => {
              this.callback(error, exportData)
              return done()
            }
          )
        })

        it('should set a valid root doc', function () {
          return this.ProjectRootDocManager.ensureRootDocumentIsValid.called.should.equal(
            true
          )
        })

        it('should return export data', function () {
          const expectedExportData = {
            project: {
              id: this.project_id,
              rootDocPath: 'other.tex',
              historyId: this.project_history_id,
              historyVersion: this.historyVersion,
              v1ProjectId: this.project_history_id,
              metadata: {
                compiler: 'pdflatex',
                imageName: 'mock-image-name',
                title: this.title,
                description: this.description,
                author: this.author,
                license: this.license,
                showSource: this.show_source,
              },
            },
            user: {
              id: this.user_id,
              firstName: this.user.first_name,
              lastName: this.user.last_name,
              email: this.user.email,
              orcidId: null,
              v1UserId: 876,
            },
            destination: {
              brandVariationId: this.brand_variation_id,
            },
            options: {
              callbackUrl: null,
            },
          }
          return this.callback
            .calledWith(null, expectedExportData)
            .should.equal(true)
        })
      })

      describe('when no root doc can be identified', function () {
        beforeEach(function (done) {
          this.ProjectLocator.findRootDoc = sinon
            .stub()
            .yields(null, [null, null])
          return this.ExportsHandler._buildExport(
            this.export_params,
            (error, exportData) => {
              this.callback(error, exportData)
              return done()
            }
          )
        })

        it('should return an error', function () {
          return (this.callback.args[0][0] instanceof Error).should.equal(true)
        })
      })
    })

    describe('when user is not found', function () {
      beforeEach(function (done) {
        this.UserGetter.getUser = sinon
          .stub()
          .yields(new Error('user not found'))
        return this.ExportsHandler._buildExport(
          this.export_params,
          (error, exportData) => {
            this.callback(error, exportData)
            return done()
          }
        )
      })

      it('should return an error', function () {
        return (this.callback.args[0][0] instanceof Error).should.equal(true)
      })
    })

    describe('when project history request fails', function () {
      beforeEach(function (done) {
        this.ExportsHandler._requestVersion = sinon
          .stub()
          .yields(new Error('project history call failed'))
        return this.ExportsHandler._buildExport(
          this.export_params,
          (error, exportData) => {
            this.callback(error, exportData)
            return done()
          }
        )
      })

      it('should return an error', function () {
        return (this.callback.args[0][0] instanceof Error).should.equal(true)
      })
    })
  })

  describe('_requestExport', function () {
    beforeEach(function (done) {
      this.settings.apis = {
        v1: {
          url: 'http://127.0.0.1:5000',
          user: 'overleaf',
          pass: 'pass',
          timeout: 15000,
        },
      }
      this.export_data = { iAmAnExport: true }
      this.export_id = 4096
      this.stubPost = sinon
        .stub()
        .yields(null, { statusCode: 200 }, { exportId: this.export_id })
      return done()
    })

    describe('when all goes well', function () {
      beforeEach(function (done) {
        this.stubRequest.post = this.stubPost
        return this.ExportsHandler._requestExport(
          this.export_data,
          (error, exportV1Id) => {
            this.callback(error, exportV1Id)
            return done()
          }
        )
      })

      it('should issue the request', function () {
        return expect(this.stubPost.getCall(0).args[0]).to.deep.equal({
          url: this.settings.apis.v1.url + '/api/v1/overleaf/exports',
          auth: {
            user: this.settings.apis.v1.user,
            pass: this.settings.apis.v1.pass,
          },
          json: this.export_data,
          timeout: 15000,
        })
      })

      it('should return the body with v1 export id', function () {
        return this.callback
          .calledWith(null, { exportId: this.export_id })
          .should.equal(true)
      })
    })

    describe('when the request fails', function () {
      beforeEach(function (done) {
        this.stubRequest.post = sinon
          .stub()
          .yields(new Error('export request failed'))
        return this.ExportsHandler._requestExport(
          this.export_data,
          (error, exportV1Id) => {
            this.callback(error, exportV1Id)
            return done()
          }
        )
      })

      it('should return an error', function () {
        return (this.callback.args[0][0] instanceof Error).should.equal(true)
      })
    })

    describe('when the request returns an error response to forward', function () {
      beforeEach(function (done) {
        this.error_code = 422
        this.error_json = { status: this.error_code, message: 'nope' }
        this.stubRequest.post = sinon
          .stub()
          .yields(null, { statusCode: this.error_code }, this.error_json)
        return this.ExportsHandler._requestExport(
          this.export_data,
          (error, exportV1Id) => {
            this.callback(error, exportV1Id)
            return done()
          }
        )
      })

      it('should return success and the response to forward', function () {
        ;(this.callback.args[0][0] instanceof Error).should.equal(false)
        return this.callback.calledWith(null, {
          forwardResponse: this.error_json,
        })
      })
    })
  })

  describe('fetchExport', function () {
    beforeEach(function (done) {
      this.settings.apis = {
        v1: {
          url: 'http://127.0.0.1:5000',
          user: 'overleaf',
          pass: 'pass',
          timeout: 15000,
        },
      }
      this.export_id = 897
      this.body = '{"id":897, "status_summary":"completed"}'
      this.stubGet = sinon
        .stub()
        .yields(null, { statusCode: 200 }, { body: this.body })
      return done()
    })

    describe('when all goes well', function () {
      beforeEach(function (done) {
        this.stubRequest.get = this.stubGet
        return this.ExportsHandler.fetchExport(
          this.export_id,
          (error, body) => {
            this.callback(error, body)
            return done()
          }
        )
      })

      it('should issue the request', function () {
        return expect(this.stubGet.getCall(0).args[0]).to.deep.equal({
          url:
            this.settings.apis.v1.url +
            '/api/v1/overleaf/exports/' +
            this.export_id,
          auth: {
            user: this.settings.apis.v1.user,
            pass: this.settings.apis.v1.pass,
          },
          timeout: 15000,
        })
      })

      it('should return the v1 export id', function () {
        return this.callback
          .calledWith(null, { body: this.body })
          .should.equal(true)
      })
    })
  })

  describe('fetchDownload', function () {
    beforeEach(function (done) {
      this.settings.apis = {
        v1: {
          url: 'http://127.0.0.1:5000',
          user: 'overleaf',
          pass: 'pass',
          timeout: 15000,
        },
      }
      this.export_id = 897
      this.body =
        'https://writelatex-conversions-dev.s3.amazonaws.com/exports/ieee_latexqc/tnb/2912/xggmprcrpfwbsnqzqqmvktddnrbqkqkr.zip?X-Amz-Expires=14400&X-Amz-Date=20180730T181003Z&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAJDGDIJFGLNVGZH6A/20180730/us-east-1/s3/aws4_request&X-Amz-SignedHeaders=host&X-Amz-Signature=dec990336913cef9933f0e269afe99722d7ab2830ebf2c618a75673ee7159fee'
      this.stubGet = sinon
        .stub()
        .yields(null, { statusCode: 200 }, { body: this.body })
      return done()
    })

    describe('when all goes well', function () {
      beforeEach(function (done) {
        this.stubRequest.get = this.stubGet
        return this.ExportsHandler.fetchDownload(
          this.export_id,
          'zip',
          (error, body) => {
            this.callback(error, body)
            return done()
          }
        )
      })

      it('should issue the request', function () {
        return expect(this.stubGet.getCall(0).args[0]).to.deep.equal({
          url:
            this.settings.apis.v1.url +
            '/api/v1/overleaf/exports/' +
            this.export_id +
            '/zip_url',
          auth: {
            user: this.settings.apis.v1.user,
            pass: this.settings.apis.v1.pass,
          },
          timeout: 15000,
        })
      })

      it('should return the v1 export id', function () {
        return this.callback
          .calledWith(null, { body: this.body })
          .should.equal(true)
      })
    })
  })
})
