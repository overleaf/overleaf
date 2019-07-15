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
const sinon = require('sinon')
const chai = require('chai')
const assert = require('assert')
const should = chai.should()
const modulePath = '../../../../app/src/Features/User/UserCreator.js'
const SandboxedModule = require('sandboxed-module')

describe('UserCreator', function() {
  beforeEach(function() {
    let Project
    const self = this
    this.user = { _id: '12390i', ace: {} }
    this.user.save = sinon.stub().callsArgWith(0)
    this.UserModel = Project = class Project {
      constructor() {
        return self.user
      }
    }

    this.UserGetter = { getUserByMainEmail: sinon.stub() }
    this.addAffiliation = sinon.stub().yields()
    this.UserCreator = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../../models/User': {
          User: this.UserModel
        },
        'logger-sharelatex': { log: sinon.stub(), err: sinon.stub() },
        'metrics-sharelatex': { timeAsyncMethod() {} },
        '../Institutions/InstitutionsAPI': {
          addAffiliation: this.addAffiliation
        }
      }
    })

    return (this.email = 'bob.oswald@gmail.com')
  })

  describe('createNewUser', function() {
    it('should take the opts and put them in the model', function(done) {
      const opts = {
        email: this.email,
        holdingAccount: true
      }
      return this.UserCreator.createNewUser(opts, (err, user) => {
        assert.equal(user.email, this.email)
        assert.equal(user.holdingAccount, true)
        assert.equal(user.first_name, 'bob.oswald')
        return done()
      })
    })

    it('should use the start of the email if the first name is empty string', function(done) {
      const opts = {
        email: this.email,
        holdingAccount: true,
        first_name: ''
      }
      return this.UserCreator.createNewUser(opts, (err, user) => {
        assert.equal(user.email, this.email)
        assert.equal(user.holdingAccount, true)
        assert.equal(user.first_name, 'bob.oswald')
        return done()
      })
    })

    it('should use the first name if passed', function(done) {
      const opts = {
        email: this.email,
        holdingAccount: true,
        first_name: 'fiiirstname'
      }
      return this.UserCreator.createNewUser(opts, (err, user) => {
        assert.equal(user.email, this.email)
        assert.equal(user.holdingAccount, true)
        assert.equal(user.first_name, 'fiiirstname')
        return done()
      })
    })

    it('should use the last name if passed', function(done) {
      const opts = {
        email: this.email,
        holdingAccount: true,
        last_name: 'lastNammmmeee'
      }
      return this.UserCreator.createNewUser(opts, (err, user) => {
        assert.equal(user.email, this.email)
        assert.equal(user.holdingAccount, true)
        assert.equal(user.last_name, 'lastNammmmeee')
        return done()
      })
    })

    it('should set emails attribute', function(done) {
      return this.UserCreator.createNewUser(
        { email: this.email },
        (err, user) => {
          user.email.should.equal(this.email)
          user.emails.length.should.equal(1)
          user.emails[0].email.should.equal(this.email)
          user.emails[0].createdAt.should.be.a('date')
          user.emails[0].reversedHostname.should.equal('moc.liamg')
          return done()
        }
      )
    })

    it('should add affiliation in background', function(done) {
      return this.UserCreator.createNewUser(
        { email: this.email },
        (err, user) => {
          // addaffiliation should not be called before the callback but only after
          // a tick of the event loop
          sinon.assert.notCalled(this.addAffiliation)
          return process.nextTick(() => {
            sinon.assert.calledWith(this.addAffiliation, user._id, user.email)
            return done()
          })
        }
      )
    })

    it('should not add affiliation if skipping', function(done) {
      const attributes = { email: this.email }
      const options = { skip_affiliation: true }
      return this.UserCreator.createNewUser(
        attributes,
        options,
        (err, user) => {
          return process.nextTick(() => {
            sinon.assert.notCalled(this.addAffiliation)
            return done()
          })
        }
      )
    })
  })
})
