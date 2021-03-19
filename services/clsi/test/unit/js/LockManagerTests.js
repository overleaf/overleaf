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
const sinon = require('sinon')
const modulePath = require('path').join(
  __dirname,
  '../../../app/js/LockManager'
)
const Path = require('path')
const Errors = require('../../../app/js/Errors')

describe('DockerLockManager', function () {
  beforeEach(function () {
    this.LockManager = SandboxedModule.require(modulePath, {
      requires: {
        'settings-sharelatex': {},
        fs: {
          lstat: sinon.stub().callsArgWith(1),
          readdir: sinon.stub().callsArgWith(1)
        },
        lockfile: (this.Lockfile = {})
      }
    })
    return (this.lockFile = '/local/compile/directory/.project-lock')
  })

  return describe('runWithLock', function () {
    beforeEach(function () {
      this.runner = sinon.stub().callsArgWith(0, null, 'foo', 'bar')
      return (this.callback = sinon.stub())
    })

    describe('normally', function () {
      beforeEach(function () {
        this.Lockfile.lock = sinon.stub().callsArgWith(2, null)
        this.Lockfile.unlock = sinon.stub().callsArgWith(1, null)
        return this.LockManager.runWithLock(
          this.lockFile,
          this.runner,
          this.callback
        )
      })

      it('should run the compile', function () {
        return this.runner.calledWith().should.equal(true)
      })

      return it('should call the callback with the response from the compile', function () {
        return this.callback
          .calledWithExactly(null, 'foo', 'bar')
          .should.equal(true)
      })
    })

    return describe('when the project is locked', function () {
      beforeEach(function () {
        this.error = new Error()
        this.error.code = 'EEXIST'
        this.Lockfile.lock = sinon.stub().callsArgWith(2, this.error)
        this.Lockfile.unlock = sinon.stub().callsArgWith(1, null)
        return this.LockManager.runWithLock(
          this.lockFile,
          this.runner,
          this.callback
        )
      })

      it('should not run the compile', function () {
        return this.runner.called.should.equal(false)
      })

      it('should return an error', function () {
        this.callback
          .calledWithExactly(sinon.match(Errors.AlreadyCompilingError))
          .should.equal(true)
      })
    })
  })
})
