const SandboxedModule = require('sandboxed-module')
const chai = require('chai')
const sinon = require('sinon')

const assert = chai.assert
const modulePath = '../../../../app/src/Features/User/UserCreator.js'

describe('UserCreator', function() {
  beforeEach(function() {
    const self = this
    this.user = { _id: '12390i', ace: {} }
    this.user.save = sinon.stub().resolves(self.user)
    this.UserModel = class Project {
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

    this.email = 'bob.oswald@gmail.com'
  })

  describe('createNewUser', function() {
    describe('with callbacks', function() {
      it('should take the opts and put them in the model', function(done) {
        const opts = {
          email: this.email,
          holdingAccount: true
        }
        this.UserCreator.createNewUser(opts, (err, user) => {
          assert.ifError(err)
          assert.equal(user.email, this.email)
          assert.equal(user.holdingAccount, true)
          assert.equal(user.first_name, 'bob.oswald')
          done()
        })
      })

      it('should use the start of the email if the first name is empty string', function(done) {
        const opts = {
          email: this.email,
          holdingAccount: true,
          first_name: ''
        }
        this.UserCreator.createNewUser(opts, (err, user) => {
          assert.ifError(err)
          assert.equal(user.email, this.email)
          assert.equal(user.holdingAccount, true)
          assert.equal(user.first_name, 'bob.oswald')
          done()
        })
      })

      it('should use the first name if passed', function(done) {
        const opts = {
          email: this.email,
          holdingAccount: true,
          first_name: 'fiiirstname'
        }
        this.UserCreator.createNewUser(opts, (err, user) => {
          assert.ifError(err)
          assert.equal(user.email, this.email)
          assert.equal(user.holdingAccount, true)
          assert.equal(user.first_name, 'fiiirstname')
          done()
        })
      })

      it('should use the last name if passed', function(done) {
        const opts = {
          email: this.email,
          holdingAccount: true,
          last_name: 'lastNammmmeee'
        }
        this.UserCreator.createNewUser(opts, (err, user) => {
          assert.ifError(err)
          assert.equal(user.email, this.email)
          assert.equal(user.holdingAccount, true)
          assert.equal(user.last_name, 'lastNammmmeee')
          done()
        })
      })

      it('should set emails attribute', function(done) {
        this.UserCreator.createNewUser({ email: this.email }, (err, user) => {
          assert.ifError(err)
          user.email.should.equal(this.email)
          user.emails.length.should.equal(1)
          user.emails[0].email.should.equal(this.email)
          user.emails[0].createdAt.should.be.a('date')
          user.emails[0].reversedHostname.should.equal('moc.liamg')
          done()
        })
      })

      it('should add affiliation', function(done) {
        const attributes = { email: this.email }
        this.UserCreator.createNewUser(attributes, (err, user) => {
          assert.ifError(err)
          sinon.assert.calledOnce(this.addAffiliation)
          sinon.assert.calledWithMatch(
            this.addAffiliation,
            user._id,
            this.email
          )
          done()
        })
      })

      it('should not add affiliation if skipping', function(done) {
        const attributes = { email: this.email }
        const options = { skip_affiliation: true }
        this.UserCreator.createNewUser(attributes, options, (err, user) => {
          assert.ifError(err)
          process.nextTick(() => {
            sinon.assert.notCalled(this.addAffiliation)
            done()
          })
        })
      })
    })

    describe('with promises', function() {
      it('should take the opts and put them in the model', async function() {
        const opts = {
          email: this.email,
          holdingAccount: true
        }
        const user = await this.UserCreator.promises.createNewUser(opts)
        assert.equal(user.email, this.email)
        assert.equal(user.holdingAccount, true)
        assert.equal(user.first_name, 'bob.oswald')
      })

      it('should add affiliation', async function() {
        const attributes = { email: this.email }
        const user = await this.UserCreator.promises.createNewUser(attributes)
        sinon.assert.calledOnce(this.addAffiliation)
        sinon.assert.calledWithMatch(this.addAffiliation, user._id, this.email)
      })

      it('should not add affiliation if skipping', async function() {
        const attributes = { email: this.email }
        const opts = { skip_affiliation: true }
        await this.UserCreator.promises.createNewUser(attributes, opts)
        sinon.assert.notCalled(this.addAffiliation)
      })

      it('should include SAML provider ID with email', async function() {
        const attributes = {
          email: this.email,
          samlIdentifiers: [{ email: this.email, providerId: '1' }]
        }
        const user = await this.UserCreator.promises.createNewUser(attributes)
        assert.equal(user.emails[0].samlProviderId, '1')
      })
    })
  })
})
