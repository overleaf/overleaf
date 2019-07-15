/* eslint-disable
    handle-callback-err,
    max-len,
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
const should = require('chai').should()
const SandboxedModule = require('sandboxed-module')
const assert = require('assert')
const path = require('path')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/BetaProgram/BetaProgramHandler'
)
const sinon = require('sinon')
const { expect } = require('chai')

describe('BetaProgramHandler', function() {
  beforeEach(function() {
    this.user_id = 'some_id'
    this.user = {
      _id: this.user_id,
      email: 'user@example.com',
      features: {},
      betaProgram: false,
      save: sinon.stub().callsArgWith(0, null)
    }
    return (this.handler = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../../models/User': {
          User: {
            findById: sinon.stub().callsArgWith(1, null, this.user)
          }
        },
        'logger-sharelatex': (this.logger = {
          log: sinon.stub(),
          warn: sinon.stub(),
          err: sinon.stub()
        }),
        'metrics-sharelatex': (this.logger = {
          inc: sinon.stub()
        })
      }
    }))
  })

  describe('optIn', function() {
    beforeEach(function() {
      this.user.betaProgram = false
      return (this.call = callback => {
        return this.handler.optIn(this.user_id, callback)
      })
    })

    it('should set betaProgram = true on user object', function(done) {
      return this.call(err => {
        this.user.betaProgram.should.equal(true)
        return done()
      })
    })

    it('should call user.save', function(done) {
      return this.call(err => {
        this.user.save.callCount.should.equal(1)
        return done()
      })
    })

    it('should not produce an error', function(done) {
      return this.call(err => {
        expect(err).to.equal(null)
        expect(err).to.not.be.instanceof(Error)
        return done()
      })
    })

    describe('when user.save produces an error', function() {
      beforeEach(function() {
        return this.user.save.callsArgWith(0, new Error('woops'))
      })

      it('should produce an error', function(done) {
        return this.call(err => {
          expect(err).to.not.equal(null)
          expect(err).to.be.instanceof(Error)
          return done()
        })
      })
    })
  })

  describe('optOut', function() {
    beforeEach(function() {
      this.user.betaProgram = true
      return (this.call = callback => {
        return this.handler.optOut(this.user_id, callback)
      })
    })

    it('should set betaProgram = true on user object', function(done) {
      return this.call(err => {
        this.user.betaProgram.should.equal(false)
        return done()
      })
    })

    it('should call user.save', function(done) {
      return this.call(err => {
        this.user.save.callCount.should.equal(1)
        return done()
      })
    })

    it('should not produce an error', function(done) {
      return this.call(err => {
        expect(err).to.equal(null)
        expect(err).to.not.be.instanceof(Error)
        return done()
      })
    })

    describe('when user.save produces an error', function() {
      beforeEach(function() {
        return this.user.save.callsArgWith(0, new Error('woops'))
      })

      it('should produce an error', function(done) {
        return this.call(err => {
          expect(err).to.not.equal(null)
          expect(err).to.be.instanceof(Error)
          return done()
        })
      })
    })
  })
})
