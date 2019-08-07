/* eslint-disable
    handle-callback-err,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Errors = require('../../../app/src/Features/Errors/Errors')
const Settings = require('settings-sharelatex')
const User = require('./helpers/User')
const ThirdPartyIdentityManager = require('../../../app/src/Features/User/ThirdPartyIdentityManager')
const chai = require('chai')

const { expect } = chai

describe('ThirdPartyIdentityManager', function() {
  beforeEach(function(done) {
    this.provider = 'provider'
    this.externalUserId = 'external-user-id'
    this.externalData = { test: 'data' }
    this.user = new User()
    this.user.ensureUserExists(done)
  })

  afterEach(function(done) {
    return this.user.full_delete_user(this.user.email, done)
  })

  describe('login', function() {
    describe('when third party identity exists', function() {
      beforeEach(function(done) {
        return ThirdPartyIdentityManager.link(
          this.user.id,
          this.provider,
          this.externalUserId,
          this.externalData,
          done
        )
      })

      it('should return user', function(done) {
        ThirdPartyIdentityManager.login(
          this.provider,
          this.externalUserId,
          this.externalData,
          (err, user) => {
            expect(err).to.be.null
            expect(user._id.toString()).to.equal(this.user.id)
            return done()
          }
        )
      })

      it('should merge external data', function(done) {
        this.externalData = {
          test: 'different',
          another: 'key'
        }
        ThirdPartyIdentityManager.login(
          this.provider,
          this.externalUserId,
          this.externalData,
          (err, user) => {
            expect(err).to.be.null
            expect(user.thirdPartyIdentifiers[0].externalData).to.deep.equal(
              this.externalData
            )
            return done()
          }
        )
      })
    })

    describe('when third party identity does not exists', function() {
      it('should return error', function(done) {
        ThirdPartyIdentityManager.login(
          this.provider,
          this.externalUserId,
          this.externalData,
          (err, user) => {
            expect(err.name).to.equal('ThirdPartyUserNotFoundError')
            return done()
          }
        )
      })
    })
  })

  describe('link', function() {
    describe('when provider not already linked', function() {
      it('should link provider to user', function(done) {
        ThirdPartyIdentityManager.link(
          this.user.id,
          this.provider,
          this.externalUserId,
          this.externalData,
          (err, res) => {
            expect(res.thirdPartyIdentifiers.length).to.equal(1)
            return done()
          }
        )
      })
    })

    describe('when provider is already linked', function() {
      beforeEach(function(done) {
        ThirdPartyIdentityManager.link(
          this.user.id,
          this.provider,
          this.externalUserId,
          this.externalData,
          done
        )
      })

      it('should link provider to user', function(done) {
        ThirdPartyIdentityManager.link(
          this.user.id,
          this.provider,
          this.externalUserId,
          this.externalData,
          (err, res) => {
            expect(res).to.exist
            done()
          }
        )
      })

      it('should not create duplicate thirdPartyIdentifiers', function(done) {
        ThirdPartyIdentityManager.link(
          this.user.id,
          this.provider,
          this.externalUserId,
          this.externalData,
          (err, user) => {
            expect(user.thirdPartyIdentifiers.length).to.equal(1)
            return done()
          }
        )
      })

      it('should replace existing data', function(done) {
        this.externalData = { replace: 'data' }
        return ThirdPartyIdentityManager.link(
          this.user.id,
          this.provider,
          this.externalUserId,
          this.externalData,
          (err, user) => {
            expect(user.thirdPartyIdentifiers.length).to.equal(1)
            return done()
          }
        )
      })

      // describe('when another account tries to link same provider/externalUserId', function() {
      // NOTE: Cannot run this test because we do not have indexes on the test DB
      //   beforeEach(function(done) {
      //     this.user2 = new User()
      //     this.user2.ensureUserExists(done)
      //   })
      //   it('should not link provider', function(done) {
      //     ThirdPartyIdentityManager.link(
      //       this.user2.id,
      //       this.provider,
      //       this.externalUserId,
      //       this.externalData,
      //       (err, user) => {
      //         expect(err.name).to.equal('ThirdPartyIdentityExistsError')
      //         return done()
      //       }
      //     )
      //     this.user2.full_delete_user(this.user2.email, done)
      //   })
      // })
    })
  })

  describe('unlink', function() {
    describe('when provider not already linked', function() {
      it('should succeed', function(done) {
        return ThirdPartyIdentityManager.unlink(
          this.user.id,
          this.provider,
          (err, res) => {
            expect(err).to.be.null
            expect(res.thirdPartyIdentifiers.length).to.equal(0)
            return done()
          }
        )
      })
    })

    describe('when provider is already linked', function() {
      beforeEach(function(done) {
        return ThirdPartyIdentityManager.link(
          this.user.id,
          this.provider,
          this.externalUserId,
          this.externalData,
          done
        )
      })

      it('should remove thirdPartyIdentifiers entry', function(done) {
        return ThirdPartyIdentityManager.unlink(
          this.user.id,
          this.provider,
          (err, user) => {
            expect(user.thirdPartyIdentifiers.length).to.equal(0)
            return done()
          }
        )
      })
    })
  })
})
