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
const { assert } = require('chai')
const sinon = require('sinon')
const chai = require('chai')
const should = chai.should()
const { expect } = chai
const modulePath = '../../../../app/src/infrastructure/Csrf.js'
const SandboxedModule = require('sandboxed-module')

describe('Csrf', function() {
  beforeEach(function() {
    this.csurf_csrf = sinon
      .stub()
      .callsArgWith(2, (this.err = { code: 'EBADCSRFTOKEN' }))
    this.Csrf = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        csurf: sinon.stub().returns(this.csurf_csrf)
      }
    })
    this.csrf = new this.Csrf()
    this.next = sinon.stub()
    this.path = '/foo/bar'
    this.req = {
      path: this.path,
      method: 'POST'
    }
    return (this.res = {})
  })

  describe('the middleware', function() {
    describe('when there are no excluded routes', function() {
      it('passes the csrf error on', function() {
        this.csrf.middleware(this.req, this.res, this.next)
        return expect(this.next.calledWith(this.err)).to.equal(true)
      })
    })

    describe('when the route is excluded', function() {
      it('does not pass the csrf error on', function() {
        this.csrf.disableDefaultCsrfProtection(this.path, 'POST')
        this.csrf.middleware(this.req, this.res, this.next)
        return expect(this.next.calledWith(this.err)).to.equal(false)
      })
    })

    describe('when there is a partial route match', function() {
      it('passes the csrf error on when the match is too short', function() {
        this.csrf.disableDefaultCsrfProtection('/foo', 'POST')
        this.csrf.middleware(this.req, this.res, this.next)
        return expect(this.next.calledWith(this.err)).to.equal(true)
      })

      it('passes the csrf error on when the match is too long', function() {
        this.csrf.disableDefaultCsrfProtection('/foo/bar/baz', 'POST')
        this.csrf.middleware(this.req, this.res, this.next)
        return expect(this.next.calledWith(this.err)).to.equal(true)
      })
    })

    describe('when there are multiple exclusions', function() {
      it('does not pass the csrf error on when the match is present', function() {
        this.csrf.disableDefaultCsrfProtection(this.path, 'POST')
        this.csrf.disableDefaultCsrfProtection('/test', 'POST')
        this.csrf.disableDefaultCsrfProtection('/a/b/c', 'POST')
        this.csrf.middleware(this.req, this.res, this.next)
        return expect(this.next.calledWith(this.err)).to.equal(false)
      })

      it('passes the csrf error on when the match is not present', function() {
        this.csrf.disableDefaultCsrfProtection('/url', 'POST')
        this.csrf.disableDefaultCsrfProtection('/test', 'POST')
        this.csrf.disableDefaultCsrfProtection('/a/b/c', 'POST')
        this.csrf.middleware(this.req, this.res, this.next)
        return expect(this.next.calledWith(this.err)).to.equal(true)
      })
    })

    describe('when the method does not match', function() {
      it('passes the csrf error on', function() {
        this.csrf.disableDefaultCsrfProtection(this.path, 'POST')
        this.req.method = 'GET'
        this.csrf.middleware(this.req, this.res, this.next)
        return expect(this.next.calledWith(this.err)).to.equal(true)
      })
    })

    describe('when the route is excluded, but the error is not a bad-csrf-token error', function() {
      it('passes the error on', function() {
        let err
        this.Csrf = SandboxedModule.require(modulePath, {
          globals: {
            console: console
          },
          requires: {
            csurf: (this.csurf = sinon
              .stub()
              .returns(
                (this.csurf_csrf = sinon
                  .stub()
                  .callsArgWith(2, (err = { code: 'EOTHER' })))
              ))
          }
        })
        this.csrf = new this.Csrf()
        this.csrf.disableDefaultCsrfProtection(this.path, 'POST')
        this.csrf.middleware(this.req, this.res, this.next)
        expect(this.next.calledWith(err)).to.equal(true)
        return expect(this.next.calledWith(this.err)).to.equal(false)
      })
    })
  })

  describe('validateRequest', function() {
    describe('when the request is invalid', function() {
      it('calls the callback with `false`', function() {
        this.cb = sinon.stub()
        this.Csrf.validateRequest(this.req, this.cb)
        return expect(this.cb.calledWith(false)).to.equal(true)
      })
    })

    describe('when the request is valid', function() {
      it('calls the callback with `true`', function() {
        this.Csrf = SandboxedModule.require(modulePath, {
          globals: {
            console: console
          },
          requires: {
            csurf: (this.csurf = sinon
              .stub()
              .returns((this.csurf_csrf = sinon.stub().callsArg(2))))
          }
        })
        this.cb = sinon.stub()
        this.Csrf.validateRequest(this.req, this.cb)
        return expect(this.cb.calledWith(true)).to.equal(true)
      })
    })
  })

  describe('validateToken', function() {
    describe('when the request is invalid', function() {
      it('calls the callback with `false`', function() {
        this.cb = sinon.stub()
        this.Csrf.validateToken('token', {}, this.cb)
        return expect(this.cb.calledWith(false)).to.equal(true)
      })
    })

    describe('when the request is valid', function() {
      it('calls the callback with `true`', function() {
        this.Csrf = SandboxedModule.require(modulePath, {
          globals: {
            console: console
          },
          requires: {
            csurf: (this.csurf = sinon
              .stub()
              .returns((this.csurf_csrf = sinon.stub().callsArg(2))))
          }
        })
        this.cb = sinon.stub()
        this.Csrf.validateToken('goodtoken', {}, this.cb)
        return expect(this.cb.calledWith(true)).to.equal(true)
      })
    })

    describe('when there is no token', function() {
      it('calls the callback with `false`', function() {
        this.Csrf = SandboxedModule.require(modulePath, {
          globals: {
            console: console
          },
          requires: {
            csurf: (this.csurf = sinon
              .stub()
              .returns((this.csurf_csrf = sinon.stub().callsArg(2))))
          }
        })
        this.cb = sinon.stub()
        this.Csrf.validateToken(null, {}, this.cb)
        return expect(this.cb.calledWith(false)).to.equal(true)
      })
    })
  })
})
