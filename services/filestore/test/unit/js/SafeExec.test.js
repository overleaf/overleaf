import { beforeEach, chai, describe, expect, it, vi } from 'vitest'

const should = chai.should()
const modulePath = '../../../app/js/SafeExec.js'

describe('SafeExec', function () {
  let settings, options, safeExec

  beforeEach(async function () {
    settings = { enableConversions: true }
    options = { timeout: 10 * 1000, killSignal: 'SIGTERM' }

    vi.doMock('@overleaf/settings', () => ({
      default: settings,
    }))

    safeExec = (await import(modulePath)).default
  })

  describe('safeExec', function () {
    it('should execute a valid command', async function () {
      await new Promise(resolve => {
        safeExec(['/bin/echo', 'hello'], options, (err, stdout, stderr) => {
          stdout.should.equal('hello\n')
          stderr.should.equal('')
          should.not.exist(err)
          resolve()
        })
      })
    })

    it('should error when conversions are disabled', async function () {
      await new Promise(resolve => {
        settings.enableConversions = false
        safeExec(['/bin/echo', 'hello'], options, err => {
          expect(err).to.exist
          resolve()
        })
      })
    })

    it('should execute a command with non-zero exit status', async function () {
      await new Promise(resolve => {
        safeExec(['/usr/bin/env', 'false'], options, err => {
          expect(err).to.exist
          expect(err.name).to.equal('FailedCommandError')
          expect(err.code).to.equal(1)
          expect(err.stdout).to.equal('')
          expect(err.stderr).to.equal('')
          resolve()
        })
      })
    })

    it('should handle an invalid command', async function () {
      await new Promise(resolve => {
        safeExec(['/bin/foobar'], options, err => {
          err.code.should.equal('ENOENT')
          resolve()
        })
      })
    })

    it('should handle a command that runs too long', async function () {
      await new Promise(resolve => {
        safeExec(
          ['/bin/sleep', '10'],
          { timeout: 500, killSignal: 'SIGTERM' },
          err => {
            expect(err).to.exist
            expect(err.name).to.equal('FailedCommandError')
            expect(err.code).to.equal('SIGTERM')
            resolve()
          }
        )
      })
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
