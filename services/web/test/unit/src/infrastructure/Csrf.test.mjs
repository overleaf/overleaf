import { beforeEach, describe, expect, it, vi } from 'vitest'

import sinon from 'sinon'
const modulePath = '../../../../app/src/infrastructure/Csrf.mjs'

describe('Csrf', function () {
  beforeEach(async function (ctx) {
    ctx.csurf_csrf = sinon
      .stub()
      .callsArgWith(2, (ctx.err = { code: 'EBADCSRFTOKEN' }))

    vi.doMock('csurf', () => ({
      default: sinon.stub().returns(ctx.csurf_csrf),
    }))

    ctx.Csrf = (await import(modulePath)).default
    ctx.csrf = new ctx.Csrf()
    ctx.next = sinon.stub()
    ctx.path = '/foo/bar'
    ctx.req = {
      path: ctx.path,
      method: 'POST',
    }
    ctx.res = {}
  })

  describe('the middleware', function () {
    describe('when there are no excluded routes', function () {
      it('passes the csrf error on', function (ctx) {
        ctx.csrf.middleware(ctx.req, ctx.res, ctx.next)
        return expect(ctx.next.calledWith(ctx.err)).to.equal(true)
      })
    })

    describe('when the route is excluded', function () {
      it('does not pass the csrf error on', function (ctx) {
        ctx.csrf.disableDefaultCsrfProtection(ctx.path, 'POST')
        ctx.csrf.middleware(ctx.req, ctx.res, ctx.next)
        return expect(ctx.next.calledWith(ctx.err)).to.equal(false)
      })
    })

    describe('when there is a partial route match', function () {
      it('passes the csrf error on when the match is too short', function (ctx) {
        ctx.csrf.disableDefaultCsrfProtection('/foo', 'POST')
        ctx.csrf.middleware(ctx.req, ctx.res, ctx.next)
        return expect(ctx.next.calledWith(ctx.err)).to.equal(true)
      })

      it('passes the csrf error on when the match is too long', function (ctx) {
        ctx.csrf.disableDefaultCsrfProtection('/foo/bar/baz', 'POST')
        ctx.csrf.middleware(ctx.req, ctx.res, ctx.next)
        return expect(ctx.next.calledWith(ctx.err)).to.equal(true)
      })
    })

    describe('when there are multiple exclusions', function () {
      it('does not pass the csrf error on when the match is present', function (ctx) {
        ctx.csrf.disableDefaultCsrfProtection(ctx.path, 'POST')
        ctx.csrf.disableDefaultCsrfProtection('/test', 'POST')
        ctx.csrf.disableDefaultCsrfProtection('/a/b/c', 'POST')
        ctx.csrf.middleware(ctx.req, ctx.res, ctx.next)
        return expect(ctx.next.calledWith(ctx.err)).to.equal(false)
      })

      it('passes the csrf error on when the match is not present', function (ctx) {
        ctx.csrf.disableDefaultCsrfProtection('/url', 'POST')
        ctx.csrf.disableDefaultCsrfProtection('/test', 'POST')
        ctx.csrf.disableDefaultCsrfProtection('/a/b/c', 'POST')
        ctx.csrf.middleware(ctx.req, ctx.res, ctx.next)
        return expect(ctx.next.calledWith(ctx.err)).to.equal(true)
      })
    })

    describe('when the method does not match', function () {
      it('passes the csrf error on', function (ctx) {
        ctx.csrf.disableDefaultCsrfProtection(ctx.path, 'POST')
        ctx.req.method = 'GET'
        ctx.csrf.middleware(ctx.req, ctx.res, ctx.next)
        return expect(ctx.next.calledWith(ctx.err)).to.equal(true)
      })
    })

    describe('when the route is excluded, but the error is not a bad-csrf-token error', function () {
      it('passes the error on', async function (ctx) {
        const err = { code: 'EOTHER' }

        ctx.csurf_csrf.callsArgWith(2, err)

        const csrf = new ctx.Csrf()
        csrf.disableDefaultCsrfProtection(ctx.path, 'POST')
        csrf.middleware(ctx.req, ctx.res, ctx.next)
        expect(ctx.next.calledWith(err)).to.equal(true)
        expect(ctx.next.calledWith(ctx.err)).to.equal(false)
      })
    })
  })

  describe('validateRequest', function () {
    describe('when the request is invalid', function () {
      it('calls the callback with error', function (ctx) {
        ctx.cb = sinon.stub()
        ctx.Csrf.validateRequest(ctx.req, ctx.cb)
        expect(ctx.cb.calledWith(ctx.err)).to.equal(true)
      })
    })

    describe('when the request is valid', function () {
      it('calls the callback without an error', async function (ctx) {
        vi.doMock('csurf', () => ({
          default: (ctx.csurf = sinon
            .stub()
            .returns((ctx.csurf_csrf = sinon.stub().callsArg(2)))),
        }))

        ctx.Csrf = (await import(modulePath)).default
        ctx.cb = sinon.stub()
        ctx.Csrf.validateRequest(ctx.req, ctx.cb)
        expect(ctx.cb.calledWith()).to.equal(true)
      })
    })
  })

  describe('validateToken', function () {
    describe('when the request is invalid', function () {
      it('calls the callback with `false`', function (ctx) {
        ctx.cb = sinon.stub()
        ctx.Csrf.validateToken('token', {}, ctx.cb)
        expect(ctx.cb.calledWith(ctx.err)).to.equal(true)
      })
    })

    describe('when the request is valid', function () {
      it('calls the callback with `true`', async function (ctx) {
        vi.doMock('csurf', () => ({
          default: (ctx.csurf = sinon
            .stub()
            .returns((ctx.csurf_csrf = sinon.stub().callsArg(2)))),
        }))

        ctx.Csrf = (await import(modulePath)).default
        ctx.cb = sinon.stub()
        ctx.Csrf.validateToken('goodtoken', {}, ctx.cb)
        expect(ctx.cb.calledWith()).to.equal(true)
      })
    })

    describe('when there is no token', function () {
      it('calls the callback with an error', async function (ctx) {
        vi.doMock('csurf', () => ({
          default: (ctx.csurf = sinon
            .stub()
            .returns((ctx.csurf_csrf = sinon.stub().callsArg(2)))),
        }))

        ctx.Csrf = (await import(modulePath)).default
        ctx.cb = sinon.stub()
        ctx.Csrf.validateToken(null, {}, error => {
          expect(error).to.exist
        })
      })
    })
  })
})
