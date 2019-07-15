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

chai.should()
const { expect } = chai

const modulePath = '../../../../app/src/Features/Templates/TemplatesController'

describe('TemplatesController', function() {
  beforeEach(function() {
    this.user_id = 'user-id'
    this.TemplatesController = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../Authentication/AuthenticationController': (this.AuthenticationController = {
          getLoggedInUserId: sinon.stub().returns(this.user_id)
        }),
        './TemplatesManager': (this.TemplatesManager = {
          createProjectFromV1Template: sinon.stub()
        }),
        'logger-sharelatex': {
          log() {},
          err() {}
        }
      }
    })
    this.next = sinon.stub()
    this.req = {
      body: {
        brandVariationId: 'brand-variation-id',
        compiler: 'compiler',
        mainFile: 'main-file',
        templateId: 'template-id',
        templateName: 'template-name',
        templateVersionId: 'template-version-id'
      },
      session: {
        templateData: 'template-data',
        user: {
          _id: this.user_id
        }
      }
    }
    return (this.res = { redirect: sinon.stub() })
  })

  describe('createProjectFromV1Template', function() {
    describe('on success', function() {
      beforeEach(function() {
        this.project = { _id: 'project-id' }
        this.TemplatesManager.createProjectFromV1Template.yields(
          null,
          this.project
        )
        return this.TemplatesController.createProjectFromV1Template(
          this.req,
          this.res,
          this.next
        )
      })

      it('should call TemplatesManager', function() {
        return this.TemplatesManager.createProjectFromV1Template.should.have.been.calledWithMatch(
          'brand-variation-id',
          'compiler',
          'main-file',
          'template-id',
          'template-name',
          'template-version-id',
          'user-id'
        )
      })

      it('should redirect to project', function() {
        return this.res.redirect.should.have.been.calledWith(
          '/project/project-id'
        )
      })

      it('should delete session', function() {
        return expect(this.req.session.templateData).to.be.undefined
      })
    })

    describe('on error', function() {
      beforeEach(function() {
        this.TemplatesManager.createProjectFromV1Template.yields('error')
        return this.TemplatesController.createProjectFromV1Template(
          this.req,
          this.res,
          this.next
        )
      })

      it('should call next with error', function() {
        return this.next.should.have.been.calledWith('error')
      })

      it('should not redirect', function() {
        return this.res.redirect.called.should.equal(false)
      })
    })
  })
})
