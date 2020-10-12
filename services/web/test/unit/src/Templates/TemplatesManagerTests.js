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
const assert = require('assert')
const chai = require('chai')
const sinon = require('sinon')

const should = require('chai').should()

const modulePath = '../../../../app/src/Features/Templates/TemplatesManager'

describe('TemplatesManager', function() {
  beforeEach(function() {
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
    this.request = sinon.stub().returns({
      pipe() {},
      on() {},
      response: {
        statusCode: 200
      }
    })
    this.fs = {
      unlink: sinon.stub(),
      createWriteStream: sinon.stub().returns({ on: sinon.stub().yields() })
    }
    this.ProjectUploadManager = {
      createProjectFromZipArchiveWithName: sinon
        .stub()
        .callsArgWith(4, null, { _id: this.project_id })
    }
    this.dumpFolder = 'dump/path'
    this.ProjectOptionsHandler = {
      setCompiler: sinon.stub().callsArgWith(2),
      setImageName: sinon.stub().callsArgWith(2),
      setBrandVariationId: sinon.stub().callsArgWith(2)
    }
    this.uuid = '1234'
    this.ProjectRootDocManager = {
      setRootDocFromName: sinon.stub().callsArgWith(2)
    }
    this.ProjectDetailsHandler = {
      getProjectDescription: sinon.stub(),
      fixProjectName: sinon.stub().returns(this.templateName)
    }
    this.Project = { update: sinon.stub().callsArgWith(3, null) }
    this.FileWriter = { ensureDumpFolderExists: sinon.stub().callsArg(0) }
    this.TemplatesManager = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../Uploads/ProjectUploadManager': this.ProjectUploadManager,
        '../Project/ProjectOptionsHandler': this.ProjectOptionsHandler,
        '../Project/ProjectRootDocManager': this.ProjectRootDocManager,
        '../Project/ProjectDetailsHandler': this.ProjectDetailsHandler,
        '../Authentication/AuthenticationController': (this.AuthenticationController = {
          getLoggedInUserId: sinon.stub()
        }),
        '../../infrastructure/FileWriter': this.FileWriter,
        './TemplatesPublisher': this.TemplatesPublisher,
        'logger-sharelatex': {
          log() {},
          err() {}
        },
        'settings-sharelatex': {
          path: {
            dumpFolder: this.dumpFolder
          },
          siteUrl: (this.siteUrl = 'http://localhost:3000'),
          apis: {
            v1: {
              url: (this.v1Url = 'http://overleaf.com'),
              user: 'sharelatex',
              pass: 'password'
            }
          },
          overleaf: {
            host: this.v1Url
          }
        },
        uuid: {
          v4: () => this.uuid
        },
        request: this.request,
        fs: this.fs,
        '../../models/Project': { Project: this.Project }
      }
    })
    return (this.zipUrl =
      '%2Ftemplates%2F52fb86a81ae1e566597a25f6%2Fv%2F4%2Fzip&templateName=Moderncv%20Banking&compiler=pdflatex')
  })

  describe('createProjectFromV1Template', function() {
    describe('when all options passed', function() {
      beforeEach(function() {
        return this.TemplatesManager.createProjectFromV1Template(
          this.brandVariationId,
          this.compiler,
          this.mainFile,
          this.templateId,
          this.templateName,
          this.templateVersionId,
          this.user_id,
          this.imageName,
          this.callback
        )
      })

      it('should fetch zip from v1 based on template id', function() {
        return this.request.should.have.been.calledWith(
          `${this.v1Url}/api/v1/sharelatex/templates/${this.templateVersionId}`
        )
      })

      it('should save temporary file', function() {
        return this.fs.createWriteStream.should.have.been.calledWith(
          this.dumpPath
        )
      })

      it('should create project', function() {
        return this.ProjectUploadManager.createProjectFromZipArchiveWithName.should.have.been.calledWithMatch(
          this.user_id,
          this.templateName,
          this.dumpPath,
          {
            fromV1TemplateId: this.templateId,
            fromV1TemplateVersionId: this.templateVersionId
          }
        )
      })

      it('should unlink file', function() {
        return this.fs.unlink.should.have.been.calledWith(this.dumpPath)
      })

      it('should set project options when passed', function() {
        this.ProjectOptionsHandler.setCompiler.should.have.been.calledWithMatch(
          this.project_id,
          this.compiler
        )
        this.ProjectOptionsHandler.setImageName.should.have.been.calledWithMatch(
          this.project_id,
          this.imageName
        )
        this.ProjectRootDocManager.setRootDocFromName.should.have.been.calledWithMatch(
          this.project_id,
          this.mainFile
        )
        return this.ProjectOptionsHandler.setBrandVariationId.should.have.been.calledWithMatch(
          this.project_id,
          this.brandVariationId
        )
      })

      it('should update project', function() {
        return this.Project.update.should.have.been.calledWithMatch(
          { _id: this.project_id },
          {
            fromV1TemplateId: this.templateId,
            fromV1TemplateVersionId: this.templateVersionId
          }
        )
      })

      it('should ensure that the dump folder exists', function() {
        return sinon.assert.called(this.FileWriter.ensureDumpFolderExists)
      })
    })

    describe('when some options not set', function() {
      beforeEach(function() {
        return this.TemplatesManager.createProjectFromV1Template(
          null,
          null,
          null,
          this.templateId,
          this.templateName,
          this.templateVersionId,
          this.user_id,
          null,
          this.callback
        )
      })

      it('should not set missing project options', function() {
        this.ProjectOptionsHandler.setCompiler.called.should.equal(false)
        this.ProjectRootDocManager.setRootDocFromName.called.should.equal(false)
        this.ProjectOptionsHandler.setBrandVariationId.called.should.equal(
          false
        )
        return this.ProjectOptionsHandler.setImageName.should.have.been.calledWithMatch(
          this.project_id,
          'wl_texlive:2018.1'
        )
      })
    })
  })
})
