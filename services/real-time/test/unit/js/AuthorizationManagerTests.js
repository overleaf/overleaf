/* eslint-disable
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
const { expect } = require('chai')
const sinon = require('sinon')
const SandboxedModule = require('sandboxed-module')
const path = require('node:path')
const modulePath = '../../../app/js/AuthorizationManager'

describe('AuthorizationManager', function () {
  beforeEach(function () {
    this.client = { ol_context: {} }

    return (this.AuthorizationManager = SandboxedModule.require(modulePath, {
      requires: {},
    }))
  })

  describe('assertClientCanViewProject', function () {
    it('should allow the readOnly privilegeLevel', function (done) {
      this.client.ol_context.privilege_level = 'readOnly'
      return this.AuthorizationManager.assertClientCanViewProject(
        this.client,
        error => {
          expect(error).to.be.null
          return done()
        }
      )
    })

    it('should allow the readAndWrite privilegeLevel', function (done) {
      this.client.ol_context.privilege_level = 'readAndWrite'
      return this.AuthorizationManager.assertClientCanViewProject(
        this.client,
        error => {
          expect(error).to.be.null
          return done()
        }
      )
    })

    it('should allow the review privilegeLevel', function (done) {
      this.client.ol_context.privilege_level = 'review'
      return this.AuthorizationManager.assertClientCanViewProject(
        this.client,
        error => {
          expect(error).to.be.null
          return done()
        }
      )
    })

    it('should allow the owner privilegeLevel', function (done) {
      this.client.ol_context.privilege_level = 'owner'
      return this.AuthorizationManager.assertClientCanViewProject(
        this.client,
        error => {
          expect(error).to.be.null
          return done()
        }
      )
    })

    return it('should return an error with any other privilegeLevel', function (done) {
      this.client.ol_context.privilege_level = 'unknown'
      return this.AuthorizationManager.assertClientCanViewProject(
        this.client,
        error => {
          error.message.should.equal('not authorized')
          return done()
        }
      )
    })
  })

  describe('assertClientCanEditProject', function () {
    it('should not allow the readOnly privilegeLevel', function (done) {
      this.client.ol_context.privilege_level = 'readOnly'
      return this.AuthorizationManager.assertClientCanEditProject(
        this.client,
        error => {
          error.message.should.equal('not authorized')
          return done()
        }
      )
    })

    it('should allow the readAndWrite privilegeLevel', function (done) {
      this.client.ol_context.privilege_level = 'readAndWrite'
      return this.AuthorizationManager.assertClientCanEditProject(
        this.client,
        error => {
          expect(error).to.be.null
          return done()
        }
      )
    })

    it('should allow the owner privilegeLevel', function (done) {
      this.client.ol_context.privilege_level = 'owner'
      return this.AuthorizationManager.assertClientCanEditProject(
        this.client,
        error => {
          expect(error).to.be.null
          return done()
        }
      )
    })

    return it('should return an error with any other privilegeLevel', function (done) {
      this.client.ol_context.privilege_level = 'unknown'
      return this.AuthorizationManager.assertClientCanEditProject(
        this.client,
        error => {
          error.message.should.equal('not authorized')
          return done()
        }
      )
    })
  })

  // check doc access for project

  describe('assertClientCanViewProjectAndDoc', function () {
    beforeEach(function () {
      this.doc_id = '12345'
      this.callback = sinon.stub()
      return (this.client.ol_context = {})
    })

    describe('when not authorised at the project level', function () {
      beforeEach(function () {
        return (this.client.ol_context.privilege_level = 'unknown')
      })

      it('should not allow access', function () {
        return this.AuthorizationManager.assertClientCanViewProjectAndDoc(
          this.client,
          this.doc_id,
          err => err.message.should.equal('not authorized')
        )
      })

      return describe('even when authorised at the doc level', function () {
        beforeEach(function (done) {
          return this.AuthorizationManager.addAccessToDoc(
            this.client,
            this.doc_id,
            done
          )
        })

        return it('should not allow access', function () {
          return this.AuthorizationManager.assertClientCanViewProjectAndDoc(
            this.client,
            this.doc_id,
            err => err.message.should.equal('not authorized')
          )
        })
      })
    })

    return describe('when authorised at the project level', function () {
      beforeEach(function () {
        return (this.client.ol_context.privilege_level = 'readOnly')
      })

      describe('and not authorised at the document level', function () {
        return it('should not allow access', function () {
          return this.AuthorizationManager.assertClientCanViewProjectAndDoc(
            this.client,
            this.doc_id,
            err => err.message.should.equal('not authorized')
          )
        })
      })

      describe('and authorised at the document level', function () {
        beforeEach(function (done) {
          return this.AuthorizationManager.addAccessToDoc(
            this.client,
            this.doc_id,
            done
          )
        })

        return it('should allow access', function () {
          this.AuthorizationManager.assertClientCanViewProjectAndDoc(
            this.client,
            this.doc_id,
            this.callback
          )
          return this.callback.calledWith(null).should.equal(true)
        })
      })

      return describe('when document authorisation is added and then removed', function () {
        beforeEach(function (done) {
          return this.AuthorizationManager.addAccessToDoc(
            this.client,
            this.doc_id,
            () => {
              return this.AuthorizationManager.removeAccessToDoc(
                this.client,
                this.doc_id,
                done
              )
            }
          )
        })

        return it('should deny access', function () {
          return this.AuthorizationManager.assertClientCanViewProjectAndDoc(
            this.client,
            this.doc_id,
            err => err.message.should.equal('not authorized')
          )
        })
      })
    })
  })

  describe('assertClientCanEditProjectAndDoc', function () {
    beforeEach(function () {
      this.doc_id = '12345'
      this.callback = sinon.stub()
      return (this.client.ol_context = {})
    })

    describe('when not authorised at the project level', function () {
      beforeEach(function () {
        return (this.client.ol_context.privilege_level = 'readOnly')
      })

      it('should not allow access', function () {
        return this.AuthorizationManager.assertClientCanEditProjectAndDoc(
          this.client,
          this.doc_id,
          err => err.message.should.equal('not authorized')
        )
      })

      return describe('even when authorised at the doc level', function () {
        beforeEach(function (done) {
          return this.AuthorizationManager.addAccessToDoc(
            this.client,
            this.doc_id,
            done
          )
        })

        return it('should not allow access', function () {
          return this.AuthorizationManager.assertClientCanEditProjectAndDoc(
            this.client,
            this.doc_id,
            err => err.message.should.equal('not authorized')
          )
        })
      })
    })

    return describe('when authorised at the project level', function () {
      beforeEach(function () {
        return (this.client.ol_context.privilege_level = 'readAndWrite')
      })

      describe('and not authorised at the document level', function () {
        return it('should not allow access', function () {
          return this.AuthorizationManager.assertClientCanEditProjectAndDoc(
            this.client,
            this.doc_id,
            err => err.message.should.equal('not authorized')
          )
        })
      })

      describe('and authorised at the document level', function () {
        beforeEach(function (done) {
          return this.AuthorizationManager.addAccessToDoc(
            this.client,
            this.doc_id,
            done
          )
        })

        return it('should allow access', function () {
          this.AuthorizationManager.assertClientCanEditProjectAndDoc(
            this.client,
            this.doc_id,
            this.callback
          )
          return this.callback.calledWith(null).should.equal(true)
        })
      })

      return describe('when document authorisation is added and then removed', function () {
        beforeEach(function (done) {
          return this.AuthorizationManager.addAccessToDoc(
            this.client,
            this.doc_id,
            () => {
              return this.AuthorizationManager.removeAccessToDoc(
                this.client,
                this.doc_id,
                done
              )
            }
          )
        })

        return it('should deny access', function () {
          return this.AuthorizationManager.assertClientCanEditProjectAndDoc(
            this.client,
            this.doc_id,
            err => err.message.should.equal('not authorized')
          )
        })
      })
    })
  })

  return describe('assertClientCanReviewProjectAndDoc', function () {
    beforeEach(function () {
      this.doc_id = '12345'
      this.callback = sinon.stub()
      return (this.client.ol_context = {})
    })

    describe('when not authorised at the project level', function () {
      beforeEach(function () {
        return (this.client.ol_context.privilege_level = 'readOnly')
      })

      it('should not allow access', function () {
        return this.AuthorizationManager.assertClientCanReviewProjectAndDoc(
          this.client,
          this.doc_id,
          err => err.message.should.equal('not authorized')
        )
      })

      return describe('even when authorised at the doc level', function () {
        beforeEach(function (done) {
          return this.AuthorizationManager.addAccessToDoc(
            this.client,
            this.doc_id,
            done
          )
        })

        return it('should not allow access', function () {
          return this.AuthorizationManager.assertClientCanReviewProjectAndDoc(
            this.client,
            this.doc_id,
            err => err.message.should.equal('not authorized')
          )
        })
      })
    })

    return describe('when authorised at the project level', function () {
      beforeEach(function () {
        return (this.client.ol_context.privilege_level = 'review')
      })

      describe('and not authorised at the document level', function () {
        return it('should not allow access', function () {
          return this.AuthorizationManager.assertClientCanReviewProjectAndDoc(
            this.client,
            this.doc_id,
            err => err.message.should.equal('not authorized')
          )
        })
      })

      describe('and authorised at the document level', function () {
        beforeEach(function (done) {
          return this.AuthorizationManager.addAccessToDoc(
            this.client,
            this.doc_id,
            done
          )
        })

        return it('should allow access', function () {
          this.AuthorizationManager.assertClientCanReviewProjectAndDoc(
            this.client,
            this.doc_id,
            this.callback
          )
          return this.callback.calledWith(null).should.equal(true)
        })
      })

      return describe('when document authorisation is added and then removed', function () {
        beforeEach(function (done) {
          return this.AuthorizationManager.addAccessToDoc(
            this.client,
            this.doc_id,
            () => {
              return this.AuthorizationManager.removeAccessToDoc(
                this.client,
                this.doc_id,
                done
              )
            }
          )
        })

        return it('should deny access', function () {
          return this.AuthorizationManager.assertClientCanReviewProjectAndDoc(
            this.client,
            this.doc_id,
            err => err.message.should.equal('not authorized')
          )
        })
      })
    })
  })
})
