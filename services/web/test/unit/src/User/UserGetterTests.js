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
const { ObjectId } = require('mongojs')
const should = require('chai').should()
const SandboxedModule = require('sandboxed-module')
const assert = require('assert')
const path = require('path')
const sinon = require('sinon')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/User/UserGetter'
)
const { expect } = require('chai')
const Errors = require('../../../../app/src/Features/Errors/Errors')

describe('UserGetter', function() {
  beforeEach(function() {
    this.fakeUser = {
      _id: '12390i',
      email: 'email2@foo.bar',
      emails: [
        { email: 'email1@foo.bar', reversedHostname: 'rab.oof' },
        { email: 'email2@foo.bar', reversedHostname: 'rab.oof' }
      ]
    }
    this.findOne = sinon.stub().callsArgWith(2, null, this.fakeUser)
    this.find = sinon.stub().callsArgWith(2, null, [this.fakeUser])
    this.Mongo = {
      db: {
        users: {
          findOne: this.findOne,
          find: this.find
        }
      },
      ObjectId
    }
    const settings = { apis: { v1: { url: 'v1.url', user: '', pass: '' } } }
    this.getUserAffiliations = sinon.stub().callsArgWith(1, null, [])

    return (this.UserGetter = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'logger-sharelatex': {
          log() {}
        },
        '../../infrastructure/mongojs': this.Mongo,
        'metrics-sharelatex': {
          timeAsyncMethod: sinon.stub()
        },
        'settings-sharelatex': settings,
        '../Institutions/InstitutionsAPI': {
          getUserAffiliations: this.getUserAffiliations
        },
        '../../infrastructure/Features': {
          hasFeature: sinon.stub().returns(true)
        },
        '../Errors/Errors': Errors
      }
    }))
  })

  describe('getUser', function() {
    it('should get user', function(done) {
      const query = { _id: 'foo' }
      const projection = { email: 1 }
      return this.UserGetter.getUser(query, projection, (error, user) => {
        this.findOne.called.should.equal(true)
        this.findOne.calledWith(query, projection).should.equal(true)
        user.should.deep.equal(this.fakeUser)
        return done()
      })
    })

    it('should not allow null query', function(done) {
      return this.UserGetter.getUser(null, {}, (error, user) => {
        error.should.exist
        return done()
      })
    })
  })

  describe('getUserFullEmails', function() {
    it('should get user', function(done) {
      this.UserGetter.getUser = sinon
        .stub()
        .callsArgWith(2, null, this.fakeUser)
      const projection = { email: 1, emails: 1 }
      return this.UserGetter.getUserFullEmails(
        this.fakeUser._id,
        (error, fullEmails) => {
          this.UserGetter.getUser.called.should.equal(true)
          this.UserGetter.getUser
            .calledWith(this.fakeUser._id, projection)
            .should.equal(true)
          return done()
        }
      )
    })

    it('should fetch emails data', function(done) {
      this.UserGetter.getUser = sinon
        .stub()
        .callsArgWith(2, null, this.fakeUser)
      return this.UserGetter.getUserFullEmails(
        this.fakeUser._id,
        (error, fullEmails) => {
          assert.deepEqual(fullEmails, [
            {
              email: 'email1@foo.bar',
              reversedHostname: 'rab.oof',
              default: false
            },
            {
              email: 'email2@foo.bar',
              reversedHostname: 'rab.oof',
              default: true
            }
          ])
          return done()
        }
      )
    })

    it('should merge affiliation data', function(done) {
      this.UserGetter.getUser = sinon
        .stub()
        .callsArgWith(2, null, this.fakeUser)
      const affiliationsData = [
        {
          email: 'email1@foo.bar',
          role: 'Prof',
          department: 'Maths',
          inferred: false,
          institution: { name: 'University Name', isUniversity: true }
        }
      ]
      this.getUserAffiliations.callsArgWith(1, null, affiliationsData)
      return this.UserGetter.getUserFullEmails(
        this.fakeUser._id,
        (error, fullEmails) => {
          assert.deepEqual(fullEmails, [
            {
              email: 'email1@foo.bar',
              reversedHostname: 'rab.oof',
              default: false,
              affiliation: {
                institution: affiliationsData[0].institution,
                inferred: affiliationsData[0].inferred,
                department: affiliationsData[0].department,
                role: affiliationsData[0].role
              }
            },
            {
              email: 'email2@foo.bar',
              reversedHostname: 'rab.oof',
              default: true
            }
          ])
          return done()
        }
      )
    })

    it('should get user when it has no emails field', function(done) {
      this.fakeUser = {
        _id: '12390i',
        email: 'email2@foo.bar'
      }
      this.UserGetter.getUser = sinon
        .stub()
        .callsArgWith(2, null, this.fakeUser)
      const projection = { email: 1, emails: 1 }
      return this.UserGetter.getUserFullEmails(
        this.fakeUser._id,
        (error, fullEmails) => {
          this.UserGetter.getUser.called.should.equal(true)
          this.UserGetter.getUser
            .calledWith(this.fakeUser._id, projection)
            .should.equal(true)
          assert.deepEqual(fullEmails, [])
          return done()
        }
      )
    })
  })

  describe('getUserbyMainEmail', function() {
    it('query user by main email', function(done) {
      const email = 'hello@world.com'
      const projection = { emails: 1 }
      return this.UserGetter.getUserByMainEmail(
        email,
        projection,
        (error, user) => {
          this.findOne.called.should.equal(true)
          this.findOne.calledWith({ email }, projection).should.equal(true)
          return done()
        }
      )
    })

    it('return user if found', function(done) {
      const email = 'hello@world.com'
      return this.UserGetter.getUserByMainEmail(email, (error, user) => {
        user.should.deep.equal(this.fakeUser)
        return done()
      })
    })

    it('trim email', function(done) {
      const email = 'hello@world.com'
      return this.UserGetter.getUserByMainEmail(` ${email} `, (error, user) => {
        this.findOne.called.should.equal(true)
        this.findOne.calledWith({ email }).should.equal(true)
        return done()
      })
    })
  })

  describe('getUserByAnyEmail', function() {
    it('query user for any email', function(done) {
      const email = 'hello@world.com'
      const expectedQuery = {
        emails: { $exists: true },
        'emails.email': email
      }
      const projection = { emails: 1 }
      return this.UserGetter.getUserByAnyEmail(
        ` ${email} `,
        projection,
        (error, user) => {
          this.findOne.calledWith(expectedQuery, projection).should.equal(true)
          user.should.deep.equal(this.fakeUser)
          return done()
        }
      )
    })

    it('query contains $exists:true so partial index is used', function(done) {
      const expectedQuery = {
        emails: { $exists: true },
        'emails.email': ''
      }
      return this.UserGetter.getUserByAnyEmail('', {}, (error, user) => {
        this.findOne.calledWith(expectedQuery, {}).should.equal(true)
        return done()
      })
    })

    it('checks main email as well', function(done) {
      this.findOne.callsArgWith(2, null, null)
      const email = 'hello@world.com'
      const projection = { emails: 1 }
      return this.UserGetter.getUserByAnyEmail(
        ` ${email} `,
        projection,
        (error, user) => {
          this.findOne.calledTwice.should.equal(true)
          this.findOne.calledWith({ email }, projection).should.equal(true)
          return done()
        }
      )
    })
  })

  describe('getUsersByHostname', function() {
    it('should find user by hostname', function(done) {
      const hostname = 'bar.foo'
      const expectedQuery = {
        emails: { $exists: true },
        'emails.reversedHostname': hostname
          .split('')
          .reverse()
          .join('')
      }
      const projection = { emails: 1 }
      return this.UserGetter.getUsersByHostname(
        hostname,
        projection,
        (error, users) => {
          this.find.calledOnce.should.equal(true)
          this.find.calledWith(expectedQuery, projection).should.equal(true)
          return done()
        }
      )
    })
  })

  describe('getUsersByV1Id', function() {
    it('should find users by list of v1 ids', function(done) {
      const v1Ids = [501]
      const expectedQuery = {
        'overleaf.id': { $in: v1Ids }
      }
      const projection = { emails: 1 }
      return this.UserGetter.getUsersByV1Ids(
        v1Ids,
        projection,
        (error, users) => {
          this.find.calledOnce.should.equal(true)
          this.find.calledWith(expectedQuery, projection).should.equal(true)
          return done()
        }
      )
    })
  })

  describe('ensureUniqueEmailAddress', function() {
    beforeEach(function() {
      return (this.UserGetter.getUserByAnyEmail = sinon.stub())
    })

    it('should return error if existing user is found', function(done) {
      this.UserGetter.getUserByAnyEmail.callsArgWith(1, null, this.fakeUser)
      return this.UserGetter.ensureUniqueEmailAddress(this.newEmail, err => {
        should.exist(err)
        expect(err).to.be.an.instanceof(Errors.EmailExistsError)
        return done()
      })
    })

    it('should return null if no user is found', function(done) {
      this.UserGetter.getUserByAnyEmail.callsArgWith(1)
      return this.UserGetter.ensureUniqueEmailAddress(this.newEmail, err => {
        should.not.exist(err)
        return done()
      })
    })
  })
})
