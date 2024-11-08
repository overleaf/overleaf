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
const SandboxedModule = require('sandboxed-module')
const assert = require('node:assert')
const path = require('node:path')
const sinon = require('sinon')
const modulePath = path.join(
  __dirname,
  '../../../app/js/StaticServerForbidSymlinks'
)
const { expect } = require('chai')

describe('StaticServerForbidSymlinks', function () {
  beforeEach(function () {
    this.settings = {
      path: {
        compilesDir: '/compiles/here',
      },
    }

    this.fs = {}
    this.ForbidSymlinks = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': this.settings,
        fs: this.fs,
      },
    })

    this.dummyStatic = (rootDir, options) => (req, res, next) =>
      // console.log "dummyStatic serving file", rootDir, "called with", req.url
      // serve it
      next()

    this.StaticServerForbidSymlinks = this.ForbidSymlinks(
      this.dummyStatic,
      this.settings.path.compilesDir
    )
    this.req = {
      params: {
        project_id: '12345',
      },
    }

    this.res = {}
    return (this.req.url = '/12345/output.pdf')
  })

  describe('sending a normal file through', function () {
    beforeEach(function () {
      return (this.fs.realpath = sinon
        .stub()
        .callsArgWith(
          1,
          null,
          `${this.settings.path.compilesDir}/${this.req.params.project_id}/output.pdf`
        ))
    })

    return it('should call next', function (done) {
      this.res.sendStatus = function (resCode) {
        resCode.should.equal(200)
        return done()
      }
      return this.StaticServerForbidSymlinks(this.req, this.res, done)
    })
  })

  describe('with a missing file', function () {
    beforeEach(function () {
      return (this.fs.realpath = sinon
        .stub()
        .callsArgWith(
          1,
          { code: 'ENOENT' },
          `${this.settings.path.compilesDir}/${this.req.params.project_id}/unknown.pdf`
        ))
    })

    return it('should send a 404', function (done) {
      this.res.sendStatus = function (resCode) {
        resCode.should.equal(404)
        return done()
      }
      return this.StaticServerForbidSymlinks(this.req, this.res)
    })
  })

  describe('with a new line', function () {
    beforeEach(function () {
      this.req.url = '/12345/output.pdf\nother file'
      this.fs.realpath = sinon.stub().yields()
    })

    it('should process the correct file', function (done) {
      this.res.sendStatus = () => {
        this.fs.realpath.should.have.been.calledWith(
          `${this.settings.path.compilesDir}/12345/output.pdf\nother file`
        )
        done()
      }
      this.StaticServerForbidSymlinks(this.req, this.res)
    })
  })

  describe('with a symlink file', function () {
    beforeEach(function () {
      return (this.fs.realpath = sinon
        .stub()
        .callsArgWith(1, null, `/etc/${this.req.params.project_id}/output.pdf`))
    })

    return it('should send a 404', function (done) {
      this.res.sendStatus = function (resCode) {
        resCode.should.equal(404)
        return done()
      }
      return this.StaticServerForbidSymlinks(this.req, this.res)
    })
  })

  describe('with a relative file', function () {
    beforeEach(function () {
      return (this.req.url = '/12345/../67890/output.pdf')
    })

    return it('should send a 404', function (done) {
      this.res.sendStatus = function (resCode) {
        resCode.should.equal(404)
        return done()
      }
      return this.StaticServerForbidSymlinks(this.req, this.res)
    })
  })

  describe('with a unnormalized file containing .', function () {
    beforeEach(function () {
      return (this.req.url = '/12345/foo/./output.pdf')
    })

    return it('should send a 404', function (done) {
      this.res.sendStatus = function (resCode) {
        resCode.should.equal(404)
        return done()
      }
      return this.StaticServerForbidSymlinks(this.req, this.res)
    })
  })

  describe('with a file containing an empty path', function () {
    beforeEach(function () {
      return (this.req.url = '/12345/foo//output.pdf')
    })

    return it('should send a 404', function (done) {
      this.res.sendStatus = function (resCode) {
        resCode.should.equal(404)
        return done()
      }
      return this.StaticServerForbidSymlinks(this.req, this.res)
    })
  })

  describe('with a non-project file', function () {
    beforeEach(function () {
      return (this.req.url = '/.foo/output.pdf')
    })

    return it('should send a 404', function (done) {
      this.res.sendStatus = function (resCode) {
        resCode.should.equal(404)
        return done()
      }
      return this.StaticServerForbidSymlinks(this.req, this.res)
    })
  })

  describe('with a file outside the compiledir', function () {
    beforeEach(function () {
      return (this.req.url = '/../bar/output.pdf')
    })

    return it('should send a 404', function (done) {
      this.res.sendStatus = function (resCode) {
        resCode.should.equal(404)
        return done()
      }
      return this.StaticServerForbidSymlinks(this.req, this.res)
    })
  })

  describe('with a file with no leading /', function () {
    beforeEach(function () {
      return (this.req.url = './../bar/output.pdf')
    })

    return it('should send a 404', function (done) {
      this.res.sendStatus = function (resCode) {
        resCode.should.equal(404)
        return done()
      }
      return this.StaticServerForbidSymlinks(this.req, this.res)
    })
  })

  describe('with a github style path', function () {
    beforeEach(function () {
      this.req.url = '/henryoswald-latex_example/output/output.log'
      return (this.fs.realpath = sinon
        .stub()
        .callsArgWith(
          1,
          null,
          `${this.settings.path.compilesDir}/henryoswald-latex_example/output/output.log`
        ))
    })

    return it('should call next', function (done) {
      this.res.sendStatus = function (resCode) {
        resCode.should.equal(200)
        return done()
      }
      return this.StaticServerForbidSymlinks(this.req, this.res, done)
    })
  })

  return describe('with an error from fs.realpath', function () {
    beforeEach(function () {
      return (this.fs.realpath = sinon.stub().callsArgWith(1, 'error'))
    })

    return it('should send a 500', function (done) {
      this.res.sendStatus = function (resCode) {
        resCode.should.equal(500)
        return done()
      }
      return this.StaticServerForbidSymlinks(this.req, this.res)
    })
  })
})
