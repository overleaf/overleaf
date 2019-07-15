/* eslint-disable
    max-len,
    mocha/no-identical-title,
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
const sinon = require('sinon')
const chai = require('chai')
const should = chai.should()
const modulePath = '../../../../app/src/Features/Project/DocLinesComparitor.js'
const SandboxedModule = require('sandboxed-module')

describe('doc lines comparitor', function() {
  beforeEach(function() {
    return (this.comparitor = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'logger-sharelatex': { log() {} }
      }
    }))
  })

  it('should return true when the lines are the same', function() {
    const lines1 = ['hello', 'world']
    const lines2 = ['hello', 'world']
    const result = this.comparitor.areSame(lines1, lines2)
    return result.should.equal(true)
  })

  it('should return false when the lines are different', function() {
    const lines1 = ['hello', 'world']
    const lines2 = ['diff', 'world']
    const result = this.comparitor.areSame(lines1, lines2)
    return result.should.equal(false)
  })

  it('should return false when the lines are different', function() {
    const lines1 = ['hello', 'world']
    const lines2 = ['hello', 'wrld']
    const result = this.comparitor.areSame(lines1, lines2)
    return result.should.equal(false)
  })

  it('should return true when the lines are same', function() {
    const lines1 = ['hello', 'world']
    const lines2 = ['hello', 'world']
    const result = this.comparitor.areSame(lines1, lines2)
    return result.should.equal(true)
  })

  it('should return false if the doc lines are different in length', function() {
    const lines1 = ['hello', 'world']
    const lines2 = ['hello', 'world', 'please']
    const result = this.comparitor.areSame(lines1, lines2)
    return result.should.equal(false)
  })

  it('should return false if the first array is undefined', function() {
    const lines1 = undefined
    const lines2 = ['hello', 'world']
    const result = this.comparitor.areSame(lines1, lines2)
    return result.should.equal(false)
  })

  it('should return false if the second array is undefined', function() {
    const lines1 = ['hello']
    const lines2 = undefined
    const result = this.comparitor.areSame(lines1, lines2)
    return result.should.equal(false)
  })

  it('should return false if the second array is not an array', function() {
    const lines1 = ['hello']
    const lines2 = ''
    const result = this.comparitor.areSame(lines1, lines2)
    return result.should.equal(false)
  })

  it('should return true when comparing equal orchard docs', function() {
    const lines1 = [{ text: 'hello world' }]
    const lines2 = [{ text: 'hello world' }]
    const result = this.comparitor.areSame(lines1, lines2)
    return result.should.equal(true)
  })

  it('should return false when comparing different orchard docs', function() {
    const lines1 = [{ text: 'goodbye world' }]
    const lines2 = [{ text: 'hello world' }]
    const result = this.comparitor.areSame(lines1, lines2)
    return result.should.equal(false)
  })
})
