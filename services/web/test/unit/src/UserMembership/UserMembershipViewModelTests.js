/* eslint-disable
    handle-callback-err,
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
const chai = require('chai')
const should = chai.should()
const { expect } = require('chai')
const sinon = require('sinon')
const assertCalledWith = sinon.assert.calledWith
const assertNotCalled = sinon.assert.notCalled
const mongojs = require('mongojs')
const { ObjectId } = mongojs
const modulePath =
  '../../../../app/src/Features/UserMembership/UserMembershipViewModel'
const SandboxedModule = require('sandboxed-module')

describe('UserMembershipViewModel', function() {
  beforeEach(function() {
    this.UserGetter = { getUserOrUserStubById: sinon.stub() }
    this.UserMembershipViewModel = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        mongojs: mongojs,
        '../User/UserGetter': this.UserGetter
      }
    })
    this.email = 'mock-email@bar.com'
    this.user = {
      _id: 'mock-user-id',
      email: 'mock-email@baz.com',
      first_name: 'Name'
    }
    return (this.userStub = {
      _id: 'mock-user-stub-id',
      email: 'mock-stub-email@baz.com'
    })
  })

  describe('build', function() {
    it('build email', function() {
      const viewModel = this.UserMembershipViewModel.build(this.email)
      return expect(viewModel).to.deep.equal({
        email: this.email,
        invite: true,
        first_name: null,
        last_name: null,
        _id: null
      })
    })

    it('build user', function() {
      const viewModel = this.UserMembershipViewModel.build(this.user)
      expect(viewModel._id).to.equal(this.user._id)
      expect(viewModel.email).to.equal(this.user.email)
      return expect(viewModel.invite).to.equal(false)
    })
  })

  describe('build async', function() {
    beforeEach(function() {
      return (this.UserMembershipViewModel.build = sinon.stub())
    })

    it('build email', function(done) {
      return this.UserMembershipViewModel.buildAsync(
        this.email,
        (error, viewModel) => {
          assertCalledWith(this.UserMembershipViewModel.build, this.email)
          return done()
        }
      )
    })

    it('build user', function(done) {
      return this.UserMembershipViewModel.buildAsync(
        this.user,
        (error, viewModel) => {
          assertCalledWith(this.UserMembershipViewModel.build, this.user)
          return done()
        }
      )
    })

    it('build user id', function(done) {
      this.UserGetter.getUserOrUserStubById.yields(null, this.user, false)
      return this.UserMembershipViewModel.buildAsync(
        ObjectId(),
        (error, viewModel) => {
          should.not.exist(error)
          assertNotCalled(this.UserMembershipViewModel.build)
          expect(viewModel._id).to.equal(this.user._id)
          expect(viewModel.email).to.equal(this.user.email)
          expect(viewModel.first_name).to.equal(this.user.first_name)
          expect(viewModel.invite).to.equal(false)
          should.exist(viewModel.email)
          return done()
        }
      )
    })

    it('build user stub id', function(done) {
      this.UserGetter.getUserOrUserStubById.yields(null, this.userStub, true)
      return this.UserMembershipViewModel.buildAsync(
        ObjectId(),
        (error, viewModel) => {
          should.not.exist(error)
          assertNotCalled(this.UserMembershipViewModel.build)
          expect(viewModel._id).to.equal(this.userStub._id)
          expect(viewModel.email).to.equal(this.userStub.email)
          expect(viewModel.invite).to.equal(true)
          return done()
        }
      )
    })

    it('build user id with error', function(done) {
      this.UserGetter.getUserOrUserStubById.yields(new Error('nope'))
      const userId = ObjectId()
      return this.UserMembershipViewModel.buildAsync(
        userId,
        (error, viewModel) => {
          should.not.exist(error)
          assertNotCalled(this.UserMembershipViewModel.build)
          expect(viewModel._id).to.equal(userId.toString())
          should.not.exist(viewModel.email)
          return done()
        }
      )
    })
  })
})
