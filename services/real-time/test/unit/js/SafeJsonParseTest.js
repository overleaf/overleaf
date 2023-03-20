/* eslint-disable
    no-return-assign,
    no-useless-escape,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { expect } = require('chai')
const SandboxedModule = require('sandboxed-module')
const modulePath = '../../../app/js/SafeJsonParse'

describe('SafeJsonParse', function () {
  beforeEach(function () {
    return (this.SafeJsonParse = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': (this.Settings = {
          maxUpdateSize: 16 * 1024,
        }),
      },
    }))
  })

  return describe('parse', function () {
    it('should parse documents correctly', function (done) {
      return this.SafeJsonParse.parse('{"foo": "bar"}', (error, parsed) => {
        if (error) return done(error)
        expect(parsed).to.deep.equal({ foo: 'bar' })
        return done()
      })
    })

    it('should return an error on bad data', function (done) {
      return this.SafeJsonParse.parse('blah', (error, parsed) => {
        expect(error).to.exist
        return done()
      })
    })

    return it('should return an error on oversized data', function (done) {
      // we have a 2k overhead on top of max size
      const bigBlob = Array(16 * 1024).join('A')
      const data = `{\"foo\": \"${bigBlob}\"}`
      this.Settings.maxUpdateSize = 2 * 1024
      return this.SafeJsonParse.parse(data, (error, parsed) => {
        this.logger.error.called.should.equal(false)
        expect(error).to.exist
        return done()
      })
    })
  })
})
