import { vi, describe, beforeEach, it } from 'vitest'

import path from 'node:path'
import sinon from 'sinon'
const modulePath = path.join(
  import.meta.dirname,
  '../../../app/js/StaticServerForbidSymlinks'
)

describe('StaticServerForbidSymlinks', function () {
  beforeEach(async function (ctx) {
    ctx.settings = {
      path: {
        compilesDir: '/compiles/here',
      },
    }

    ctx.fs = {}

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    vi.doMock('fs', () => ({
      default: ctx.fs,
    }))

    ctx.ForbidSymlinks = (await import(modulePath)).default

    ctx.dummyStatic = (rootDir, options) => (req, res, next) =>
      // console.log "dummyStatic serving file", rootDir, "called with", req.url
      // serve it
      next()

    ctx.StaticServerForbidSymlinks = ctx.ForbidSymlinks(
      ctx.dummyStatic,
      ctx.settings.path.compilesDir
    )
    ctx.req = {
      params: {
        project_id: '12345',
      },
    }

    ctx.res = {}
    ctx.req.url = '/12345/output.pdf'
  })

  describe('sending a normal file through', function () {
    beforeEach(function (ctx) {
      ctx.fs.realpath = sinon
        .stub()
        .callsArgWith(
          1,
          null,
          `${ctx.settings.path.compilesDir}/${ctx.req.params.project_id}/output.pdf`
        )
    })

    it('should call next', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.res.sendStatus = function (resCode) {
          resCode.should.equal(200)
          resolve()
        }
        ctx.StaticServerForbidSymlinks(ctx.req, ctx.res, err => {
          if (err) reject(err)
          resolve()
        })
      })
    })
  })

  describe('with a missing file', function () {
    beforeEach(function (ctx) {
      ctx.fs.realpath = sinon
        .stub()
        .callsArgWith(
          1,
          { code: 'ENOENT' },
          `${ctx.settings.path.compilesDir}/${ctx.req.params.project_id}/unknown.pdf`
        )
    })

    it('should send a 404', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.res.sendStatus = function (resCode) {
          resCode.should.equal(404)
          resolve()
        }
        ctx.StaticServerForbidSymlinks(ctx.req, ctx.res)
      })
    })
  })

  describe('with a new line', function () {
    beforeEach(function (ctx) {
      ctx.req.url = '/12345/output.pdf\nother file'
      ctx.fs.realpath = sinon.stub().yields()
    })

    it('should process the correct file', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.res.sendStatus = () => {
          ctx.fs.realpath.should.have.been.calledWith(
            `${ctx.settings.path.compilesDir}/12345/output.pdf\nother file`
          )
          resolve()
        }
        ctx.StaticServerForbidSymlinks(ctx.req, ctx.res)
      })
    })
  })

  describe('with a symlink file', function () {
    beforeEach(function (ctx) {
      ctx.fs.realpath = sinon
        .stub()
        .callsArgWith(1, null, `/etc/${ctx.req.params.project_id}/output.pdf`)
    })

    it('should send a 404', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.res.sendStatus = function (resCode) {
          resCode.should.equal(404)
          resolve()
        }
        ctx.StaticServerForbidSymlinks(ctx.req, ctx.res)
      })
    })
  })

  describe('with a relative file', function () {
    beforeEach(function (ctx) {
      ctx.req.url = '/12345/../67890/output.pdf'
    })

    it('should send a 404', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.res.sendStatus = function (resCode) {
          resCode.should.equal(404)
          resolve()
        }
        ctx.StaticServerForbidSymlinks(ctx.req, ctx.res)
      })
    })
  })

  describe('with a unnormalized file containing .', function () {
    beforeEach(function (ctx) {
      ctx.req.url = '/12345/foo/./output.pdf'
    })

    it('should send a 404', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.res.sendStatus = function (resCode) {
          resCode.should.equal(404)
          resolve()
        }
        ctx.StaticServerForbidSymlinks(ctx.req, ctx.res)
      })
    })
  })

  describe('with a file containing an empty path', function () {
    beforeEach(function (ctx) {
      ctx.req.url = '/12345/foo//output.pdf'
    })

    it('should send a 404', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.res.sendStatus = function (resCode) {
          resCode.should.equal(404)
          resolve()
        }
        ctx.StaticServerForbidSymlinks(ctx.req, ctx.res)
      })
    })
  })

  describe('with a non-project file', function () {
    beforeEach(function (ctx) {
      ctx.req.url = '/.foo/output.pdf'
    })

    it('should send a 404', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.res.sendStatus = function (resCode) {
          resCode.should.equal(404)
          resolve()
        }
        ctx.StaticServerForbidSymlinks(ctx.req, ctx.res)
      })
    })
  })

  describe('with a file outside the compiledir', function () {
    beforeEach(function (ctx) {
      ctx.req.url = '/../bar/output.pdf'
    })

    it('should send a 404', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.res.sendStatus = function (resCode) {
          resCode.should.equal(404)
          resolve()
        }
        ctx.StaticServerForbidSymlinks(ctx.req, ctx.res)
      })
    })
  })

  describe('with a file with no leading /', function () {
    beforeEach(function (ctx) {
      ctx.req.url = './../bar/output.pdf'
    })

    it('should send a 404', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.res.sendStatus = function (resCode) {
          resCode.should.equal(404)
          resolve()
        }
        ctx.StaticServerForbidSymlinks(ctx.req, ctx.res)
      })
    })
  })

  describe('with a github style path', function () {
    beforeEach(function (ctx) {
      ctx.req.url = '/henryoswald-latex_example/output/output.log'
      ctx.fs.realpath = sinon
        .stub()
        .callsArgWith(
          1,
          null,
          `${ctx.settings.path.compilesDir}/henryoswald-latex_example/output/output.log`
        )
    })

    it('should call next', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.res.sendStatus = function (resCode) {
          resCode.should.equal(200)
          resolve()
        }
        ctx.StaticServerForbidSymlinks(ctx.req, ctx.res, err => {
          if (err) reject(err)
          resolve()
        })
      })
    })
  })

  describe('with an error from fs.realpath', function () {
    beforeEach(function (ctx) {
      ctx.fs.realpath = sinon.stub().callsArgWith(1, 'error')
    })

    it('should send a 500', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.res.sendStatus = function (resCode) {
          resCode.should.equal(500)
          resolve()
        }
        ctx.StaticServerForbidSymlinks(ctx.req, ctx.res)
      })
    })
  })
})
