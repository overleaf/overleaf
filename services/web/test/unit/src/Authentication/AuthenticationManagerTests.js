const sinon = require('sinon')
const { expect } = require('chai')
const SandboxedModule = require('sandboxed-module')
const { ObjectId } = require('mongodb-legacy')
const AuthenticationErrors = require('../../../../app/src/Features/Authentication/AuthenticationErrors')
const tk = require('timekeeper')

const modulePath =
  '../../../../app/src/Features/Authentication/AuthenticationManager.js'

describe('AuthenticationManager', function () {
  beforeEach(function () {
    tk.freeze(Date.now())
    this.settings = { security: { bcryptRounds: 4 } }
    this.metrics = { inc: sinon.stub().returns() }
    this.HaveIBeenPwned = {
      promises: {
        checkPasswordForReuse: sinon.stub().resolves(false),
      },
      checkPasswordForReuseInBackground: sinon.stub(),
    }
    this.AuthenticationManager = SandboxedModule.require(modulePath, {
      requires: {
        '../../models/User': {
          User: (this.User = {
            updateOne: sinon
              .stub()
              .returns({ exec: sinon.stub().resolves({ modifiedCount: 1 }) }),
          }),
        },
        '../../infrastructure/mongodb': {
          db: (this.db = { users: {} }),
          ObjectId,
        },
        bcrypt: (this.bcrypt = {
          getRounds: sinon.stub().returns(4),
        }),
        '@overleaf/settings': this.settings,
        '../User/UserGetter': (this.UserGetter = { promises: {} }),
        './AuthenticationErrors': AuthenticationErrors,
        './HaveIBeenPwned': this.HaveIBeenPwned,
        '../User/UserAuditLogHandler': (this.UserAuditLogHandler = {
          promises: {
            addEntry: sinon.stub().resolves(null),
          },
        }),
        '@overleaf/metrics': this.metrics,
      },
    })
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
          email: (this.email = 'USER@overleaf.com'),
        }
        this.user.hashedPassword = this.testPassword
        this.User.findOne = sinon
          .stub()
          .returns({ exec: sinon.stub().resolves(this.user) })
        this.metrics.inc.reset()
      })

      describe('when the hashed password matches', function () {
        beforeEach(async function () {
          this.unencryptedPassword = 'testpassword'
          ;({ user: this.result } =
            await this.AuthenticationManager.promises.authenticate(
              { email: this.email },
              this.unencryptedPassword,
              null,
              { enforceHIBPCheck: false }
            ))
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
          this.result.should.equal(this.user)
        })

        it('should send metrics', function () {
          expect(
            this.metrics.inc.calledWith('check-password', { status: 'success' })
          ).to.equal(true)
        })
      })

      describe('when the encrypted passwords do not match', function () {
        beforeEach(async function () {
          ;({ user: this.result } =
            await this.AuthenticationManager.promises.authenticate(
              { email: this.email },
              'notthecorrectpassword',
              null,
              { enforceHIBPCheck: false }
            ))
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
          expect(this.result).to.equal(null)
        })
      })

      describe('when another request runs in parallel', function () {
        beforeEach(function () {
          this.User.updateOne = sinon
            .stub()
            .returns({ exec: sinon.stub().resolves({ modifiedCount: 0 }) })
        })

        describe('correct password', function () {
          it('should return an error', async function () {
            await expect(
              this.AuthenticationManager.promises.authenticate(
                { email: this.email },
                'testpassword',
                null,
                { enforceHIBPCheck: false }
              )
            ).to.be.rejectedWith(AuthenticationErrors.ParallelLoginError)
          })
        })

        describe('bad password', function () {
          beforeEach(function () {
            this.User.updateOne = sinon
              .stub()
              .returns({ exec: sinon.stub().resolves({ modifiedCount: 0 }) })
          })
          it('should return an error', async function () {
            await expect(
              this.AuthenticationManager.promises.authenticate(
                { email: this.email },
                'notthecorrectpassword',
                null,
                { enforceHIBPCheck: false }
              )
            ).to.be.rejectedWith(AuthenticationErrors.ParallelLoginError)
          })
        })
      })
    })

    describe('setUserPasswordInV2', function () {
      beforeEach(function () {
        this.user = {
          _id: '5c8791477192a80b5e76ca7e',
          email: (this.email = 'USER@overleaf.com'),
        }
        this.db.users.updateOne = sinon
        this.User.findOne = sinon
          .stub()
          .returns({ exec: sinon.stub().resolves(this.user) })
        this.bcrypt.compare = sinon.stub().resolves(false)
        this.db.users.updateOne = sinon.stub().resolves({ modifiedCount: 1 })
      })

      it('should not produce an error', async function () {
        const updated =
          await this.AuthenticationManager.promises.setUserPasswordInV2(
            this.user,
            'testpassword'
          )
        expect(updated).to.equal(true)
      })

      it('should set the hashed password', async function () {
        await this.AuthenticationManager.promises.setUserPasswordInV2(
          this.user,
          'testpassword'
        )

        const { hashedPassword } = this.db.users.updateOne.lastCall.args[1].$set
        expect(hashedPassword).to.exist
        expect(hashedPassword.length).to.equal(60)
        expect(hashedPassword).to.match(/^\$2a\$04\$[a-zA-Z0-9/.]{53}$/)
      })
    })
  })

  describe('hashPassword', function () {
    it('should block too long passwords', async function () {
      await expect(
        this.AuthenticationManager.promises.hashPassword('x'.repeat(100))
      ).to.be.rejectedWith('password is too long')
    })
  })

  describe('authenticate', function () {
    describe('when the user exists in the database', function () {
      beforeEach(function () {
        this.user = {
          _id: 'user-id',
          email: (this.email = 'USER@overleaf.com'),
        }
        this.unencryptedPassword = 'banana'
        this.User.findOne = sinon
          .stub()
          .returns({ exec: sinon.stub().resolves(this.user) })
        this.metrics.inc.reset()
      })

      describe('when the hashed password matches', function () {
        beforeEach(async function () {
          this.user.hashedPassword = this.hashedPassword = 'asdfjadflasdf'
          this.bcrypt.compare = sinon.stub().resolves(true)
          this.bcrypt.getRounds = sinon.stub().returns(4)
          ;({ user: this.result } =
            await this.AuthenticationManager.promises.authenticate(
              { email: this.email },
              this.unencryptedPassword,
              null,
              { enforceHIBPCheck: false }
            ))
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
          this.result.should.equal(this.user)
        })

        describe('HIBP', function () {
          it('should enforce HIBP if requested', async function () {
            this.HaveIBeenPwned.promises.checkPasswordForReuse.resolves(true)

            await expect(
              this.AuthenticationManager.promises.authenticate(
                { email: this.email },
                this.unencryptedPassword,
                null,
                { enforceHIBPCheck: true }
              )
            ).to.be.rejectedWith(AuthenticationErrors.PasswordReusedError)
          })

          it('should check but not enforce HIBP if not requested', async function () {
            this.HaveIBeenPwned.promises.checkPasswordForReuse.resolves(true)

            const { user } =
              await this.AuthenticationManager.promises.authenticate(
                { email: this.email },
                this.unencryptedPassword,
                null,
                { enforceHIBPCheck: false }
              )

            this.HaveIBeenPwned.promises.checkPasswordForReuse.should.have.been.calledWith(
              this.unencryptedPassword
            )
            expect(user).to.equal(this.user)
          })

          it('should report password reused when check not enforced', async function () {
            this.HaveIBeenPwned.promises.checkPasswordForReuse.resolves(true)

            const { isPasswordReused } =
              await this.AuthenticationManager.promises.authenticate(
                { email: this.email },
                this.unencryptedPassword,
                null,
                { enforceHIBPCheck: false }
              )

            expect(isPasswordReused).to.equal(true)
          })

          it('should report password not reused when check not enforced', async function () {
            this.HaveIBeenPwned.promises.checkPasswordForReuse.resolves(false)

            const { isPasswordReused } =
              await this.AuthenticationManager.promises.authenticate(
                { email: this.email },
                this.unencryptedPassword,
                null,
                { enforceHIBPCheck: false }
              )

            expect(isPasswordReused).to.equal(false)
          })
        })
      })

      describe('when the encrypted passwords do not match', function () {
        beforeEach(async function () {
          this.user.hashedPassword = this.hashedPassword = 'asdfjadflasdf'
          this.bcrypt.compare = sinon.stub().resolves(false)
          ;({ user: this.result } =
            await this.AuthenticationManager.promises.authenticate(
              { email: this.email },
              this.unencryptedPassword,
              null,
              { enforceHIBPCheck: false }
            ))
        })

        it('should not return the user', function () {
          expect(this.result).to.equal(null)
          this.UserAuditLogHandler.promises.addEntry.callCount.should.equal(0)
        })
      })

      describe('when the encrypted passwords do not match, with auditLog', function () {
        beforeEach(async function () {
          this.user.hashedPassword = this.hashedPassword = 'asdfjadflasdf'
          this.bcrypt.compare = sinon.stub().resolves(false)
          this.auditLog = { ipAddress: 'ip', info: { method: 'foo' } }
          ;({ user: this.result } =
            await this.AuthenticationManager.promises.authenticate(
              { email: this.email },
              this.unencryptedPassword,
              this.auditLog,
              { enforceHIBPCheck: false }
            ))
        })

        it('should not return the user, but add entry to audit log', function () {
          expect(this.result).to.equal(null)
          this.UserAuditLogHandler.promises.addEntry.callCount.should.equal(1)
          this.UserAuditLogHandler.promises.addEntry
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
        beforeEach(async function () {
          this.user.hashedPassword = this.hashedPassword = 'asdfjadflasdf'
          this.bcrypt.compare = sinon.stub().resolves(true)
          this.bcrypt.getRounds = sinon.stub().returns(1)
          this.AuthenticationManager.promises._setUserPasswordInMongo = sinon
            .stub()
            .resolves()
          ;({ user: this.result } =
            await this.AuthenticationManager.promises.authenticate(
              { email: this.email },
              this.unencryptedPassword,
              null,
              { enforceHIBPCheck: false }
            ))
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
          expect(this.metrics.inc).to.have.been.calledWith(
            'bcrypt_check_rounds',
            1,
            { status: 'upgrade' }
          )
        })

        it('should set the users password (with a higher number of rounds)', function () {
          this.AuthenticationManager.promises._setUserPasswordInMongo
            .calledWith(this.user, this.unencryptedPassword)
            .should.equal(true)
        })

        it('should return the user', function () {
          this.result.should.equal(this.user)
        })
      })

      describe('when the hashed password matches but the number of rounds is too low, but upgrades disabled', function () {
        beforeEach(async function () {
          this.settings.security.disableBcryptRoundsUpgrades = true
          this.user.hashedPassword = this.hashedPassword = 'asdfjadflasdf'
          this.bcrypt.compare = sinon.stub().resolves(true)
          this.bcrypt.getRounds = sinon.stub().returns(1)
          this.AuthenticationManager.promises.setUserPassword = sinon
            .stub()
            .resolves()
          ;({ user: this.result } =
            await this.AuthenticationManager.promises.authenticate(
              { email: this.email },
              this.unencryptedPassword,
              null,
              { enforceHIBPCheck: false }
            ))
        })

        it('should not check the number of rounds', function () {
          expect(this.metrics.inc).to.have.been.calledWith(
            'bcrypt_check_rounds',
            1,
            { status: 'disabled' }
          )
        })

        it('should not set the users password (with a higher number of rounds)', function () {
          this.AuthenticationManager.promises.setUserPassword
            .calledWith(this.user, this.unencryptedPassword)
            .should.equal(false)
        })

        it('should return the user', function () {
          this.result.should.equal(this.user)
        })
      })
    })

    describe('when the user does not exist in the database', function () {
      beforeEach(async function () {
        this.User.findOne = sinon
          .stub()
          .returns({ exec: sinon.stub().resolves(null) })
        ;({ user: this.result } =
          await this.AuthenticationManager.promises.authenticate(
            { email: this.email },
            this.unencrpytedPassword,
            null,
            { enforceHIBPCheck: false }
          ))
      })

      it('should not return a user', function () {
        expect(this.result).to.equal(null)
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
      this.user_id = new ObjectId()
      this.password = 'bananagram'
      this.hashedPassword = 'asdkjfa;osiuvandf'
      this.salt = 'saltaasdfasdfasdf'
      this.user = {
        _id: this.user_id,
        email: 'user@example.com',
        hashedPassword: this.hashedPassword,
      }
      this.bcrypt.compare = sinon.stub().resolves(false)
      this.bcrypt.genSalt = sinon.stub().resolves(this.salt)
      this.bcrypt.hash = sinon.stub().resolves(this.hashedPassword)
      this.User.findOne = sinon
        .stub()
        .returns({ exec: sinon.stub().resolves(this.user) })
      this.db.users.updateOne = sinon.stub().resolves()
    })

    describe('same as previous password', function () {
      beforeEach(function () {
        this.bcrypt.compare.resolves(true)
      })

      it('should be rejected', async function () {
        await expect(
          this.AuthenticationManager.promises.setUserPassword(
            this.user,
            this.password
          )
        ).to.be.rejectedWith(AuthenticationErrors.PasswordMustBeDifferentError)
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

      it('should return and error', async function () {
        await expect(
          this.AuthenticationManager.promises.setUserPassword(
            this.user,
            this.password
          )
        ).to.be.rejectedWith('password is too long')
      })

      it('should not start the bcrypt process', async function () {
        await expect(
          this.AuthenticationManager.promises.setUserPassword(
            this.user,
            this.password
          )
        ).to.be.rejected

        this.bcrypt.genSalt.called.should.equal(false)
        this.bcrypt.hash.called.should.equal(false)
      })
    })

    describe('contains full email', function () {
      beforeEach(function () {
        this.password = `some${this.user.email}password`
      })

      it('should reject the password', async function () {
        await expect(
          this.AuthenticationManager.promises.setUserPassword(
            this.user,
            this.password
          )
        ).to.be.rejectedWith(AuthenticationErrors.InvalidPasswordError)
      })
    })

    describe('contains first part of email', function () {
      beforeEach(function () {
        this.password = `some${this.user.email.split('@')[0]}password`
      })

      it('should reject the password', async function () {
        await expect(
          this.AuthenticationManager.promises.setUserPassword(
            this.user,
            this.password
          )
        ).to.be.rejectedWith(AuthenticationErrors.InvalidPasswordError)
      })
    })

    describe('email contains password', function () {
      let user, password
      beforeEach(function () {
        password = 'somedomain'
        user = { _id: 'some-user-id', email: 'someuser@somedomain.com' }
      })

      it('should reject the password', async function () {
        try {
          await this.AuthenticationManager.promises.setUserPassword(
            user,
            password
          )
          expect.fail('should have thrown')
        } catch (err) {
          expect(err.name).to.equal('InvalidPasswordError')
          expect(err?.info?.code).to.equal('contains_email')
        }
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

      it('should return and error', async function () {
        await expect(
          this.AuthenticationManager.promises.setUserPassword(
            this.user,
            this.password
          )
        ).to.be.rejectedWith('password is too short')
      })

      it('should not start the bcrypt process', async function () {
        await expect(
          this.AuthenticationManager.promises.setUserPassword(
            this.user,
            this.password
          )
        ).to.be.rejected

        this.bcrypt.genSalt.called.should.equal(false)
        this.bcrypt.hash.called.should.equal(false)
      })
    })

    describe('password too similar to email', function () {
      beforeEach(function () {
        this.user.email = 'foobarbazquux@example.com'
        this.password = 'foo21barbaz'
        this.metrics.inc.reset()
      })

      it('should produce an error when the password is too similar to the email', async function () {
        try {
          await this.AuthenticationManager.promises.setUserPassword(
            this.user,
            this.password
          )
          expect.fail('should have thrown')
        } catch (err) {
          expect(err.message).to.equal(
            'password is too similar to email address'
          )
          expect(err?.info?.code).to.equal('too_similar')
        }

        expect(
          this.metrics.inc.calledWith('password-too-similar-to-email')
        ).to.equal(true)
      })

      it('should produce an error when the password is too similar to the email, regardless of case', async function () {
        try {
          await this.AuthenticationManager.promises.setUserPassword(
            this.user,
            this.password.toUpperCase()
          )
          expect.fail('should have thrown')
        } catch (err) {
          expect(err.message).to.equal(
            'password is too similar to email address'
          )
          expect(err?.info?.code).to.equal('too_similar')
        }

        expect(
          this.metrics.inc.calledWith('password-too-similar-to-email')
        ).to.equal(true)
      })
    })

    describe('successful password set attempt', function () {
      beforeEach(async function () {
        this.metrics.inc.reset()
        this.UserGetter.promises.getUser = sinon
          .stub()
          .resolves({ overleaf: null })
        await this.AuthenticationManager.promises.setUserPassword(
          this.user,
          this.password
        )
      })

      it("should update the user's password in the database", function () {
        const { args } = this.db.users.updateOne.lastCall
        expect(args[0]).to.deep.equal({
          _id: new ObjectId(this.user_id.toString()),
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
    })
  })
})
