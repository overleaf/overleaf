/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const chai = require('chai')
const { expect } = chai
const path = require('node:path')
const modulePath = path.join(__dirname, '../../../event_loop.js')
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')

describe('event_loop', function () {
  before(function () {
    this.metrics = {
      timing: sinon.stub(),
      registerDestructor: sinon.stub(),
    }
    this.logger = {
      warn: sinon.stub(),
    }
    return (this.event_loop = SandboxedModule.require(modulePath, {
      requires: {
        './index': this.metrics,
      },
    }))
  })

  describe('with a logger provided', function () {
    before(function () {
      return this.event_loop.monitor(this.logger)
    })

    return it('should register a destructor with metrics', function () {
      return expect(this.metrics.registerDestructor.called).to.equal(true)
    })
  })

  return describe('without a logger provided', function () {
    return it('should throw an exception', function () {
      return expect(this.event_loop.monitor).to.throw('logger is undefined')
    })
  })
})
