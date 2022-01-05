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
const SandboxedModule = require('sandboxed-module')
const assert = require('assert')
const { expect } = require('chai')
const path = require('path')
const sinon = require('sinon')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/Institutions/InstitutionsController'
)

describe('InstitutionsController', function () {
  beforeEach(function () {
    this.host = 'mit.edu'.split('').reverse().join('')
    this.stubbedUser1 = {
      _id: '3131231',
      name: 'bob',
      email: 'hello@world.com',
      emails: [
        { email: 'stubb1@mit.edu', reversedHostname: this.host },
        { email: 'test@test.com', reversedHostname: 'test.com' },
        { email: 'another@mit.edu', reversedHostname: this.host },
      ],
    }
    this.stubbedUser1DecoratedEmails = [
      {
        email: 'stubb1@mit.edu',
        reversedHostname: this.host,
        samlIdentifier: { hasEntitlement: false },
      },
      { email: 'test@test.com', reversedHostname: 'test.com' },
      {
        email: 'another@mit.edu',
        reversedHostname: this.host,
        samlIdentifier: { hasEntitlement: true },
      },
    ]
    this.stubbedUser2 = {
      _id: '3131232',
      name: 'test',
      email: 'hello2@world.com',
      emails: [{ email: 'subb2@mit.edu', reversedHostname: this.host }],
    }
    this.stubbedUser2DecoratedEmails = [
      {
        email: 'subb2@mit.edu',
        reversedHostname: this.host,
      },
    ]

    this.getInstitutionUsersByHostname = sinon.stub().yields(null, [
      {
        _id: this.stubbedUser1._id,
        emails: this.stubbedUser1DecoratedEmails,
      },
      {
        _id: this.stubbedUser2._id,
        emails: this.stubbedUser2DecoratedEmails,
      },
    ])
    this.addAffiliation = sinon.stub().callsArgWith(3, null)
    this.refreshFeatures = sinon.stub().yields(null)
    this.InstitutionsController = SandboxedModule.require(modulePath, {
      requires: {
        '../User/UserGetter': {
          getInstitutionUsersByHostname: this.getInstitutionUsersByHostname,
        },
        '../Institutions/InstitutionsAPI': {
          addAffiliation: this.addAffiliation,
        },
        '../Subscription/FeaturesUpdater': {
          refreshFeatures: this.refreshFeatures,
        },
      },
    })

    this.req = { body: { hostname: 'mit.edu' } }

    this.res = {
      send: sinon.stub(),
      json: sinon.stub(),
    }
    return (this.next = sinon.stub())
  })

  describe('affiliateUsers', function () {
    it('should add affiliations for matching users', function (done) {
      this.res.sendStatus = code => {
        code.should.equal(200)
        this.getInstitutionUsersByHostname.calledOnce.should.equal(true)
        this.addAffiliation.calledThrice.should.equal(true)
        this.addAffiliation
          .calledWithMatch(
            this.stubbedUser1._id,
            this.stubbedUser1.emails[0].email,
            { entitlement: false }
          )
          .should.equal(true)
        this.addAffiliation
          .calledWithMatch(
            this.stubbedUser1._id,
            this.stubbedUser1.emails[2].email,
            { entitlement: true }
          )
          .should.equal(true)
        this.addAffiliation
          .calledWithMatch(
            this.stubbedUser2._id,
            this.stubbedUser2.emails[0].email,
            { entitlement: undefined }
          )
          .should.equal(true)
        this.refreshFeatures
          .calledWith(this.stubbedUser1._id)
          .should.equal(true)
        this.refreshFeatures
          .calledWith(this.stubbedUser2._id)
          .should.equal(true)
        this.refreshFeatures.should.have.been.calledTwice
        return done()
      }
      this.next.callsFake(done)
      return this.InstitutionsController.confirmDomain(
        this.req,
        this.res,
        this.next
      )
    })

    it('should return errors if last affiliation cannot be added', function (done) {
      this.addAffiliation.onCall(2).callsArgWith(3, new Error('error'))
      this.next = error => {
        expect(error).to.exist
        this.getInstitutionUsersByHostname.calledOnce.should.equal(true)
        return done()
      }
      return this.InstitutionsController.confirmDomain(
        this.req,
        this.res,
        this.next
      )
    })
  })
})
