const sinon = require('sinon')
const chai = require('chai')
const SandboxedModule = require('sandboxed-module')
const { ObjectId } = require('mongojs')
const AuthenticationErrors = require('../../../../app/src/Features/Authentication/AuthenticationErrors')

chai.should()
const { expect } = chai
const modulePath =
  '../../../../app/src/Features/Authentication/AuthenticationManager.js'

describe('AuthenticationManager', function() {
  beforeEach(function() {
    this.settings = { security: { bcryptRounds: 12 } }
    this.AuthenticationManager = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../../models/User': {
          User: (this.User = {})
        },
        '../../infrastructure/mongojs': {
          db: (this.db = { users: {} }),
          ObjectId
        },
        bcrypt: (this.bcrypt = {}),
        'settings-sharelatex': this.settings,
        '../V1/V1Handler': (this.V1Handler = {}),
        '../User/UserGetter': (this.UserGetter = {}),
        './AuthenticationErrors': AuthenticationErrors
      }
    })
    this.callback = sinon.stub()
  })

  describe('with real bcrypt', function() {
    beforeEach(function() {
      const bcrypt = require('bcrypt')
      this.bcrypt.compare = bcrypt.compare
      this.bcrypt.getRounds = bcrypt.getRounds
      this.bcrypt.genSalt = bcrypt.genSalt
      this.bcrypt.hash = bcrypt.hash
      // Hash of 'testpassword'
      this.testPassword =
        '$2a$12$zhtThy3R5tLtw5sCwr5XD.zhPENGn4ecjeMcP87oYSYrIICFqBpei'
    })

    describe('authenticate', function() {
      beforeEach(function() {
        this.user = {
          _id: 'user-id',
          email: (this.email = 'USER@sharelatex.com')
        }
        this.User.findOne = sinon.stub().callsArgWith(1, null, this.user)
      })

      describe('when the hashed password matches', function() {
        beforeEach(function(done) {
          this.unencryptedPassword = 'testpassword'
          this.user.hashedPassword = this.testPassword
          this.AuthenticationManager.authenticate(
            { email: this.email },
            this.unencryptedPassword,
            (error, user) => {
              this.callback(error, user)
              done()
            }
          )
        })

        it('should look up the correct user in the database', function() {
          this.User.findOne.calledWith({ email: this.email }).should.equal(true)
        })

        it('should return the user', function() {
          this.callback.calledWith(null, this.user).should.equal(true)
        })
      })

      describe('when the encrypted passwords do not match', function() {
        beforeEach(function() {
          this.AuthenticationManager.authenticate(
            { email: this.email },
            'notthecorrectpassword',
            this.callback
          )
        })

        it('should not return the user', function() {
          this.callback.calledWith(null, null).should.equal(true)
        })
      })
    })

    describe('setUserPasswordInV2', function() {
      beforeEach(function() {
        this.user = {
          _id: '5c8791477192a80b5e76ca7e',
          email: (this.email = 'USER@sharelatex.com')
        }
        this.db.users.update = sinon
          .stub()
          .callsArgWith(2, null, { nModified: 1 })
      })

      it('should not produce an error', function(done) {
        this.AuthenticationManager.setUserPasswordInV2(
          this.user._id,
          'testpassword',
          (err, updated) => {
            expect(err).to.not.exist
            expect(updated).to.equal(true)
            done()
          }
        )
      })

      it('should set the hashed password', function(done) {
        this.AuthenticationManager.setUserPasswordInV2(
          this.user._id,
          'testpassword',
          err => {
            expect(err).to.not.exist
            const {
              hashedPassword
            } = this.db.users.update.lastCall.args[1].$set
            expect(hashedPassword).to.exist
            expect(hashedPassword.length).to.equal(60)
            expect(hashedPassword).to.match(/^\$2a\$12\$[a-zA-Z0-9/.]{53}$/)
            done()
          }
        )
      })
    })
  })

  describe('authenticate', function() {
    describe('when the user exists in the database', function() {
      beforeEach(function() {
        this.user = {
          _id: 'user-id',
          email: (this.email = 'USER@sharelatex.com')
        }
        this.unencryptedPassword = 'banana'
        this.User.findOne = sinon.stub().callsArgWith(1, null, this.user)
      })

      describe('when the hashed password matches', function() {
        beforeEach(function(done) {
          this.user.hashedPassword = this.hashedPassword = 'asdfjadflasdf'
          this.bcrypt.compare = sinon.stub().callsArgWith(2, null, true)
          this.bcrypt.getRounds = sinon.stub().returns(12)
          this.AuthenticationManager.authenticate(
            { email: this.email },
            this.unencryptedPassword,
            (error, user) => {
              this.callback(error, user)
              done()
            }
          )
        })

        it('should look up the correct user in the database', function() {
          this.User.findOne.calledWith({ email: this.email }).should.equal(true)
        })

        it('should check that the passwords match', function() {
          this.bcrypt.compare
            .calledWith(this.unencryptedPassword, this.hashedPassword)
            .should.equal(true)
        })

        it('should return the user', function() {
          this.callback.calledWith(null, this.user).should.equal(true)
        })
      })

      describe('when the encrypted passwords do not match', function() {
        beforeEach(function() {
          this.AuthenticationManager.authenticate(
            { email: this.email },
            this.unencryptedPassword,
            this.callback
          )
        })

        it('should not return the user', function() {
          this.callback.calledWith(null, null).should.equal(true)
        })
      })

      describe('when the hashed password matches but the number of rounds is too low', function() {
        beforeEach(function(done) {
          this.user.hashedPassword = this.hashedPassword = 'asdfjadflasdf'
          this.bcrypt.compare = sinon.stub().callsArgWith(2, null, true)
          this.bcrypt.getRounds = sinon.stub().returns(7)
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

        it('should look up the correct user in the database', function() {
          this.User.findOne.calledWith({ email: this.email }).should.equal(true)
        })

        it('should check that the passwords match', function() {
          this.bcrypt.compare
            .calledWith(this.unencryptedPassword, this.hashedPassword)
            .should.equal(true)
        })

        it('should check the number of rounds', function() {
          this.bcrypt.getRounds.called.should.equal(true)
        })

        it('should set the users password (with a higher number of rounds)', function() {
          this.AuthenticationManager.setUserPassword
            .calledWith('user-id', this.unencryptedPassword)
            .should.equal(true)
        })

        it('should return the user', function() {
          this.callback.calledWith(null, this.user).should.equal(true)
        })
      })

      describe('when the hashed password matches but the number of rounds is too low, but upgrades disabled', function() {
        beforeEach(function(done) {
          this.settings.security.disableBcryptRoundsUpgrades = true
          this.user.hashedPassword = this.hashedPassword = 'asdfjadflasdf'
          this.bcrypt.compare = sinon.stub().callsArgWith(2, null, true)
          this.bcrypt.getRounds = sinon.stub().returns(7)
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

        it('should not check the number of rounds', function() {
          this.bcrypt.getRounds.called.should.equal(false)
        })

        it('should not set the users password (with a higher number of rounds)', function() {
          this.AuthenticationManager.setUserPassword
            .calledWith('user-id', this.unencryptedPassword)
            .should.equal(false)
        })

        it('should return the user', function() {
          this.callback.calledWith(null, this.user).should.equal(true)
        })
      })
    })

    describe('when the user does not exist in the database', function() {
      beforeEach(function() {
        this.User.findOne = sinon.stub().callsArgWith(1, null, null)
        this.AuthenticationManager.authenticate(
          { email: this.email },
          this.unencrpytedPassword,
          this.callback
        )
      })

      it('should not return a user', function() {
        this.callback.calledWith(null, null).should.equal(true)
      })
    })
  })

  describe('validateEmail', function() {
    describe('valid', function() {
      it('should return null', function() {
        const result = this.AuthenticationManager.validateEmail(
          'foo@example.com'
        )
        expect(result).to.equal(null)
      })
    })

    describe('invalid', function() {
      it('should return validation error object for no email', function() {
        const result = this.AuthenticationManager.validateEmail('')
        expect(result).to.an.instanceOf(AuthenticationErrors.InvalidEmailError)
        expect(result.message).to.equal('email not valid')
      })

      it('should return validation error object for invalid', function() {
        const result = this.AuthenticationManager.validateEmail('notanemail')
        expect(result).to.be.an.instanceOf(
          AuthenticationErrors.InvalidEmailError
        )
        expect(result.message).to.equal('email not valid')
      })
    })
  })

  describe('validatePassword', function() {
    beforeEach(function() {
      // 73 characters:
      this.longPassword =
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef012345678'
    })

    describe('with a null password', function() {
      it('should return an error', function() {
        const result = this.AuthenticationManager.validatePassword()

        expect(result).to.be.an.instanceOf(
          AuthenticationErrors.InvalidPasswordError
        )
        expect(result.message).to.equal('password not set')
        expect(result.info.code).to.equal('not_set')
      })
    })

    describe('password length', function() {
      describe('with the default password length options', function() {
        it('should reject passwords that are too short', function() {
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

        it('should reject passwords that are too long', function() {
          const result = this.AuthenticationManager.validatePassword(
            this.longPassword
          )

          expect(result).to.be.an.instanceOf(
            AuthenticationErrors.InvalidPasswordError
          )
          expect(result.message).to.equal('password is too long')
          expect(result.info.code).to.equal('too_long')
        })

        it('should accept passwords that are a good length', function() {
          expect(
            this.AuthenticationManager.validatePassword('l337h4x0r')
          ).to.equal(null)
        })
      })

      describe('when the password length is specified in settings', function() {
        beforeEach(function() {
          this.settings.passwordStrengthOptions = {
            length: {
              min: 10,
              max: 12
            }
          }
        })

        it('should reject passwords that are too short', function() {
          const result = this.AuthenticationManager.validatePassword(
            '012345678'
          )

          expect(result).to.be.an.instanceOf(
            AuthenticationErrors.InvalidPasswordError
          )
          expect(result.message).to.equal('password is too short')
          expect(result.info.code).to.equal('too_short')
        })

        it('should accept passwords of exactly minimum length', function() {
          expect(
            this.AuthenticationManager.validatePassword('0123456789')
          ).to.equal(null)
        })

        it('should reject passwords that are too long', function() {
          const result = this.AuthenticationManager.validatePassword(
            '0123456789abc'
          )

          expect(result).to.be.an.instanceOf(
            AuthenticationErrors.InvalidPasswordError
          )
          expect(result.message).to.equal('password is too long')
          expect(result.info.code).to.equal('too_long')
        })

        it('should accept passwords of exactly maximum length', function() {
          expect(
            this.AuthenticationManager.validatePassword('0123456789ab')
          ).to.equal(null)
        })
      })

      describe('when the maximum password length is set to >72 characters in settings', function() {
        beforeEach(function() {
          this.settings.passwordStrengthOptions = {
            length: {
              max: 128
            }
          }
        })

        it('should still reject passwords > 72 characters in length', function() {
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

    describe('allowed characters', function() {
      describe('with the default settings for allowed characters', function() {
        it('should allow passwords with valid characters', function() {
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

        it('should not allow passwords with invalid characters', function() {
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

      describe('when valid characters are overridden in settings', function() {
        beforeEach(function() {
          this.settings.passwordStrengthOptions = {
            chars: {
              symbols: ' '
            }
          }
        })

        it('should allow passwords with valid characters', function() {
          expect(
            this.AuthenticationManager.validatePassword(
              'correct horse battery staple'
            )
          ).to.equal(null)
        })

        it('should disallow passwords with invalid characters', function() {
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

      describe('when allowAnyChars is set', function() {
        beforeEach(function() {
          this.settings.passwordStrengthOptions = {
            allowAnyChars: true
          }
        })

        it('should allow any characters', function() {
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

  describe('setUserPassword', function() {
    beforeEach(function() {
      this.user_id = ObjectId()
      this.password = 'banana'
      this.hashedPassword = 'asdkjfa;osiuvandf'
      this.salt = 'saltaasdfasdfasdf'
      this.bcrypt.genSalt = sinon.stub().callsArgWith(2, null, this.salt)
      this.bcrypt.hash = sinon.stub().callsArgWith(2, null, this.hashedPassword)
      this.db.users.update = sinon.stub().callsArg(2)
    })

    describe('too long', function() {
      beforeEach(function() {
        this.settings.passwordStrengthOptions = {
          length: {
            max: 10
          }
        }
        this.password = 'dsdsadsadsadsadsadkjsadjsadjsadljs'
      })

      it('should return and error', function(done) {
        this.AuthenticationManager.setUserPassword(
          this.user_id,
          this.password,
          err => {
            expect(err).to.exist
            done()
          }
        )
      })

      it('should not start the bcrypt process', function(done) {
        this.AuthenticationManager.setUserPassword(
          this.user_id,
          this.password,
          () => {
            this.bcrypt.genSalt.called.should.equal(false)
            this.bcrypt.hash.called.should.equal(false)
            done()
          }
        )
      })
    })

    describe('too short', function() {
      beforeEach(function() {
        this.settings.passwordStrengthOptions = {
          length: {
            max: 10,
            min: 6
          }
        }
        this.password = 'dsd'
      })

      it('should return and error', function(done) {
        this.AuthenticationManager.setUserPassword(
          this.user_id,
          this.password,
          err => {
            expect(err).to.exist
            done()
          }
        )
      })

      it('should not start the bcrypt process', function(done) {
        this.AuthenticationManager.setUserPassword(
          this.user_id,
          this.password,
          () => {
            this.bcrypt.genSalt.called.should.equal(false)
            this.bcrypt.hash.called.should.equal(false)
            done()
          }
        )
      })
    })

    describe('successful password set attempt', function() {
      beforeEach(function() {
        this.UserGetter.getUser = sinon.stub().yields(null, { overleaf: null })
        this.AuthenticationManager.setUserPassword(
          this.user_id,
          this.password,
          this.callback
        )
      })

      it("should update the user's password in the database", function() {
        const { args } = this.db.users.update.lastCall
        expect(args[0]).to.deep.equal({
          _id: ObjectId(this.user_id.toString())
        })
        expect(args[1]).to.deep.equal({
          $set: {
            hashedPassword: this.hashedPassword
          },
          $unset: {
            password: true
          }
        })
      })

      it('should hash the password', function() {
        this.bcrypt.genSalt.calledWith(12).should.equal(true)
        this.bcrypt.hash.calledWith(this.password, this.salt).should.equal(true)
      })

      it('should call the callback', function() {
        this.callback.called.should.equal(true)
      })
    })
  })
})
