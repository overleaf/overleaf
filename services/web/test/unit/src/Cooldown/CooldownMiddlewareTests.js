/* eslint-disable
    max-len,
    no-return-assign,
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
require('chai').should()
const { expect } = require('chai')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Cooldown/CooldownMiddleware'
)

describe('CooldownMiddleware', function() {
  beforeEach(function() {
    this.CooldownManager = { isProjectOnCooldown: sinon.stub() }
    return (this.CooldownMiddleware = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        './CooldownManager': this.CooldownManager,
        'logger-sharelatex': { log: sinon.stub() }
      }
    }))
  })

  describe('freezeProject', function() {
    describe('when project is on cooldown', function() {
      beforeEach(function() {
        this.CooldownManager.isProjectOnCooldown = sinon
          .stub()
          .callsArgWith(1, null, true)
        this.req = { params: { Project_id: 'abc' } }
        this.res = { sendStatus: sinon.stub() }
        return (this.next = sinon.stub())
      })

      it('should call CooldownManager.isProjectOnCooldown', function() {
        this.CooldownMiddleware.freezeProject(this.req, this.res, this.next)
        this.CooldownManager.isProjectOnCooldown.callCount.should.equal(1)
        return this.CooldownManager.isProjectOnCooldown
          .calledWith('abc')
          .should.equal(true)
      })

      it('should not produce an error', function() {
        this.CooldownMiddleware.freezeProject(this.req, this.res, this.next)
        return this.next.callCount.should.equal(0)
      })

      it('should send a 429 status', function() {
        this.CooldownMiddleware.freezeProject(this.req, this.res, this.next)
        this.res.sendStatus.callCount.should.equal(1)
        return this.res.sendStatus.calledWith(429).should.equal(true)
      })
    })

    describe('when project is not on cooldown', function() {
      beforeEach(function() {
        this.CooldownManager.isProjectOnCooldown = sinon
          .stub()
          .callsArgWith(1, null, false)
        this.req = { params: { Project_id: 'abc' } }
        this.res = { sendStatus: sinon.stub() }
        return (this.next = sinon.stub())
      })

      it('should call CooldownManager.isProjectOnCooldown', function() {
        this.CooldownMiddleware.freezeProject(this.req, this.res, this.next)
        this.CooldownManager.isProjectOnCooldown.callCount.should.equal(1)
        return this.CooldownManager.isProjectOnCooldown
          .calledWith('abc')
          .should.equal(true)
      })

      it('call next with no arguments', function() {
        this.CooldownMiddleware.freezeProject(this.req, this.res, this.next)
        this.next.callCount.should.equal(1)
        return expect(this.next.lastCall.args.length).to.equal(0)
      })
    })

    describe('when isProjectOnCooldown produces an error', function() {
      beforeEach(function() {
        this.CooldownManager.isProjectOnCooldown = sinon
          .stub()
          .callsArgWith(1, new Error('woops'))
        this.req = { params: { Project_id: 'abc' } }
        this.res = { sendStatus: sinon.stub() }
        return (this.next = sinon.stub())
      })

      it('should call CooldownManager.isProjectOnCooldown', function() {
        this.CooldownMiddleware.freezeProject(this.req, this.res, this.next)
        this.CooldownManager.isProjectOnCooldown.callCount.should.equal(1)
        return this.CooldownManager.isProjectOnCooldown
          .calledWith('abc')
          .should.equal(true)
      })

      it('call next with an error', function() {
        this.CooldownMiddleware.freezeProject(this.req, this.res, this.next)
        this.next.callCount.should.equal(1)
        return expect(this.next.lastCall.args[0]).to.be.instanceof(Error)
      })
    })

    describe('when projectId is not part of route', function() {
      beforeEach(function() {
        this.CooldownManager.isProjectOnCooldown = sinon
          .stub()
          .callsArgWith(1, null, true)
        this.req = { params: { lol: 'abc' } }
        this.res = { sendStatus: sinon.stub() }
        return (this.next = sinon.stub())
      })

      it('call next with an error', function() {
        this.CooldownMiddleware.freezeProject(this.req, this.res, this.next)
        this.next.callCount.should.equal(1)
        return expect(this.next.lastCall.args[0]).to.be.instanceof(Error)
      })

      it('should not call CooldownManager.isProjectOnCooldown', function() {
        this.CooldownMiddleware.freezeProject(this.req, this.res, this.next)
        return this.CooldownManager.isProjectOnCooldown.callCount.should.equal(
          0
        )
      })
    })
  })
})
