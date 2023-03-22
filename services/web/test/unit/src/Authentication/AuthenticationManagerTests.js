const sinon = require('sinon')
const { expect } = require('chai')
const SandboxedModule = require('sandboxed-module')
const { ObjectId } = require('mongodb')
const AuthenticationErrors = require('../../../../app/src/Features/Authentication/AuthenticationErrors')
const tk = require('timekeeper')

const modulePath =
  '../../../../app/src/Features/Authentication/AuthenticationManager.js'

describe('AuthenticationManager', function () {
  beforeEach(function () {
    tk.freeze(Date.now())
    this.settings = { security: { bcryptRounds: 4 } }
    this.metrics = { inc: sinon.stub().returns() }
    this.AuthenticationManager = SandboxedModule.require(modulePath, {
      requires: {
        '../../models/User': {
          User: (this.User = {
            updateOne: sinon.stub().callsArgWith(3, null, { modifiedCount: 1 }),
          }),
        },
        '../../infrastructure/mongodb': {
          db: (this.db = { users: {} }),
          ObjectId,
        },
        bcrypt: (this.bcrypt = {}),
        '@overleaf/settings': this.settings,
        '../User/UserGetter': (this.UserGetter = {}),
        './AuthenticationErrors': AuthenticationErrors,
        './HaveIBeenPwned': {
          checkPasswordForReuse: sinon.stub().yields(null, false),
          checkPasswordForReuseInBackground: sinon.stub(),
        },
        '../User/UserAuditLogHandler': (this.UserAuditLogHandler = {
          addEntry: sinon.stub().callsArgWith(5, null),
        }),
        '@overleaf/metrics': this.metrics,
      },
    })
    this.callback = sinon.stub()
  })

  afterEach(function () {
    tk.reset()
  })

  describe('with real bcrypt', function () {
    beforeEach(function () {
      const bcrypt = require('bcrypt')
      this.bcrypt.compare = bcrypt.compare
      this.bcrypt.getRounds = bcrypt.getRounds
      this.bcrypt.genSalt = bcrypt.genSalt
      this.bcrypt.hash = bcrypt.hash
      // Hash of 'testpassword'
      this.testPassword =
        '$2a$04$DcU/3UeJf1PfsWlQL./5H.rGTQL1Z1iyz6r7bN9Do8cy6pVWxpKpK'
    })

    describe('authenticate', function () {
      beforeEach(function () {
        this.user = {
          _id: 'user-id',
          email: (this.email = 'USER@sharelatex.com'),
        }
        this.user.hashedPassword = this.testPassword
        this.User.findOne = sinon.stub().callsArgWith(1, null, this.user)
        this.metrics.inc.reset()
      })

      describe('when the hashed password matches', function () {
        beforeEach(function (done) {
          this.unencryptedPassword = 'testpassword'
          this.AuthenticationManager.authenticate(
            { email: this.email },
            this.unencryptedPassword,
            (error, user) => {
              this.callback(error, user)
              done()
            }
          )
        })

        it('should look up the correct user in the database', function () {
          this.User.findOne.calledWith({ email: this.email }).should.equal(true)
        })

        it('should bump epoch', function () {
          this.User.updateOne.should.have.been.calledWith(
            {
              _id: this.user._id,
              loginEpoch: this.user.loginEpoch,
            },
            {
              $inc: { loginEpoch: 1 },
            },
            {}
          )
        })

        it('should return the user', function () {
          this.callback.should.have.been.calledWith(null, this.user)
        })

        it('should send metrics', function () {
          expect(
            this.metrics.inc.calledWith('check-password', { status: 'success' })
          ).to.equal(true)
        })
      })

      describe('when the encrypted passwords do not match', function () {
        beforeEach(function (done) {
          this.AuthenticationManager.authenticate(
            { email: this.email },
            'notthecorrectpassword',
            (...args) => {
              this.callback(...args)
              done()
            }
          )
        })

        it('should persist the login failure and bump epoch', function () {
          this.User.updateOne.should.have.been.calledWith(
            {
              _id: this.user._id,
              loginEpoch: this.user.loginEpoch,
            },
            {
              $inc: { loginEpoch: 1 },
              $set: { lastFailedLogin: new Date() },
            }
          )
        })

        it('should not return the user', function () {
          this.callback.calledWith(null, null).should.equal(true)
        })

        it('should not send metrics', function () {
          expect(this.metrics.inc.called).to.equal(false)
        })
      })

      describe('when another request runs in parallel', function () {
        beforeEach(function () {
          this.User.updateOne = sinon
            .stub()
            .callsArgWith(3, null, { modifiedCount: 0 })
        })

        describe('correct password', function () {
          beforeEach(function (done) {
            this.AuthenticationManager.authenticate(
              { email: this.email },
              'testpassword',
              (...args) => {
                this.callback(...args)
                done()
              }
            )
          })

          it('should return an error', function () {
            this.callback.should.have.been.calledWith(
              sinon.match.instanceOf(AuthenticationErrors.ParallelLoginError)
            )
          })
        })

        describe('bad password', function () {
          beforeEach(function (done) {
            this.User.updateOne = sinon
              .stub()
              .yields(null, { modifiedCount: 0 })
            this.AuthenticationManager.authenticate(
              { email: this.email },
              'notthecorrectpassword',
              (...args) => {
                this.callback(...args)
                done()
              }
            )
          })
          it('should return an error', function () {
            this.callback.should.have.been.calledWith(
              sinon.match.instanceOf(AuthenticationErrors.ParallelLoginError)
            )
          })
        })
      })
    })

    describe('setUserPasswordInV2', function () {
      beforeEach(function () {
        this.user = {
          _id: '5c8791477192a80b5e76ca7e',
          email: (this.email = 'USER@sharelatex.com'),
        }
        this.db.users.updateOne = sinon
        this.User.findOne = sinon.stub().callsArgWith(1, null, this.user)
        this.bcrypt.compare = sinon.stub().callsArgWith(2, null, false)
        this.db.users.updateOne = sinon
          .stub()
          .callsArgWith(2, null, { modifiedCount: 1 })
      })

      it('should not produce an error', function (done) {
        this.AuthenticationManager.setUserPasswordInV2(
          this.user,
          'testpassword',
          (err, updated) => {
            expect(err).to.not.exist
            expect(updated).to.equal(true)
            done()
          }
        )
      })

      it('should set the hashed password', function (done) {
        this.AuthenticationManager.setUserPasswordInV2(
          this.user,
          'testpassword',
          err => {
            expect(err).to.not.exist
            const { hashedPassword } =
              this.db.users.updateOne.lastCall.args[1].$set
            expect(hashedPassword).to.exist
            expect(hashedPassword.length).to.equal(60)
            expect(hashedPassword).to.match(/^\$2a\$04\$[a-zA-Z0-9/.]{53}$/)
            done()
          }
        )
      })
    })
  })

  describe('hashPassword', function () {
    it('should block too long passwords', function (done) {
      this.AuthenticationManager.hashPassword('x'.repeat(100), err => {
        expect(err).to.exist
        expect(err.message).to.equal('password is too long')
        done()
      })
    })
  })

  describe('authenticate', function () {
    describe('when the user exists in the database', function () {
      beforeEach(function () {
        this.user = {
          _id: 'user-id',
          email: (this.email = 'USER@sharelatex.com'),
        }
        this.unencryptedPassword = 'banana'
        this.User.findOne = sinon.stub().callsArgWith(1, null, this.user)
        this.metrics.inc.reset()
      })

      describe('when the hashed password matches', function () {
        beforeEach(function (done) {
          this.user.hashedPassword = this.hashedPassword = 'asdfjadflasdf'
          this.bcrypt.compare = sinon.stub().callsArgWith(2, null, true)
          this.bcrypt.getRounds = sinon.stub().returns(4)
          this.AuthenticationManager.authenticate(
            { email: this.email },
            this.unencryptedPassword,
            (error, user) => {
              this.callback(error, user)
              done()
            }
          )
        })

        it('should look up the correct user in the database', function () {
          this.User.findOne.calledWith({ email: this.email }).should.equal(true)
        })

        it('should check that the passwords match', function () {
          this.bcrypt.compare
            .calledWith(this.unencryptedPassword, this.hashedPassword)
            .should.equal(true)
        })

        it('should send metrics', function () {
          expect(
            this.metrics.inc.calledWith('check-password', {
              status: 'too_short',
            })
          ).to.equal(true)
        })

        it('should return the user', function () {
          this.callback.calledWith(null, this.user).should.equal(true)
        })
      })

      describe('when the encrypted passwords do not match', function () {
        beforeEach(function () {
          this.user.hashedPassword = this.hashedPassword = 'asdfjadflasdf'
          this.bcrypt.compare = sinon.stub().callsArgWith(2, null, false)
          this.AuthenticationManager.authenticate(
            { email: this.email },
            this.unencryptedPassword,
            this.callback
          )
        })

        it('should not send metrics', function () {
          expect(this.metrics.inc.called).to.equal(false)
        })

        it('should not return the user', function () {
          this.callback.calledWith(null, null).should.equal(true)
          this.UserAuditLogHandler.addEntry.callCount.should.equal(0)
        })
      })

      describe('when the encrypted passwords do not match, with auditLog', function () {
        beforeEach(function () {
          this.user.hashedPassword = this.hashedPassword = 'asdfjadflasdf'
          this.bcrypt.compare = sinon.stub().callsArgWith(2, null, false)
          this.auditLog = { ipAddress: 'ip', info: { method: 'foo' } }
          this.AuthenticationManager.authenticate(
            { email: this.email },
            this.unencryptedPassword,
            this.auditLog,
            this.callback
          )
        })

        it('should not return the user, but add entry to audit log', function () {
          this.callback.calledWith(null, null).should.equal(true)
          this.UserAuditLogHandler.addEntry.callCount.should.equal(1)
          this.UserAuditLogHandler.addEntry
            .calledWith(
              this.user._id,
              'failed-password-match',
              this.user._id,
              this.auditLog.ipAddress,
              this.auditLog.info
            )
            .should.equal(true)
        })
      })

      describe('when the hashed password matches but the number of rounds is too low', function () {
        beforeEach(function (done) {
          this.user.hashedPassword = this.hashedPassword = 'asdfjadflasdf'
          this.bcrypt.compare = sinon.stub().callsArgWith(2, null, true)
          this.bcrypt.getRounds = sinon.stub().returns(1)
          this.AuthenticationManager._setUserPasswordInMongo = sinon
            .stub()
            .callsArgWith(2, null)
          this.AuthenticationManager.authenticate(
            { email: this.email },
            this.unencryptedPassword,
            (error, user) => {
              this.callback(error, user)
              done()
            }
          )
        })

        it('should look up the correct user in the database', function () {
          this.User.findOne.calledWith({ email: this.email }).should.equal(true)
        })

        it('should check that the passwords match', function () {
          this.bcrypt.compare
            .calledWith(this.unencryptedPassword, this.hashedPassword)
            .should.equal(true)
        })

        it('should check the number of rounds', function () {
          this.bcrypt.getRounds.called.should.equal(true)
        })

        it('should set the users password (with a higher number of rounds)', function () {
          this.AuthenticationManager._setUserPasswordInMongo
            .calledWith(this.user, this.unencryptedPassword)
            .should.equal(true)
        })

        it('should return the user', function () {
          this.callback.calledWith(null, this.user).should.equal(true)
        })
      })

      describe('when the hashed password matches but the number of rounds is too low, but upgrades disabled', function () {
        beforeEach(function (done) {
          this.settings.security.disableBcryptRoundsUpgrades = true
          this.user.hashedPassword = this.hashedPassword = 'asdfjadflasdf'
          this.bcrypt.compare = sinon.stub().callsArgWith(2, null, true)
          this.bcrypt.getRounds = sinon.stub().returns(1)
          this.AuthenticationManager.setUserPassword = sinon
            .stub()
            .callsArgWith(2, null)
          this.AuthenticationManager.authenticate(
            { email: this.email },
            this.unencryptedPassword,
            (error, user) => {
              this.callback(error, user)
              done()
            }
          )
        })

        it('should not check the number of rounds', function () {
          this.bcrypt.getRounds.called.should.equal(false)
        })

        it('should not set the users password (with a higher number of rounds)', function () {
          this.AuthenticationManager.setUserPassword
            .calledWith(this.user, this.unencryptedPassword)
            .should.equal(false)
        })

        it('should return the user', function () {
          this.callback.calledWith(null, this.user).should.equal(true)
        })
      })
    })

    describe('when the user does not exist in the database', function () {
      beforeEach(function () {
        this.User.findOne = sinon.stub().callsArgWith(1, null, null)
        this.AuthenticationManager.authenticate(
          { email: this.email },
          this.unencrpytedPassword,
          this.callback
        )
      })

      it('should not return a user', function () {
        this.callback.calledWith(null, null).should.equal(true)
      })
    })
  })

  describe('validateEmail', function () {
    describe('valid', function () {
      it('should return null', function () {
        const result =
          this.AuthenticationManager.validateEmail('foo@example.com')
        expect(result).to.equal(null)
      })
    })

    describe('invalid', function () {
      it('should return validation error object for no email', function () {
        const result = this.AuthenticationManager.validateEmail('')
        expect(result).to.an.instanceOf(AuthenticationErrors.InvalidEmailError)
        expect(result.message).to.equal('email not valid')
      })

      it('should return validation error object for invalid', function () {
        const result = this.AuthenticationManager.validateEmail('notanemail')
        expect(result).to.be.an.instanceOf(
          AuthenticationErrors.InvalidEmailError
        )
        expect(result.message).to.equal('email not valid')
      })
    })
  })

  describe('validatePassword', function () {
    beforeEach(function () {
      // 73 characters:
      this.longPassword =
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef012345678'
    })

    describe('with a null password', function () {
      it('should return an error', function () {
        const result = this.AuthenticationManager.validatePassword()

        expect(result).to.be.an.instanceOf(
          AuthenticationErrors.InvalidPasswordError
        )
        expect(result.message).to.equal('password not set')
        expect(result.info.code).to.equal('not_set')
      })
    })

    describe('password length', function () {
      describe('with the default password length options', function () {
        beforeEach(function () {
          this.metrics.inc.reset()
        })

        it('should send a metric', function () {
          this.AuthenticationManager.validatePassword('foo')
          expect(this.metrics.inc.calledWith('try-validate-password')).to.equal(
            true
          )
        })

        it('should reject passwords that are too short', function () {
          const result1 = this.AuthenticationManager.validatePassword('')
          expect(result1).to.be.an.instanceOf(
            AuthenticationErrors.InvalidPasswordError
          )
          expect(result1.message).to.equal('password is too short')
          expect(result1.info.code).to.equal('too_short')

          const result2 = this.AuthenticationManager.validatePassword('foo')
          expect(result2).to.be.an.instanceOf(
            AuthenticationErrors.InvalidPasswordError
          )
          expect(result2.message).to.equal('password is too short')
          expect(result2.info.code).to.equal('too_short')
        })

        it('should reject passwords that are too long', function () {
          const result = this.AuthenticationManager.validatePassword(
            this.longPassword
          )

          expect(result).to.be.an.instanceOf(
            AuthenticationErrors.InvalidPasswordError
          )
          expect(result.message).to.equal('password is too long')
          expect(result.info.code).to.equal('too_long')
        })

        it('should accept passwords that are a good length', function () {
          expect(
            this.AuthenticationManager.validatePassword('l337h4x0r')
          ).to.equal(null)
        })
      })

      describe('when the password length is specified in settings', function () {
        beforeEach(function () {
          this.settings.passwordStrengthOptions = {
            length: {
              min: 10,
              max: 12,
            },
          }
        })

        it('should reject passwords that are too short', function () {
          const result =
            this.AuthenticationManager.validatePassword('012345678')

          expect(result).to.be.an.instanceOf(
            AuthenticationErrors.InvalidPasswordError
          )
          expect(result.message).to.equal('password is too short')
          expect(result.info.code).to.equal('too_short')
        })

        it('should accept passwords of exactly minimum length', function () {
          expect(
            this.AuthenticationManager.validatePassword('0123456789')
          ).to.equal(null)
        })

        it('should reject passwords that are too long', function () {
          const result =
            this.AuthenticationManager.validatePassword('0123456789abc')

          expect(result).to.be.an.instanceOf(
            AuthenticationErrors.InvalidPasswordError
          )
          expect(result.message).to.equal('password is too long')
          expect(result.info.code).to.equal('too_long')
        })

        it('should accept passwords of exactly maximum length', function () {
          expect(
            this.AuthenticationManager.validatePassword('0123456789ab')
          ).to.equal(null)
        })
      })

      describe('when the maximum password length is set to >72 characters in settings', function () {
        beforeEach(function () {
          this.settings.passwordStrengthOptions = {
            length: {
              max: 128,
            },
          }
        })

        it('should still reject passwords > 72 characters in length', function () {
          const result = this.AuthenticationManager.validatePassword(
            this.longPassword
          )

          expect(result).to.be.an.instanceOf(
            AuthenticationErrors.InvalidPasswordError
          )
          expect(result.message).to.equal('password is too long')
          expect(result.info.code).to.equal('too_long')
        })
      })
    })

    describe('allowed characters', function () {
      describe('with the default settings for allowed characters', function () {
        it('should allow passwords with valid characters', function () {
          expect(
            this.AuthenticationManager.validatePassword(
              'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
            )
          ).to.equal(null)
          expect(
            this.AuthenticationManager.validatePassword(
              '1234567890@#$%^&*()-_=+[]{};:<>/?!£€.,'
            )
          ).to.equal(null)
        })

        it('should not allow passwords with invalid characters', function () {
          const result = this.AuthenticationManager.validatePassword(
            'correct horse battery staple'
          )

          expect(result).to.be.an.instanceOf(
            AuthenticationErrors.InvalidPasswordError
          )
          expect(result.message).to.equal(
            'password contains an invalid character'
          )
          expect(result.info.code).to.equal('invalid_character')
        })
      })

      describe('when valid characters are overridden in settings', function () {
        beforeEach(function () {
          this.settings.passwordStrengthOptions = {
            chars: {
              symbols: ' ',
            },
          }
        })

        it('should allow passwords with valid characters', function () {
          expect(
            this.AuthenticationManager.validatePassword(
              'correct horse battery staple'
            )
          ).to.equal(null)
        })

        it('should disallow passwords with invalid characters', function () {
          const result = this.AuthenticationManager.validatePassword(
            '1234567890@#$%^&*()-_=+[]{};:<>/?!£€.,'
          )

          expect(result).to.be.an.instanceOf(
            AuthenticationErrors.InvalidPasswordError
          )
          expect(result.message).to.equal(
            'password contains an invalid character'
          )
          expect(result.info.code).to.equal('invalid_character')
        })
      })

      describe('when allowAnyChars is set', function () {
        beforeEach(function () {
          this.settings.passwordStrengthOptions = {
            allowAnyChars: true,
          }
        })

        it('should allow any characters', function () {
          expect(
            this.AuthenticationManager.validatePassword(
              'correct horse battery staple'
            )
          ).to.equal(null)
          expect(
            this.AuthenticationManager.validatePassword(
              '1234567890@#$%^&*()-_=+[]{};:<>/?!£€.,'
            )
          ).to.equal(null)
        })
      })
    })
  })

  describe('_validatePasswordNotTooSimilar', function () {
    beforeEach(function () {
      this.metrics.inc.reset()
    })

    it('should return an error when the password is too similar to email', function () {
      const password = '12someuser34'
      const email = 'someuser@example.com'
      const error = this.AuthenticationManager._validatePasswordNotTooSimilar(
        password,
        email
      )
      expect(error).to.exist
    })

    it('should return an error when the password is re-arranged elements of the email', function () {
      const badPasswords = [
        'su2oe1em3oolc',
        'someone.cool',
        'someonecool',
        'cool.someone',
        'coolsomeone',
        'example.com',
        'examplecom',
        'com.example',
        'comexample',
      ]
      const email = 'someone.cool@example.com'
      for (const password of badPasswords) {
        const error = this.AuthenticationManager._validatePasswordNotTooSimilar(
          password,
          email
        )
        expect(error).to.exist
      }
    })

    it('should return nothing when the password different from email', function () {
      const password = '58WyLvr'
      const email = 'someuser@example.com'
      const error = this.AuthenticationManager._validatePasswordNotTooSimilar(
        password,
        email
      )
      expect(error).to.not.exist
    })

    it('should return nothing when the password is much longer than parts of the email', function () {
      const password = new Array(30).fill('a').join('')
      const email = 'a@cd.com'
      const error = this.AuthenticationManager._validatePasswordNotTooSimilar(
        password,
        email
      )
      expect(error).to.not.exist
    })
  })

  describe('setUserPassword', function () {
    beforeEach(function () {
      this.user_id = ObjectId()
      this.password = 'bananagram'
      this.hashedPassword = 'asdkjfa;osiuvandf'
      this.salt = 'saltaasdfasdfasdf'
      this.user = {
        _id: this.user_id,
        email: 'user@example.com',
        hashedPassword: this.hashedPassword,
      }
      this.bcrypt.compare = sinon.stub().callsArgWith(2, null, false)
      this.bcrypt.genSalt = sinon.stub().callsArgWith(2, null, this.salt)
      this.bcrypt.hash = sinon.stub().callsArgWith(2, null, this.hashedPassword)
      this.User.findOne = sinon.stub().callsArgWith(1, null, this.user)
      this.db.users.updateOne = sinon.stub().callsArg(2)
    })

    describe('same as previous password', function () {
      beforeEach(function () {
        this.bcrypt.compare.callsArgWith(2, null, true)
      })

      it('should return an error', function (done) {
        this.AuthenticationManager.setUserPassword(
          this.user,
          this.password,
          err => {
            expect(err).to.exist
            expect(err.name).to.equal('PasswordMustBeDifferentError')
            done()
          }
        )
      })
    })

    describe('too long', function () {
      beforeEach(function () {
        this.settings.passwordStrengthOptions = {
          length: {
            max: 10,
          },
        }
        this.password = 'dsdsadsadsadsadsadkjsadjsadjsadljs'
      })

      it('should return and error', function (done) {
        this.AuthenticationManager.setUserPassword(
          this.user,
          this.password,
          err => {
            expect(err).to.exist
            done()
          }
        )
      })

      it('should not start the bcrypt process', function (done) {
        this.AuthenticationManager.setUserPassword(
          this.user,
          this.password,
          () => {
            this.bcrypt.genSalt.called.should.equal(false)
            this.bcrypt.hash.called.should.equal(false)
            done()
          }
        )
      })
    })

    describe('contains full email', function () {
      beforeEach(function () {
        this.password = `some${this.user.email}password`
      })

      it('should reject the password', function (done) {
        this.AuthenticationManager.setUserPassword(
          this.user,
          this.password,
          err => {
            expect(err).to.exist
            expect(err.name).to.equal('InvalidPasswordError')
            done()
          }
        )
      })
    })

    describe('contains first part of email', function () {
      beforeEach(function () {
        this.password = `some${this.user.email.split('@')[0]}password`
      })

      it('should reject the password', function (done) {
        this.AuthenticationManager.setUserPassword(
          this.user,
          this.password,
          err => {
            expect(err).to.exist
            expect(err.name).to.equal('InvalidPasswordError')
            done()
          }
        )
      })
    })

    describe('email contains password', function () {
      let user, password
      beforeEach(function () {
        password = 'somedomain'
        user = { _id: 'some-user-id', email: 'someuser@somedomain.com' }
      })

      it('should reject the password', function (done) {
        this.AuthenticationManager.setUserPassword(user, password, err => {
          expect(err).to.exist
          expect(err.name).to.equal('InvalidPasswordError')
          expect(err?.info?.code).to.equal('contains_email')
          done()
        })
      })
    })

    describe('too short', function () {
      beforeEach(function () {
        this.settings.passwordStrengthOptions = {
          length: {
            max: 10,
            min: 6,
          },
        }
        this.password = 'dsd'
      })

      it('should return and error', function (done) {
        this.AuthenticationManager.setUserPassword(
          this.user,
          this.password,
          err => {
            expect(err).to.exist
            done()
          }
        )
      })

      it('should not start the bcrypt process', function (done) {
        this.AuthenticationManager.setUserPassword(
          this.user,
          this.password,
          () => {
            this.bcrypt.genSalt.called.should.equal(false)
            this.bcrypt.hash.called.should.equal(false)
            done()
          }
        )
      })
    })

    describe('password too similar to email', function () {
      beforeEach(function () {
        this.user.email = 'foobarbazquux@example.com'
        this.password = 'foo21barbaz'
        this.metrics.inc.reset()
      })

      it('should produce an error when the password is too similar to the email', function (done) {
        this.AuthenticationManager.setUserPassword(
          this.user,
          this.password,
          err => {
            expect(err).to.exist
            expect(err?.info?.code).to.equal('too_similar')
            expect(
              this.metrics.inc.calledWith('password-too-similar-to-email')
            ).to.equal(true)
            done()
          }
        )
      })

      it('should produce an error when the password is too similar to the email, regardless of case', function (done) {
        this.AuthenticationManager.setUserPassword(
          this.user,
          this.password.toUpperCase(),
          err => {
            expect(err).to.exist
            expect(err?.info?.code).to.equal('too_similar')
            expect(
              this.metrics.inc.calledWith('password-too-similar-to-email')
            ).to.equal(true)
            done()
          }
        )
      })
    })

    describe('successful password set attempt', function () {
      beforeEach(function () {
        this.metrics.inc.reset()
        this.UserGetter.getUser = sinon.stub().yields(null, { overleaf: null })
        this.AuthenticationManager.setUserPassword(
          this.user,
          this.password,
          this.callback
        )
      })

      it("should update the user's password in the database", function () {
        const { args } = this.db.users.updateOne.lastCall
        expect(args[0]).to.deep.equal({
          _id: ObjectId(this.user_id.toString()),
        })
        expect(args[1]).to.deep.equal({
          $set: {
            hashedPassword: this.hashedPassword,
          },
          $unset: {
            password: true,
          },
        })
      })

      it('should hash the password', function () {
        this.bcrypt.genSalt.calledWith(4).should.equal(true)
        this.bcrypt.hash.calledWith(this.password, this.salt).should.equal(true)
      })

      it('should not send a metric for password-too-similar-to-email', function () {
        expect(
          this.metrics.inc.calledWith('password-too-similar-to-email')
        ).to.equal(false)
      })

      it('should call the callback', function () {
        this.callback.called.should.equal(true)
        expect(this.callback.lastCall.args[0]).to.not.be.instanceOf(Error)
      })
    })
  })
})
