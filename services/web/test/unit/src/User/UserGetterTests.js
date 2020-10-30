const { ObjectId } = require('mongodb')
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
const {
  normalizeQuery,
  normalizeMultiQuery
} = require('../../../../app/src/Features/Helpers/Mongo')

describe('UserGetter', function() {
  beforeEach(function() {
    this.fakeUser = {
      _id: '12390i',
      email: 'email2@foo.bar',
      emails: [
        {
          email: 'email1@foo.bar',
          reversedHostname: 'rab.oof',
          confirmedAt: new Date()
        },
        { email: 'email2@foo.bar', reversedHostname: 'rab.oof' }
      ]
    }
    this.findOne = sinon.stub().callsArgWith(2, null, this.fakeUser)
    this.findToArrayStub = sinon.stub().yields(null, [this.fakeUser])
    this.find = sinon.stub().returns({ toArray: this.findToArrayStub })
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

    this.UserGetter = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../Helpers/Mongo': { normalizeQuery, normalizeMultiQuery },
        'logger-sharelatex': {
          log() {}
        },
        '../../infrastructure/mongodb': this.Mongo,
        '@overleaf/metrics': {
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
    })
  })

  describe('getUser', function() {
    it('should get user', function(done) {
      const query = { _id: '000000000000000000000000' }
      const projection = { email: 1 }
      this.UserGetter.getUser(query, projection, (error, user) => {
        expect(error).to.not.exist
        this.findOne.called.should.equal(true)
        this.findOne.calledWith(query, { projection }).should.equal(true)
        user.should.deep.equal(this.fakeUser)
        done()
      })
    })

    it('should not allow null query', function(done) {
      this.UserGetter.getUser(null, {}, error => {
        error.should.exist
        error.message.should.equal('no query provided')
        done()
      })
    })
  })

  describe('getUsers', function() {
    it('should get users with array of userIds', function(done) {
      const query = [new ObjectId()]
      const projection = { email: 1 }
      this.UserGetter.getUsers(query, projection, (error, users) => {
        expect(error).to.not.exist
        this.find.should.have.been.calledWithMatch(
          { _id: { $in: query } },
          { projection }
        )
        users.should.deep.equal([this.fakeUser])
        done()
      })
    })

    it('should not allow null query', function(done) {
      this.UserGetter.getUser(null, {}, error => {
        error.should.exist
        error.message.should.equal('no query provided')
        done()
      })
    })
  })

  describe('getUserFullEmails', function() {
    it('should get user', function(done) {
      this.UserGetter.getUser = sinon
        .stub()
        .callsArgWith(2, null, this.fakeUser)
      const projection = { email: 1, emails: 1, samlIdentifiers: 1 }
      this.UserGetter.getUserFullEmails(
        this.fakeUser._id,
        (error, fullEmails) => {
          expect(error).to.not.exist
          this.UserGetter.getUser.called.should.equal(true)
          this.UserGetter.getUser
            .calledWith(this.fakeUser._id, projection)
            .should.equal(true)
          done()
        }
      )
    })

    it('should fetch emails data', function(done) {
      this.UserGetter.getUser = sinon
        .stub()
        .callsArgWith(2, null, this.fakeUser)
      this.UserGetter.getUserFullEmails(
        this.fakeUser._id,
        (error, fullEmails) => {
          expect(error).to.not.exist
          assert.deepEqual(fullEmails, [
            {
              email: 'email1@foo.bar',
              reversedHostname: 'rab.oof',
              confirmedAt: this.fakeUser.emails[0].confirmedAt,
              emailHasInstitutionLicence: false,
              default: false
            },
            {
              email: 'email2@foo.bar',
              reversedHostname: 'rab.oof',
              emailHasInstitutionLicence: false,
              default: true
            }
          ])
          done()
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
          licence: 'pro_plus',
          institution: {
            name: 'University Name',
            isUniversity: true,
            confirmed: true
          }
        }
      ]
      this.getUserAffiliations.callsArgWith(1, null, affiliationsData)
      this.UserGetter.getUserFullEmails(
        this.fakeUser._id,
        (error, fullEmails) => {
          expect(error).to.not.exist
          assert.deepEqual(fullEmails, [
            {
              email: 'email1@foo.bar',
              reversedHostname: 'rab.oof',
              confirmedAt: this.fakeUser.emails[0].confirmedAt,
              default: false,
              emailHasInstitutionLicence: true,
              affiliation: {
                institution: affiliationsData[0].institution,
                inferred: affiliationsData[0].inferred,
                department: affiliationsData[0].department,
                role: affiliationsData[0].role,
                licence: affiliationsData[0].licence
              }
            },
            {
              email: 'email2@foo.bar',
              reversedHostname: 'rab.oof',
              emailHasInstitutionLicence: false,
              default: true
            }
          ])
          done()
        }
      )
    })

    it('should merge SAML identifier', function(done) {
      const fakeSamlIdentifiers = [
        { providerId: 'saml_id', exteranlUserId: 'whatever' }
      ]
      const fakeUserWithSaml = this.fakeUser
      fakeUserWithSaml.emails[0].samlProviderId = 'saml_id'
      fakeUserWithSaml.samlIdentifiers = fakeSamlIdentifiers
      this.UserGetter.getUser = sinon.stub().yields(null, this.fakeUser)
      this.getUserAffiliations.callsArgWith(1, null, [])
      this.UserGetter.getUserFullEmails(
        this.fakeUser._id,
        (error, fullEmails) => {
          expect(error).to.not.exist
          assert.deepEqual(fullEmails, [
            {
              email: 'email1@foo.bar',
              reversedHostname: 'rab.oof',
              confirmedAt: this.fakeUser.emails[0].confirmedAt,
              default: false,
              emailHasInstitutionLicence: false,
              samlProviderId: 'saml_id',
              samlIdentifier: fakeSamlIdentifiers[0]
            },
            {
              email: 'email2@foo.bar',
              reversedHostname: 'rab.oof',
              emailHasInstitutionLicence: false,
              default: true
            }
          ])
          done()
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
      const projection = { email: 1, emails: 1, samlIdentifiers: 1 }
      this.UserGetter.getUserFullEmails(
        this.fakeUser._id,
        (error, fullEmails) => {
          expect(error).to.not.exist
          this.UserGetter.getUser.called.should.equal(true)
          this.UserGetter.getUser
            .calledWith(this.fakeUser._id, projection)
            .should.equal(true)
          assert.deepEqual(fullEmails, [])
          done()
        }
      )
    })
  })

  describe('getUserbyMainEmail', function() {
    it('query user by main email', function(done) {
      const email = 'hello@world.com'
      const projection = { emails: 1 }
      this.UserGetter.getUserByMainEmail(email, projection, (error, user) => {
        expect(error).to.not.exist
        this.findOne.called.should.equal(true)
        this.findOne.calledWith({ email }, { projection }).should.equal(true)
        done()
      })
    })

    it('return user if found', function(done) {
      const email = 'hello@world.com'
      this.UserGetter.getUserByMainEmail(email, (error, user) => {
        expect(error).to.not.exist
        user.should.deep.equal(this.fakeUser)
        done()
      })
    })

    it('trim email', function(done) {
      const email = 'hello@world.com'
      this.UserGetter.getUserByMainEmail(` ${email} `, (error, user) => {
        expect(error).to.not.exist
        this.findOne.called.should.equal(true)
        this.findOne.calledWith({ email }).should.equal(true)
        done()
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
      this.UserGetter.getUserByAnyEmail(
        ` ${email} `,
        projection,
        (error, user) => {
          expect(error).to.not.exist
          this.findOne
            .calledWith(expectedQuery, { projection })
            .should.equal(true)
          user.should.deep.equal(this.fakeUser)
          done()
        }
      )
    })

    it('query contains $exists:true so partial index is used', function(done) {
      const expectedQuery = {
        emails: { $exists: true },
        'emails.email': ''
      }
      this.UserGetter.getUserByAnyEmail('', {}, (error, user) => {
        expect(error).to.not.exist
        this.findOne
          .calledWith(expectedQuery, { projection: {} })
          .should.equal(true)
        done()
      })
    })

    it('checks main email as well', function(done) {
      this.findOne.callsArgWith(2, null, null)
      const email = 'hello@world.com'
      const projection = { emails: 1 }
      this.UserGetter.getUserByAnyEmail(
        ` ${email} `,
        projection,
        (error, user) => {
          expect(error).to.not.exist
          this.findOne.calledTwice.should.equal(true)
          this.findOne.calledWith({ email }, { projection }).should.equal(true)
          done()
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
      this.UserGetter.getUsersByHostname(
        hostname,
        projection,
        (error, users) => {
          expect(error).to.not.exist
          this.find.calledOnce.should.equal(true)
          this.find.calledWith(expectedQuery, { projection }).should.equal(true)
          done()
        }
      )
    })
  })

  describe('getUsersByAnyConfirmedEmail', function() {
    it('should find users by confirmed email', function(done) {
      const emails = ['confirmed@example.com']

      this.UserGetter.getUsersByAnyConfirmedEmail(emails, (error, users) => {
        expect(error).to.not.exist
        expect(this.find).to.be.calledOnceWith(
          {
            'emails.email': { $in: emails }, // use the index on emails.email
            emails: {
              $exists: true,
              $elemMatch: {
                email: { $in: emails },
                confirmedAt: { $exists: true }
              }
            }
          },
          { projection: {} }
        )
        done()
      })
    })
  })

  describe('getUsersByV1Id', function() {
    it('should find users by list of v1 ids', function(done) {
      const v1Ids = [501]
      const expectedQuery = {
        'overleaf.id': { $in: v1Ids }
      }
      const projection = { emails: 1 }
      this.UserGetter.getUsersByV1Ids(v1Ids, projection, (error, users) => {
        expect(error).to.not.exist
        this.find.calledOnce.should.equal(true)
        this.find.calledWith(expectedQuery, { projection }).should.equal(true)
        done()
      })
    })
  })

  describe('ensureUniqueEmailAddress', function() {
    beforeEach(function() {
      this.UserGetter.getUserByAnyEmail = sinon.stub()
    })

    it('should return error if existing user is found', function(done) {
      this.UserGetter.getUserByAnyEmail.callsArgWith(1, null, this.fakeUser)
      this.UserGetter.ensureUniqueEmailAddress(this.newEmail, err => {
        should.exist(err)
        expect(err).to.be.an.instanceof(Errors.EmailExistsError)
        done()
      })
    })

    it('should return null if no user is found', function(done) {
      this.UserGetter.getUserByAnyEmail.callsArgWith(1)
      this.UserGetter.ensureUniqueEmailAddress(this.newEmail, err => {
        should.not.exist(err)
        done()
      })
    })
  })
})
