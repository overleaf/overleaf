const SandboxedModule = require('sandboxed-module')
const { expect } = require('chai')
const sinon = require('sinon')
const ProjectHelper = require('../../../../app/src/Features/Project/ProjectHelper')

const modulePath = '../../../../app/src/Features/Templates/TemplatesController'

describe('TemplatesController', function () {
  beforeEach(function () {
    this.user_id = 'user-id'
    this.TemplatesController = SandboxedModule.require(modulePath, {
      requires: {
        '../Project/ProjectHelper': ProjectHelper,
        '../Authentication/AuthenticationController':
          (this.AuthenticationController = {
            getLoggedInUserId: sinon.stub().returns(this.user_id),
          }),
        './TemplatesManager': (this.TemplatesManager = {
          promises: { createProjectFromV1Template: sinon.stub() },
        }),
      },
    })
    this.next = sinon.stub()
    this.req = {
      body: {
        brandVariationId: 'brand-variation-id',
        compiler: 'compiler',
        mainFile: 'main-file',
        templateId: 'template-id',
        templateName: 'template-name',
        templateVersionId: 'template-version-id',
      },
      session: {
        templateData: 'template-data',
        user: {
          _id: this.user_id,
        },
      },
    }
    return (this.res = { redirect: sinon.stub() })
  })

  describe('createProjectFromV1Template', function () {
    describe('on success', function () {
      beforeEach(function (done) {
        this.project = { _id: 'project-id' }
        this.TemplatesManager.promises.createProjectFromV1Template.resolves(
          this.project
        )
        this.res.redirect.callsFake(() => done())
        this.TemplatesController.createProjectFromV1Template(
          this.req,
          this.res,
          this.next
        )
      })

      it('should call TemplatesManager', function () {
        return this.TemplatesManager.promises.createProjectFromV1Template.should.have.been.calledWithMatch(
          'brand-variation-id',
          'compiler',
          'main-file',
          'template-id',
          'template-name',
          'template-version-id',
          'user-id'
        )
      })

      it('should redirect to project', function () {
        return this.res.redirect.should.have.been.calledWith(
          '/project/project-id'
        )
      })

      it('should delete session', function () {
        return expect(this.req.session.templateData).to.be.undefined
      })
    })

    describe('on error', function () {
      beforeEach(function (done) {
        this.TemplatesManager.promises.createProjectFromV1Template.rejects(
          'error'
        )
        this.next.callsFake(() => done())
        return this.TemplatesController.createProjectFromV1Template(
          this.req,
          this.res,
          this.next
        )
      })

      it('should call next with error', function () {
        return this.next.should.have.been.calledWithMatch(
          sinon.match.instanceOf(Error)
        )
      })

      it('should not redirect', function () {
        return this.res.redirect.called.should.equal(false)
      })
    })
  })
})
