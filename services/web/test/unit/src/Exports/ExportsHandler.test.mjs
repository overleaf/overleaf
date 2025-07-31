import { expect, vi } from 'vitest'
import sinon from 'sinon'
const modulePath = '../../../../app/src/Features/Exports/ExportsHandler.mjs'

describe('ExportsHandler', function () {
  beforeEach(async function (ctx) {
    ctx.stubRequest = {}
    ctx.request = {
      defaults: () => {
        return ctx.stubRequest
      },
    }

    vi.doMock('../../../../app/src/Features/Project/ProjectGetter', () => ({
      default: (ctx.ProjectGetter = {}),
    }))

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectHistoryHandler',
      () => ({
        default: (ctx.ProjectHistoryHandler = {}),
      })
    )

    vi.doMock('../../../../app/src/Features/Project/ProjectLocator', () => ({
      default: (ctx.ProjectLocator = {}),
    }))

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectRootDocManager',
      () => ({
        default: (ctx.ProjectRootDocManager = {}),
      })
    )

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: (ctx.UserGetter = {}),
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.settings = {}),
    }))

    vi.doMock('request', () => ({
      default: ctx.request,
    }))

    ctx.ExportsHandler = (await import(modulePath)).default
    ctx.project_id = 'project-id-123'
    ctx.project_history_id = 987
    ctx.user_id = 'user-id-456'
    ctx.brand_variation_id = 789
    ctx.title = 'title'
    ctx.description = 'description'
    ctx.author = 'author'
    ctx.license = 'other'
    ctx.show_source = true
    ctx.export_params = {
      project_id: ctx.project_id,
      brand_variation_id: ctx.brand_variation_id,
      user_id: ctx.user_id,
      title: ctx.title,
      description: ctx.description,
      author: ctx.author,
      license: ctx.license,
      show_source: ctx.show_source,
    }
    ctx.callback = sinon.stub()
  })

  describe('exportProject', function () {
    beforeEach(function (ctx) {
      ctx.export_data = { iAmAnExport: true }
      ctx.response_body = { iAmAResponseBody: true }
      ctx.ExportsHandler._buildExport = sinon
        .stub()
        .yields(null, ctx.export_data)
      ctx.ExportsHandler._requestExport = sinon
        .stub()
        .yields(null, ctx.response_body)
    })

    describe('when all goes well', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.ExportsHandler.exportProject(
            ctx.export_params,
            (error, exportData) => {
              ctx.callback(error, exportData)
              resolve()
            }
          )
        })
      })

      it('should build the export', function (ctx) {
        ctx.ExportsHandler._buildExport
          .calledWith(ctx.export_params)
          .should.equal(true)
      })

      it('should request the export', function (ctx) {
        ctx.ExportsHandler._requestExport
          .calledWith(ctx.export_data)
          .should.equal(true)
      })

      it('should return the export', function (ctx) {
        ctx.callback.calledWith(null, ctx.export_data).should.equal(true)
      })
    })

    describe("when request can't be built", function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.ExportsHandler._buildExport = sinon
            .stub()
            .yields(new Error('cannot export project without root doc'))
          ctx.ExportsHandler.exportProject(
            ctx.export_params,
            (error, exportData) => {
              ctx.callback(error, exportData)
              resolve()
            }
          )
        })
      })

      it('should return an error', function (ctx) {
        expect(ctx.callback.args[0][0]).to.be.instanceOf(Error)
      })
    })

    describe('when export request returns an error to forward to the user', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.error_json = { status: 422, message: 'nope' }
          ctx.ExportsHandler._requestExport = sinon
            .stub()
            .yields(null, { forwardResponse: ctx.error_json })
          ctx.ExportsHandler.exportProject(
            ctx.export_params,
            (error, exportData) => {
              ctx.callback(error, exportData)
              resolve()
            }
          )
        })
      })

      it('should return success and the response to forward', function (ctx) {
        expect(ctx.callback.args[0][0]).not.to.be.instanceOf(Error)
        ctx.callback.calledWith(null, {
          forwardResponse: ctx.error_json,
        })
      })
    })
  })

  describe('_buildExport', function () {
    beforeEach(async function (ctx) {
      await new Promise(resolve => {
        ctx.project = {
          id: ctx.project_id,
          rootDoc_id: 'doc1_id',
          compiler: 'pdflatex',
          imageName: 'mock-image-name',
          overleaf: {
            id: ctx.project_history_id, // for projects imported from v1
            history: {
              id: ctx.project_history_id,
            },
          },
        }
        ctx.user = {
          id: ctx.user_id,
          first_name: 'Arthur',
          last_name: 'Author',
          email: 'arthur.author@arthurauthoring.org',
          overleaf: {
            id: 876,
          },
        }
        ctx.rootDocPath = 'main.tex'
        ctx.historyVersion = 777
        ctx.ProjectGetter.getProject = sinon.stub().yields(null, ctx.project)
        ctx.ProjectHistoryHandler.ensureHistoryExistsForProject = sinon
          .stub()
          .yields(null)
        ctx.ProjectLocator.findRootDoc = sinon
          .stub()
          .yields(null, [null, { fileSystem: 'main.tex' }])
        ctx.ProjectRootDocManager.ensureRootDocumentIsValid = sinon
          .stub()
          .callsArgWith(1, null)
        ctx.UserGetter.getUser = sinon.stub().yields(null, ctx.user)
        ctx.ExportsHandler._requestVersion = sinon
          .stub()
          .yields(null, ctx.historyVersion)
        resolve()
      })
    })

    describe('when all goes well', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.ExportsHandler._buildExport(
            ctx.export_params,
            (error, exportData) => {
              ctx.callback(error, exportData)
              resolve()
            }
          )
        })
      })

      it('should ensure the project has history', function (ctx) {
        ctx.ProjectHistoryHandler.ensureHistoryExistsForProject.called.should.equal(
          true
        )
      })

      it('should request the project history version', function (ctx) {
        ctx.ExportsHandler._requestVersion.called.should.equal(true)
      })

      it('should return export data', function (ctx) {
        const expectedExportData = {
          project: {
            id: ctx.project_id,
            rootDocPath: ctx.rootDocPath,
            historyId: ctx.project_history_id,
            historyVersion: ctx.historyVersion,
            v1ProjectId: ctx.project_history_id,
            metadata: {
              compiler: 'pdflatex',
              imageName: 'mock-image-name',
              title: ctx.title,
              description: ctx.description,
              author: ctx.author,
              license: ctx.license,
              showSource: ctx.show_source,
            },
          },
          user: {
            id: ctx.user_id,
            firstName: ctx.user.first_name,
            lastName: ctx.user.last_name,
            email: ctx.user.email,
            orcidId: null,
            v1UserId: 876,
          },
          destination: {
            brandVariationId: ctx.brand_variation_id,
          },
          options: {
            callbackUrl: null,
          },
        }
        ctx.callback.calledWith(null, expectedExportData).should.equal(true)
      })
    })

    describe('when we send replacement user first and last name', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.custom_first_name = 'FIRST'
          ctx.custom_last_name = 'LAST'
          ctx.export_params.first_name = ctx.custom_first_name
          ctx.export_params.last_name = ctx.custom_last_name
          ctx.ExportsHandler._buildExport(
            ctx.export_params,
            (error, exportData) => {
              ctx.callback(error, exportData)
              resolve()
            }
          )
        })
      })

      it('should send the data from the user input', function (ctx) {
        const expectedExportData = {
          project: {
            id: ctx.project_id,
            rootDocPath: ctx.rootDocPath,
            historyId: ctx.project_history_id,
            historyVersion: ctx.historyVersion,
            v1ProjectId: ctx.project_history_id,
            metadata: {
              compiler: 'pdflatex',
              imageName: 'mock-image-name',
              title: ctx.title,
              description: ctx.description,
              author: ctx.author,
              license: ctx.license,
              showSource: ctx.show_source,
            },
          },
          user: {
            id: ctx.user_id,
            firstName: ctx.custom_first_name,
            lastName: ctx.custom_last_name,
            email: ctx.user.email,
            orcidId: null,
            v1UserId: 876,
          },
          destination: {
            brandVariationId: ctx.brand_variation_id,
          },
          options: {
            callbackUrl: null,
          },
        }
        ctx.callback.calledWith(null, expectedExportData).should.equal(true)
      })
    })

    describe('when project is not found', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.ProjectGetter.getProject = sinon
            .stub()
            .yields(new Error('project not found'))
          ctx.ExportsHandler._buildExport(
            ctx.export_params,
            (error, exportData) => {
              ctx.callback(error, exportData)
              resolve()
            }
          )
        })
      })

      it('should return an error', function (ctx) {
        expect(ctx.callback.args[0][0]).to.be.instanceOf(Error)
      })
    })

    describe('when project has no root doc', function () {
      describe('when a root doc can be set automatically', function () {
        beforeEach(async function (ctx) {
          await new Promise(resolve => {
            ctx.project.rootDoc_id = null
            ctx.ProjectLocator.findRootDoc = sinon
              .stub()
              .yields(null, [null, { fileSystem: 'other.tex' }])
            ctx.ExportsHandler._buildExport(
              ctx.export_params,
              (error, exportData) => {
                ctx.callback(error, exportData)
                resolve()
              }
            )
          })
        })

        it('should set a root doc', function (ctx) {
          ctx.ProjectRootDocManager.ensureRootDocumentIsValid.called.should.equal(
            true
          )
        })

        it('should return export data', function (ctx) {
          const expectedExportData = {
            project: {
              id: ctx.project_id,
              rootDocPath: 'other.tex',
              historyId: ctx.project_history_id,
              historyVersion: ctx.historyVersion,
              v1ProjectId: ctx.project_history_id,
              metadata: {
                compiler: 'pdflatex',
                imageName: 'mock-image-name',
                title: ctx.title,
                description: ctx.description,
                author: ctx.author,
                license: ctx.license,
                showSource: ctx.show_source,
              },
            },
            user: {
              id: ctx.user_id,
              firstName: ctx.user.first_name,
              lastName: ctx.user.last_name,
              email: ctx.user.email,
              orcidId: null,
              v1UserId: 876,
            },
            destination: {
              brandVariationId: ctx.brand_variation_id,
            },
            options: {
              callbackUrl: null,
            },
          }
          ctx.callback.calledWith(null, expectedExportData).should.equal(true)
        })
      })
    })

    describe('when project has an invalid root doc', function () {
      describe('when a new root doc can be set automatically', function () {
        beforeEach(async function (ctx) {
          await new Promise(resolve => {
            ctx.fakeDoc_id = '1a2b3c4d5e6f'
            ctx.project.rootDoc_id = ctx.fakeDoc_id
            ctx.ProjectLocator.findRootDoc = sinon
              .stub()
              .yields(null, [null, { fileSystem: 'other.tex' }])
            ctx.ExportsHandler._buildExport(
              ctx.export_params,
              (error, exportData) => {
                ctx.callback(error, exportData)
                resolve()
              }
            )
          })
        })

        it('should set a valid root doc', function (ctx) {
          ctx.ProjectRootDocManager.ensureRootDocumentIsValid.called.should.equal(
            true
          )
        })

        it('should return export data', function (ctx) {
          const expectedExportData = {
            project: {
              id: ctx.project_id,
              rootDocPath: 'other.tex',
              historyId: ctx.project_history_id,
              historyVersion: ctx.historyVersion,
              v1ProjectId: ctx.project_history_id,
              metadata: {
                compiler: 'pdflatex',
                imageName: 'mock-image-name',
                title: ctx.title,
                description: ctx.description,
                author: ctx.author,
                license: ctx.license,
                showSource: ctx.show_source,
              },
            },
            user: {
              id: ctx.user_id,
              firstName: ctx.user.first_name,
              lastName: ctx.user.last_name,
              email: ctx.user.email,
              orcidId: null,
              v1UserId: 876,
            },
            destination: {
              brandVariationId: ctx.brand_variation_id,
            },
            options: {
              callbackUrl: null,
            },
          }
          ctx.callback.calledWith(null, expectedExportData).should.equal(true)
        })
      })

      describe('when no root doc can be identified', function () {
        beforeEach(async function (ctx) {
          await new Promise(resolve => {
            ctx.ProjectLocator.findRootDoc = sinon
              .stub()
              .yields(null, [null, null])
            ctx.ExportsHandler._buildExport(
              ctx.export_params,
              (error, exportData) => {
                ctx.callback(error, exportData)
                resolve()
              }
            )
          })
        })

        it('should return an error', function (ctx) {
          expect(ctx.callback.args[0][0]).to.be.instanceOf(Error)
        })
      })
    })

    describe('when user is not found', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.UserGetter.getUser = sinon
            .stub()
            .yields(new Error('user not found'))
          ctx.ExportsHandler._buildExport(
            ctx.export_params,
            (error, exportData) => {
              ctx.callback(error, exportData)
              resolve()
            }
          )
        })
      })

      it('should return an error', function (ctx) {
        expect(ctx.callback.args[0][0]).to.be.instanceOf(Error)
      })
    })

    describe('when project history request fails', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.ExportsHandler._requestVersion = sinon
            .stub()
            .yields(new Error('project history call failed'))
          ctx.ExportsHandler._buildExport(
            ctx.export_params,
            (error, exportData) => {
              ctx.callback(error, exportData)
              resolve()
            }
          )
        })
      })

      it('should return an error', function (ctx) {
        expect(ctx.callback.args[0][0]).to.be.instanceOf(Error)
      })
    })
  })

  describe('_requestExport', function () {
    beforeEach(async function (ctx) {
      await new Promise(resolve => {
        ctx.settings.apis = {
          v1: {
            url: 'http://127.0.0.1:5000',
            user: 'overleaf',
            pass: 'pass',
            timeout: 15000,
          },
        }
        ctx.export_data = { iAmAnExport: true }
        ctx.export_id = 4096
        ctx.stubPost = sinon
          .stub()
          .yields(null, { statusCode: 200 }, { exportId: ctx.export_id })
        resolve()
      })
    })

    describe('when all goes well', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.stubRequest.post = ctx.stubPost
          ctx.ExportsHandler._requestExport(
            ctx.export_data,
            (error, exportV1Id) => {
              ctx.callback(error, exportV1Id)
              resolve()
            }
          )
        })
      })

      it('should issue the request', function (ctx) {
        expect(ctx.stubPost.getCall(0).args[0]).to.deep.equal({
          url: ctx.settings.apis.v1.url + '/api/v1/overleaf/exports',
          auth: {
            user: ctx.settings.apis.v1.user,
            pass: ctx.settings.apis.v1.pass,
          },
          json: ctx.export_data,
          timeout: 15000,
        })
      })

      it('should return the body with v1 export id', function (ctx) {
        ctx.callback
          .calledWith(null, { exportId: ctx.export_id })
          .should.equal(true)
      })
    })

    describe('when the request fails', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.stubRequest.post = sinon
            .stub()
            .yields(new Error('export request failed'))
          ctx.ExportsHandler._requestExport(
            ctx.export_data,
            (error, exportV1Id) => {
              ctx.callback(error, exportV1Id)
              resolve()
            }
          )
        })
      })

      it('should return an error', function (ctx) {
        expect(ctx.callback.args[0][0]).to.be.instanceOf(Error)
      })
    })

    describe('when the request returns an error response to forward', function () {
      beforeEach(async function (ctx) {
        ctx.error_code = 422
        ctx.error_json = { status: ctx.error_code, message: 'nope' }
        ctx.stubRequest.post = sinon
          .stub()
          .yields(null, { statusCode: ctx.error_code }, ctx.error_json)

        await new Promise(resolve => {
          ctx.ExportsHandler._requestExport(
            ctx.export_data,
            (error, exportV1Id) => {
              ctx.callback(error, exportV1Id)
              resolve()
            }
          )
        })
      })

      it('should return success and the response to forward', function (ctx) {
        expect(ctx.callback.args[0][0]).not.to.be.instanceOf(Error)
        ctx.callback.calledWith(null, {
          forwardResponse: ctx.error_json,
        })
      })
    })
  })

  describe('fetchExport', function () {
    beforeEach(async function (ctx) {
      await new Promise(resolve => {
        ctx.settings.apis = {
          v1: {
            url: 'http://127.0.0.1:5000',
            user: 'overleaf',
            pass: 'pass',
            timeout: 15000,
          },
        }
        ctx.export_id = 897
        ctx.body = '{"id":897, "status_summary":"completed"}'
        ctx.stubGet = sinon
          .stub()
          .yields(null, { statusCode: 200 }, { body: ctx.body })
        resolve()
      })
    })

    describe('when all goes well', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.stubRequest.get = ctx.stubGet
          ctx.ExportsHandler.fetchExport(ctx.export_id, (error, body) => {
            ctx.callback(error, body)
            resolve()
          })
        })
      })

      it('should issue the request', function (ctx) {
        expect(ctx.stubGet.getCall(0).args[0]).to.deep.equal({
          url:
            ctx.settings.apis.v1.url +
            '/api/v1/overleaf/exports/' +
            ctx.export_id,
          auth: {
            user: ctx.settings.apis.v1.user,
            pass: ctx.settings.apis.v1.pass,
          },
          timeout: 15000,
        })
      })

      it('should return the v1 export id', function (ctx) {
        ctx.callback.calledWith(null, { body: ctx.body }).should.equal(true)
      })
    })
  })

  describe('fetchDownload', function () {
    beforeEach(async function (ctx) {
      await new Promise(resolve => {
        ctx.settings.apis = {
          v1: {
            url: 'http://127.0.0.1:5000',
            user: 'overleaf',
            pass: 'pass',
            timeout: 15000,
          },
        }
        ctx.export_id = 897
        ctx.body =
          'https://writelatex-conversions-dev.s3.amazonaws.com/exports/ieee_latexqc/tnb/2912/xggmprcrpfwbsnqzqqmvktddnrbqkqkr.zip?X-Amz-Expires=14400&X-Amz-Date=20180730T181003Z&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAJDGDIJFGLNVGZH6A/20180730/us-east-1/s3/aws4_request&X-Amz-SignedHeaders=host&X-Amz-Signature=dec990336913cef9933f0e269afe99722d7ab2830ebf2c618a75673ee7159fee'
        ctx.stubGet = sinon
          .stub()
          .yields(null, { statusCode: 200 }, { body: ctx.body })
        resolve()
      })
    })

    describe('when all goes well', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.stubRequest.get = ctx.stubGet
          ctx.ExportsHandler.fetchDownload(
            ctx.export_id,
            'zip',
            (error, body) => {
              ctx.callback(error, body)
              resolve()
            }
          )
        })
      })

      it('should issue the request', function (ctx) {
        expect(ctx.stubGet.getCall(0).args[0]).to.deep.equal({
          url:
            ctx.settings.apis.v1.url +
            '/api/v1/overleaf/exports/' +
            ctx.export_id +
            '/zip_url',
          auth: {
            user: ctx.settings.apis.v1.user,
            pass: ctx.settings.apis.v1.pass,
          },
          timeout: 15000,
        })
      })

      it('should return the v1 export id', function (ctx) {
        ctx.callback.calledWith(null, { body: ctx.body }).should.equal(true)
      })
    })
  })
})
