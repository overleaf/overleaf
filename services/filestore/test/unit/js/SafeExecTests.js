const chai = require('chai')
const should = chai.should()
const { expect } = chai
const modulePath = '../../../app/js/SafeExec'
const { Errors } = require('@overleaf/object-persistor')
const SandboxedModule = require('sandboxed-module')

describe('SafeExec', function () {
  let settings, options, safeExec

  beforeEach(function () {
    settings = { enableConversions: true }
    options = { timeout: 10 * 1000, killSignal: 'SIGTERM' }

    const ObjectPersistor = { Errors }

    safeExec = SandboxedModule.require(modulePath, {
      globals: { process },
      requires: {
        '@overleaf/settings': settings,
        '@overleaf/object-persistor': ObjectPersistor,
      },
    })
  })

  describe('safeExec', function () {
    it('should execute a valid command', function (done) {
      safeExec(['/bin/echo', 'hello'], options, (err, stdout, stderr) => {
        stdout.should.equal('hello\n')
        stderr.should.equal('')
        should.not.exist(err)
        done()
      })
    })

    it('should error when conversions are disabled', function (done) {
      settings.enableConversions = false
      safeExec(['/bin/echo', 'hello'], options, err => {
        expect(err).to.exist
        done()
      })
    })

    it('should execute a command with non-zero exit status', function (done) {
      safeExec(['/usr/bin/env', 'false'], options, err => {
        expect(err).to.exist
        expect(err.name).to.equal('FailedCommandError')
        expect(err.code).to.equal(1)
        expect(err.stdout).to.equal('')
        expect(err.stderr).to.equal('')
        done()
      })
    })

    it('should handle an invalid command', function (done) {
      safeExec(['/bin/foobar'], options, err => {
        err.code.should.equal('ENOENT')
        done()
      })
    })

    it('should handle a command that runs too long', function (done) {
      safeExec(
        ['/bin/sleep', '10'],
        { timeout: 500, killSignal: 'SIGTERM' },
        err => {
          expect(err).to.exist
          expect(err.name).to.equal('FailedCommandError')
          expect(err.code).to.equal('SIGTERM')
          done()
        }
      )
    })
  })

  describe('as a promise', function () {
    beforeEach(function () {
      safeExec = safeExec.promises
    })

    it('should execute a valid command', async function () {
      const { stdout, stderr } = await safeExec(['/bin/echo', 'hello'], options)

      stdout.should.equal('hello\n')
      stderr.should.equal('')
    })

    it('should throw a ConversionsDisabledError when appropriate', async function () {
      settings.enableConversions = false
      try {
        await safeExec(['/bin/echo', 'hello'], options)
      } catch (err) {
        expect(err.name).to.equal('ConversionsDisabledError')
        return
      }
      expect('method did not throw an error').not.to.exist
    })

    it('should throw a FailedCommandError when appropriate', async function () {
      try {
        await safeExec(['/usr/bin/env', 'false'], options)
      } catch (err) {
        expect(err.name).to.equal('FailedCommandError')
        expect(err.code).to.equal(1)
        return
      }
      expect('method did not throw an error').not.to.exist
    })
  })
})
