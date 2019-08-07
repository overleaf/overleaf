/* eslint-disable
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
const sinon = require('sinon')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/Security/OneTimeTokenHandler'
)
const { expect } = require('chai')
const Errors = require('../../../../app/src/Features/Errors/Errors')
const tk = require('timekeeper')

describe('OneTimeTokenHandler', function() {
  beforeEach(function() {
    tk.freeze(Date.now()) // freeze the time for these tests
    this.stubbedToken = 'mock-token'
    this.callback = sinon.stub()
    return (this.OneTimeTokenHandler = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'settings-sharelatex': this.settings,
        'logger-sharelatex': {
          log() {}
        },
        crypto: {
          randomBytes: () => this.stubbedToken
        },
        '../Errors/Errors': Errors,
        '../../infrastructure/mongojs': {
          db: (this.db = { tokens: {} })
        }
      }
    }))
  })

  afterEach(function() {
    return tk.reset()
  })

  describe('getNewToken', function() {
    beforeEach(function() {
      return (this.db.tokens.insert = sinon.stub().yields())
    })

    describe('normally', function() {
      beforeEach(function() {
        return this.OneTimeTokenHandler.getNewToken(
          'password',
          'mock-data-to-store',
          this.callback
        )
      })

      it('should insert a generated token with a 1 hour expiry', function() {
        return this.db.tokens.insert
          .calledWith({
            use: 'password',
            token: this.stubbedToken,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
            data: 'mock-data-to-store'
          })
          .should.equal(true)
      })

      it('should call the callback with the token', function() {
        return this.callback
          .calledWith(null, this.stubbedToken)
          .should.equal(true)
      })
    })

    describe('with an optional expiresIn parameter', function() {
      beforeEach(function() {
        return this.OneTimeTokenHandler.getNewToken(
          'password',
          'mock-data-to-store',
          { expiresIn: 42 },
          this.callback
        )
      })

      it('should insert a generated token with a custom expiry', function() {
        return this.db.tokens.insert
          .calledWith({
            use: 'password',
            token: this.stubbedToken,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 42 * 1000),
            data: 'mock-data-to-store'
          })
          .should.equal(true)
      })

      it('should call the callback with the token', function() {
        return this.callback
          .calledWith(null, this.stubbedToken)
          .should.equal(true)
      })
    })
  })

  describe('getValueFromTokenAndExpire', function() {
    describe('successfully', function() {
      beforeEach(function() {
        this.db.tokens.findAndModify = sinon
          .stub()
          .yields(null, { data: 'mock-data' })
        return this.OneTimeTokenHandler.getValueFromTokenAndExpire(
          'password',
          'mock-token',
          this.callback
        )
      })

      it('should expire the token', function() {
        return this.db.tokens.findAndModify
          .calledWith({
            query: {
              use: 'password',
              token: 'mock-token',
              expiresAt: { $gt: new Date() },
              usedAt: { $exists: false }
            },
            update: {
              $set: { usedAt: new Date() }
            }
          })
          .should.equal(true)
      })

      it('should return the data', function() {
        return this.callback.calledWith(null, 'mock-data').should.equal(true)
      })
    })

    describe('when a valid token is not found', function() {
      beforeEach(function() {
        this.db.tokens.findAndModify = sinon.stub().yields(null, null)
        return this.OneTimeTokenHandler.getValueFromTokenAndExpire(
          'password',
          'mock-token',
          this.callback
        )
      })

      it('should return a NotFoundError', function() {
        return this.callback
          .calledWith(sinon.match.instanceOf(Errors.NotFoundError))
          .should.equal(true)
      })
    })
  })
})
