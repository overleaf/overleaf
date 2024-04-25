/* eslint-disable
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { RequestFailedError } = require('@overleaf/fetch-utils')
const { ReadableString } = require('@overleaf/stream-utils')

const modulePath = '../../../../app/src/Features/Templates/TemplatesManager'

describe('TemplatesManager', function () {
  beforeEach(function () {
    this.project_id = 'project-id'
    this.brandVariationId = 'brand-variation-id'
    this.compiler = 'pdflatex'
    this.imageName = 'TL2017'
    this.mainFile = 'main.tex'
    this.templateId = 'template-id'
    this.templateName = 'template name'
    this.templateVersionId = 'template-version-id'
    this.user_id = 'user-id'
    this.dumpPath = `${this.dumpFolder}/${this.uuid}`
    this.callback = sinon.stub()
    this.pipeline = sinon.stub().callsFake(async (stream, res) => {
      if (res.callback) res.callback()
    })
    this.request = sinon.stub().returns({
      pipe() {},
      on() {},
      response: {
        statusCode: 200,
      },
    })
    this.fs = {
      promises: { unlink: sinon.stub() },
      unlink: sinon.stub(),
      createWriteStream: sinon.stub().returns({ on: sinon.stub().yields() }),
    }
    this.ProjectUploadManager = {
      promises: {
        createProjectFromZipArchiveWithName: sinon
          .stub()
          .resolves({ _id: this.project_id }),
      },
    }
    this.dumpFolder = 'dump/path'
    this.ProjectOptionsHandler = {
      promises: {
        setCompiler: sinon.stub().resolves(),
        setImageName: sinon.stub().resolves(),
        setBrandVariationId: sinon.stub().resolves(),
      },
    }
    this.uuid = '1234'
    this.ProjectRootDocManager = {
      promises: {
        setRootDocFromName: sinon.stub().resolves(),
      },
    }
    this.ProjectDetailsHandler = {
      getProjectDescription: sinon.stub(),
      fixProjectName: sinon.stub().returns(this.templateName),
    }
    this.Project = { updateOne: sinon.stub().resolves() }
    this.mockStream = new ReadableString('{}')
    this.mockResponse = {
      status: 200,
      headers: new Headers({
        'Content-Length': '2',
        'Content-Type': 'application/json',
      }),
    }
    this.FetchUtils = {
      fetchJson: sinon.stub(),
      fetchStreamWithResponse: sinon.stub().resolves({
        stream: this.mockStream,
        response: this.mockResponse,
      }),
      RequestFailedError,
    }
    this.TemplatesManager = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/fetch-utils': this.FetchUtils,
        '../Uploads/ProjectUploadManager': this.ProjectUploadManager,
        '../Project/ProjectOptionsHandler': this.ProjectOptionsHandler,
        '../Project/ProjectRootDocManager': this.ProjectRootDocManager,
        '../Project/ProjectDetailsHandler': this.ProjectDetailsHandler,
        '../Authentication/SessionManager': (this.SessionManager = {
          getLoggedInUserId: sinon.stub(),
        }),
        '@overleaf/settings': {
          path: {
            dumpFolder: this.dumpFolder,
          },
          siteUrl: (this.siteUrl = 'http://127.0.0.1:3000'),
          apis: {
            v1: {
              url: (this.v1Url = 'http://overleaf.com'),
              user: 'overleaf',
              pass: 'password',
              timeout: 10,
            },
          },
          overleaf: {
            host: this.v1Url,
          },
        },
        crypto: {
          randomUUID: () => this.uuid,
        },
        request: this.request,
        fs: this.fs,
        '../../models/Project': { Project: this.Project },
        'stream/promises': { pipeline: this.pipeline },
      },
    }).promises
    return (this.zipUrl =
      '%2Ftemplates%2F52fb86a81ae1e566597a25f6%2Fv%2F4%2Fzip&templateName=Moderncv%20Banking&compiler=pdflatex')
  })

  describe('createProjectFromV1Template', function () {
    describe('when all options passed', function () {
      beforeEach(function () {
        return this.TemplatesManager.createProjectFromV1Template(
          this.brandVariationId,
          this.compiler,
          this.mainFile,
          this.templateId,
          this.templateName,
          this.templateVersionId,
          this.user_id,
          this.imageName
        )
      })

      it('should fetch zip from v1 based on template id', function () {
        return this.FetchUtils.fetchStreamWithResponse.should.have.been.calledWith(
          `${this.v1Url}/api/v1/overleaf/templates/${this.templateVersionId}`
        )
      })

      it('should save temporary file', function () {
        return this.fs.createWriteStream.should.have.been.calledWith(
          this.dumpPath
        )
      })

      it('should create project', function () {
        return this.ProjectUploadManager.promises.createProjectFromZipArchiveWithName.should.have.been.calledWithMatch(
          this.user_id,
          this.templateName,
          this.dumpPath,
          {
            fromV1TemplateId: this.templateId,
            fromV1TemplateVersionId: this.templateVersionId,
          }
        )
      })

      it('should unlink file', function () {
        return this.fs.promises.unlink.should.have.been.calledWith(
          this.dumpPath
        )
      })

      it('should set project options when passed', function () {
        this.ProjectOptionsHandler.promises.setCompiler.should.have.been.calledWithMatch(
          this.project_id,
          this.compiler
        )
        this.ProjectOptionsHandler.promises.setImageName.should.have.been.calledWithMatch(
          this.project_id,
          this.imageName
        )
        this.ProjectRootDocManager.promises.setRootDocFromName.should.have.been.calledWithMatch(
          this.project_id,
          this.mainFile
        )
        return this.ProjectOptionsHandler.promises.setBrandVariationId.should.have.been.calledWithMatch(
          this.project_id,
          this.brandVariationId
        )
      })

      it('should update project', function () {
        return this.Project.updateOne.should.have.been.calledWithMatch(
          { _id: this.project_id },
          {
            fromV1TemplateId: this.templateId,
            fromV1TemplateVersionId: this.templateVersionId,
          }
        )
      })
    })

    describe('when some options not set', function () {
      beforeEach(function () {
        return this.TemplatesManager.createProjectFromV1Template(
          null,
          null,
          null,
          this.templateId,
          this.templateName,
          this.templateVersionId,
          this.user_id,
          null
        )
      })

      it('should not set missing project options', function () {
        this.ProjectOptionsHandler.promises.setCompiler.called.should.equal(
          false
        )
        this.ProjectRootDocManager.promises.setRootDocFromName.called.should.equal(
          false
        )
        this.ProjectOptionsHandler.promises.setBrandVariationId.called.should.equal(
          false
        )
        return this.ProjectOptionsHandler.promises.setImageName.should.have.been.calledWithMatch(
          this.project_id,
          'wl_texlive:2018.1'
        )
      })
    })
  })
})
