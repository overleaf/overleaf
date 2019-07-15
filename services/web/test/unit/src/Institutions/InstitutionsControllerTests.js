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
  '../../../../app/src/Features/Institutions/InstitutionsController'
)
const { expect } = require('chai')

describe('InstitutionsController', function() {
  beforeEach(function() {
    this.logger = { err: sinon.stub(), warn: sinon.stub(), log() {} }
    this.host = 'mit.edu'
      .split('')
      .reverse()
      .join('')
    this.stubbedUser1 = {
      _id: '3131231',
      name: 'bob',
      email: 'hello@world.com',
      emails: [
        { email: 'stubb1@mit.edu', reversedHostname: this.host },
        { email: 'test@test.com', reversedHostname: 'test.com' },
        { email: 'another@mit.edu', reversedHostname: this.host }
      ]
    }
    this.stubbedUser2 = {
      _id: '3131232',
      name: 'test',
      email: 'hello2@world.com',
      emails: [{ email: 'subb2@mit.edu', reversedHostname: this.host }]
    }

    this.getUsersByHostname = sinon
      .stub()
      .callsArgWith(2, null, [this.stubbedUser1, this.stubbedUser2])
    this.addAffiliation = sinon.stub().callsArgWith(3, null)
    this.refreshFeatures = sinon.stub().yields(null)
    this.InstitutionsController = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'logger-sharelatex': this.logger,
        '../User/UserGetter': {
          getUsersByHostname: this.getUsersByHostname
        },
        '../Institutions/InstitutionsAPI': {
          addAffiliation: this.addAffiliation
        },
        '../Subscription/FeaturesUpdater': {
          refreshFeatures: this.refreshFeatures
        }
      }
    })

    this.req = { body: { hostname: 'mit.edu' } }

    this.res = {
      send: sinon.stub(),
      json: sinon.stub()
    }
    return (this.next = sinon.stub())
  })

  describe('affiliateUsers', function() {
    it('should add affiliations for matching users', function(done) {
      this.res.sendStatus = code => {
        code.should.equal(200)
        this.getUsersByHostname.calledOnce.should.equal(true)
        this.addAffiliation.calledThrice.should.equal(true)
        this.addAffiliation
          .calledWith(this.stubbedUser1._id, this.stubbedUser1.emails[0].email)
          .should.equal(true)
        this.addAffiliation
          .calledWith(this.stubbedUser1._id, this.stubbedUser1.emails[2].email)
          .should.equal(true)
        this.addAffiliation
          .calledWith(this.stubbedUser2._id, this.stubbedUser2.emails[0].email)
          .should.equal(true)
        this.refreshFeatures
          .calledWith(this.stubbedUser1._id)
          .should.equal(true)
        this.refreshFeatures
          .calledWith(this.stubbedUser2._id)
          .should.equal(true)
        return done()
      }
      return this.InstitutionsController.confirmDomain(
        this.req,
        this.res,
        this.next
      )
    })

    it('should return errors if last affiliation cannot be added', function(done) {
      this.addAffiliation.onCall(2).callsArgWith(3, new Error('error'))
      this.next = error => {
        expect(error).to.exist
        this.getUsersByHostname.calledOnce.should.equal(true)
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
