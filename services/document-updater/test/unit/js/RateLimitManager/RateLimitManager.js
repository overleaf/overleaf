/* eslint-disable
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = '../../../../app/js/RateLimitManager.js'
const SandboxedModule = require('sandboxed-module')

describe('RateLimitManager', function () {
  beforeEach(function () {
    let Timer
    this.RateLimitManager = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': (this.settings = {}),
        './Metrics': (this.Metrics = {
          Timer: (Timer = (function () {
            Timer = class Timer {
              static initClass() {
                this.prototype.done = sinon.stub()
              }
            }
            Timer.initClass()
            return Timer
          })()),
          gauge: sinon.stub(),
        }),
      },
    })
    this.callback = sinon.stub()
    return (this.RateLimiter = new this.RateLimitManager(1))
  })

  describe('for a single task', function () {
    beforeEach(function () {
      this.task = sinon.stub()
      return this.RateLimiter.run(this.task, this.callback)
    })

    it('should execute the task in the background', function () {
      return this.task.called.should.equal(true)
    })

    it('should call the callback', function () {
      return this.callback.called.should.equal(true)
    })

    return it('should finish with a worker count of one', function () {
      // because it's in the background
      return expect(this.RateLimiter.ActiveWorkerCount).to.equal(1)
    })
  })

  describe('for multiple tasks', function () {
    beforeEach(function (done) {
      this.task = sinon.stub()
      this.finalTask = sinon.stub()
      const task = cb => {
        this.task()
        return setTimeout(cb, 100)
      }
      const finalTask = cb => {
        this.finalTask()
        return setTimeout(cb, 100)
      }
      this.RateLimiter.run(task, this.callback)
      this.RateLimiter.run(task, this.callback)
      this.RateLimiter.run(task, this.callback)
      return this.RateLimiter.run(finalTask, err => {
        this.callback(err)
        return done()
      })
    })

    it('should execute the first three tasks', function () {
      return this.task.calledThrice.should.equal(true)
    })

    it('should execute the final task', function () {
      return this.finalTask.called.should.equal(true)
    })

    it('should call the callback', function () {
      return this.callback.called.should.equal(true)
    })

    return it('should finish with worker count of zero', function () {
      return expect(this.RateLimiter.ActiveWorkerCount).to.equal(0)
    })
  })

  return describe('for a mixture of long-running tasks', function () {
    beforeEach(function (done) {
      this.task = sinon.stub()
      this.finalTask = sinon.stub()
      const finalTask = cb => {
        this.finalTask()
        return setTimeout(cb, 100)
      }
      this.RateLimiter.run(this.task, this.callback)
      this.RateLimiter.run(this.task, this.callback)
      this.RateLimiter.run(this.task, this.callback)
      return this.RateLimiter.run(finalTask, err => {
        this.callback(err)
        return done()
      })
    })

    it('should execute the first three tasks', function () {
      return this.task.calledThrice.should.equal(true)
    })

    it('should execute the final task', function () {
      return this.finalTask.called.should.equal(true)
    })

    it('should call the callback', function () {
      return this.callback.called.should.equal(true)
    })

    return it('should finish with worker count of three', function () {
      return expect(this.RateLimiter.ActiveWorkerCount).to.equal(3)
    })
  })
})
