import { vi, expect } from 'vitest'
import sinon from 'sinon'
import mongodb from 'mongodb-legacy'
import AuthenticationErrors from '../../../../app/src/Features/Authentication/AuthenticationErrors.mjs'
import tk from 'timekeeper'
import bcrypt from 'bcrypt'

const { ObjectId } = mongodb

const modulePath =
  '../../../../app/src/Features/Authentication/AuthenticationManager.mjs'

describe('AuthenticationManager', function () {
  beforeEach(async function (ctx) {
    tk.freeze(Date.now())
    ctx.settings = { security: { bcryptRounds: 4 } }
    ctx.metrics = { inc: sinon.stub().returns() }
    ctx.HaveIBeenPwned = {
      promises: {
        checkPasswordForReuse: sinon.stub().resolves(false),
      },
      checkPasswordForReuseInBackground: sinon.stub(),
    }

    vi.doMock('../../../../app/src/models/User', () => ({
      User: (ctx.User = {
        updateOne: sinon
          .stub()
          .returns({ exec: sinon.stub().resolves({ modifiedCount: 1 }) }),
      }),
    }))

    vi.doMock('../../../../app/src/infrastructure/mongodb', () => ({
      db: (ctx.db = { users: {} }),
      ObjectId,
    }))

    vi.doMock('bcrypt', () => ({
      default: (ctx.bcrypt = {
        getRounds: sinon.stub().returns(4),
      }),
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    ctx.UserGetter = { promises: {} }

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock(
      '../../../../app/src/Features/Authentication/AuthenticationErrors',
      () => ({
        ...AuthenticationErrors,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Authentication/HaveIBeenPwned',
      () => ({
        default: ctx.HaveIBeenPwned,
      })
    )

    vi.doMock('../../../../app/src/Features/User/UserAuditLogHandler', () => ({
      default: (ctx.UserAuditLogHandler = {
        promises: {
          addEntry: sinon.stub().resolves(null),
        },
      }),
    }))

    vi.doMock('@overleaf/metrics', () => ({
      default: ctx.metrics,
    }))

    ctx.AuthenticationManager = (await import(modulePath)).default
  })

  afterEach(function () {
    tk.reset()
  })

  describe('with real bcrypt', function () {
    beforeEach(function (ctx) {
      ctx.bcrypt.compare = bcrypt.compare
      ctx.bcrypt.getRounds = bcrypt.getRounds
      ctx.bcrypt.genSalt = bcrypt.genSalt
      ctx.bcrypt.hash = bcrypt.hash
      // Hash of 'testpassword'
      ctx.testPassword =
        '$2a$04$DcU/3UeJf1PfsWlQL./5H.rGTQL1Z1iyz6r7bN9Do8cy6pVWxpKpK'
    })

    describe('authenticate', function () {
      beforeEach(function (ctx) {
        ctx.user = {
          _id: 'user-id',
          email: (ctx.email = 'USER@overleaf.com'),
        }
        ctx.user.hashedPassword = ctx.testPassword
        ctx.User.findOne = sinon
          .stub()
          .returns({ exec: sinon.stub().resolves(ctx.user) })
        ctx.metrics.inc.reset()
      })

      describe('when the hashed password matches', function () {
        beforeEach(async function (ctx) {
          ctx.unencryptedPassword = 'testpassword'
          ;({ user: ctx.result } =
            await ctx.AuthenticationManager.promises.authenticate(
              { email: ctx.email },
              ctx.unencryptedPassword,
              null,
              { enforceHIBPCheck: false }
            ))
        })

        it('should look up the correct user in the database', function (ctx) {
          ctx.User.findOne.calledWith({ email: ctx.email }).should.equal(true)
        })

        it('should bump epoch', function (ctx) {
          ctx.User.updateOne.should.have.been.calledWith(
            {
              _id: ctx.user._id,
              loginEpoch: ctx.user.loginEpoch,
            },
            {
              $inc: { loginEpoch: 1 },
            },
            {}
          )
        })

        it('should return the user', function (ctx) {
          ctx.result.should.equal(ctx.user)
        })

        it('should send metrics', function (ctx) {
          expect(
            ctx.metrics.inc.calledWith('check-password', { status: 'success' })
          ).to.equal(true)
        })
      })

      describe('when the encrypted passwords do not match', function () {
        beforeEach(async function (ctx) {
          ;({ user: ctx.result } =
            await ctx.AuthenticationManager.promises.authenticate(
              { email: ctx.email },
              'notthecorrectpassword',
              null,
              { enforceHIBPCheck: false }
            ))
        })

        it('should persist the login failure and bump epoch', function (ctx) {
          ctx.User.updateOne.should.have.been.calledWith(
            {
              _id: ctx.user._id,
              loginEpoch: ctx.user.loginEpoch,
            },
            {
              $inc: { loginEpoch: 1 },
              $set: { lastFailedLogin: new Date() },
            }
          )
        })

        it('should not return the user', function (ctx) {
          expect(ctx.result).to.equal(null)
        })
      })

      describe('when another request runs in parallel', function () {
        beforeEach(function (ctx) {
          ctx.User.updateOne = sinon
            .stub()
            .returns({ exec: sinon.stub().resolves({ modifiedCount: 0 }) })
        })

        describe('correct password', function () {
          it('should return an error', async function (ctx) {
            await expect(
              ctx.AuthenticationManager.promises.authenticate(
                { email: ctx.email },
                'testpassword',
                null,
                { enforceHIBPCheck: false }
              )
            ).to.be.rejectedWith(AuthenticationErrors.ParallelLoginError)
          })
        })

        describe('bad password', function () {
          beforeEach(function (ctx) {
            ctx.User.updateOne = sinon
              .stub()
              .returns({ exec: sinon.stub().resolves({ modifiedCount: 0 }) })
          })
          it('should return an error', async function (ctx) {
            await expect(
              ctx.AuthenticationManager.promises.authenticate(
                { email: ctx.email },
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
      beforeEach(function (ctx) {
        ctx.user = {
          _id: '5c8791477192a80b5e76ca7e',
          email: (ctx.email = 'USER@overleaf.com'),
        }
        ctx.db.users.updateOne = sinon
        ctx.User.findOne = sinon
          .stub()
          .returns({ exec: sinon.stub().resolves(ctx.user) })
        ctx.bcrypt.compare = sinon.stub().resolves(false)
        ctx.db.users.updateOne = sinon.stub().resolves({ modifiedCount: 1 })
      })

      it('should not produce an error', async function (ctx) {
        const updated =
          await ctx.AuthenticationManager.promises.setUserPasswordInV2(
            ctx.user,
            'testpassword'
          )
        expect(updated).to.equal(true)
      })

      it('should set the hashed password', async function (ctx) {
        await ctx.AuthenticationManager.promises.setUserPasswordInV2(
          ctx.user,
          'testpassword'
        )

        const { hashedPassword } = ctx.db.users.updateOne.lastCall.args[1].$set
        expect(hashedPassword).to.exist
        expect(hashedPassword.length).to.equal(60)
        expect(hashedPassword).to.match(/^\$2a\$04\$[a-zA-Z0-9/.]{53}$/)
      })
    })
  })

  describe('hashPassword', function () {
    it('should block too long passwords', async function (ctx) {
      await expect(
        ctx.AuthenticationManager.promises.hashPassword('x'.repeat(100))
      ).to.be.rejectedWith('password is too long')
    })
  })

  describe('authenticate', function () {
    describe('when the user exists in the database', function () {
      beforeEach(function (ctx) {
        ctx.user = {
          _id: 'user-id',
          email: (ctx.email = 'USER@overleaf.com'),
        }
        ctx.unencryptedPassword = 'banana'
        ctx.User.findOne = sinon
          .stub()
          .returns({ exec: sinon.stub().resolves(ctx.user) })
        ctx.metrics.inc.reset()
      })

      describe('when the hashed password matches', function () {
        beforeEach(async function (ctx) {
          ctx.user.hashedPassword = ctx.hashedPassword = 'asdfjadflasdf'
          ctx.bcrypt.compare = sinon.stub().resolves(true)
          ctx.bcrypt.getRounds = sinon.stub().returns(4)
          ;({ user: ctx.result } =
            await ctx.AuthenticationManager.promises.authenticate(
              { email: ctx.email },
              ctx.unencryptedPassword,
              null,
              { enforceHIBPCheck: false }
            ))
        })

        it('should look up the correct user in the database', function (ctx) {
          ctx.User.findOne.calledWith({ email: ctx.email }).should.equal(true)
        })

        it('should check that the passwords match', function (ctx) {
          ctx.bcrypt.compare
            .calledWith(ctx.unencryptedPassword, ctx.hashedPassword)
            .should.equal(true)
        })

        it('should send metrics', function (ctx) {
          expect(
            ctx.metrics.inc.calledWith('check-password', {
              status: 'too_short',
            })
          ).to.equal(true)
        })

        it('should return the user', function (ctx) {
          ctx.result.should.equal(ctx.user)
        })

        describe('HIBP', function () {
          it('should enforce HIBP if requested', async function (ctx) {
            ctx.HaveIBeenPwned.promises.checkPasswordForReuse.resolves(true)

            await expect(
              ctx.AuthenticationManager.promises.authenticate(
                { email: ctx.email },
                ctx.unencryptedPassword,
                null,
                { enforceHIBPCheck: true }
              )
            ).to.be.rejectedWith(AuthenticationErrors.PasswordReusedError)
          })

          it('should check but not enforce HIBP if not requested', async function (ctx) {
            ctx.HaveIBeenPwned.promises.checkPasswordForReuse.resolves(true)

            const { user } =
              await ctx.AuthenticationManager.promises.authenticate(
                { email: ctx.email },
                ctx.unencryptedPassword,
                null,
                { enforceHIBPCheck: false }
              )

            ctx.HaveIBeenPwned.promises.checkPasswordForReuse.should.have.been.calledWith(
              ctx.unencryptedPassword
            )
            expect(user).to.equal(ctx.user)
          })

          it('should report password reused when check not enforced', async function (ctx) {
            ctx.HaveIBeenPwned.promises.checkPasswordForReuse.resolves(true)

            const { isPasswordReused } =
              await ctx.AuthenticationManager.promises.authenticate(
                { email: ctx.email },
                ctx.unencryptedPassword,
                null,
                { enforceHIBPCheck: false }
              )

            expect(isPasswordReused).to.equal(true)
          })

          it('should report password not reused when check not enforced', async function (ctx) {
            ctx.HaveIBeenPwned.promises.checkPasswordForReuse.resolves(false)

            const { isPasswordReused } =
              await ctx.AuthenticationManager.promises.authenticate(
                { email: ctx.email },
                ctx.unencryptedPassword,
                null,
                { enforceHIBPCheck: false }
              )

            expect(isPasswordReused).to.equal(false)
          })
        })
      })

      describe('when the encrypted passwords do not match', function () {
        beforeEach(async function (ctx) {
          ctx.user.hashedPassword = ctx.hashedPassword = 'asdfjadflasdf'
          ctx.bcrypt.compare = sinon.stub().resolves(false)
          ;({ user: ctx.result } =
            await ctx.AuthenticationManager.promises.authenticate(
              { email: ctx.email },
              ctx.unencryptedPassword,
              null,
              { enforceHIBPCheck: false }
            ))
        })

        it('should not return the user', function (ctx) {
          expect(ctx.result).to.equal(null)
          ctx.UserAuditLogHandler.promises.addEntry.callCount.should.equal(0)
        })
      })

      describe('when the encrypted passwords do not match, with auditLog', function () {
        beforeEach(async function (ctx) {
          ctx.user.hashedPassword = ctx.hashedPassword = 'asdfjadflasdf'
          ctx.bcrypt.compare = sinon.stub().resolves(false)
          ctx.auditLog = { ipAddress: 'ip', info: { method: 'foo' } }
          ;({ user: ctx.result } =
            await ctx.AuthenticationManager.promises.authenticate(
              { email: ctx.email },
              ctx.unencryptedPassword,
              ctx.auditLog,
              { enforceHIBPCheck: false }
            ))
        })

        it('should not return the user, but add entry to audit log', function (ctx) {
          expect(ctx.result).to.equal(null)
          ctx.UserAuditLogHandler.promises.addEntry.callCount.should.equal(1)
          ctx.UserAuditLogHandler.promises.addEntry
            .calledWith(
              ctx.user._id,
              'failed-password-match',
              ctx.user._id,
              ctx.auditLog.ipAddress,
              ctx.auditLog.info
            )
            .should.equal(true)
        })
      })

      describe('when the hashed password matches but the number of rounds is too low', function () {
        beforeEach(async function (ctx) {
          ctx.user.hashedPassword = ctx.hashedPassword = 'asdfjadflasdf'
          ctx.bcrypt.compare = sinon.stub().resolves(true)
          ctx.bcrypt.getRounds = sinon.stub().returns(1)
          ctx.AuthenticationManager.promises._setUserPasswordInMongo = sinon
            .stub()
            .resolves()
          ;({ user: ctx.result } =
            await ctx.AuthenticationManager.promises.authenticate(
              { email: ctx.email },
              ctx.unencryptedPassword,
              null,
              { enforceHIBPCheck: false }
            ))
        })

        it('should look up the correct user in the database', function (ctx) {
          ctx.User.findOne.calledWith({ email: ctx.email }).should.equal(true)
        })

        it('should check that the passwords match', function (ctx) {
          ctx.bcrypt.compare
            .calledWith(ctx.unencryptedPassword, ctx.hashedPassword)
            .should.equal(true)
        })

        it('should check the number of rounds', function (ctx) {
          expect(ctx.metrics.inc).to.have.been.calledWith(
            'bcrypt_check_rounds',
            1,
            { status: 'upgrade' }
          )
        })

        it('should set the users password (with a higher number of rounds)', function (ctx) {
          ctx.AuthenticationManager.promises._setUserPasswordInMongo
            .calledWith(ctx.user, ctx.unencryptedPassword)
            .should.equal(true)
        })

        it('should return the user', function (ctx) {
          ctx.result.should.equal(ctx.user)
        })
      })

      describe('when the hashed password matches but the number of rounds is too low, but upgrades disabled', function () {
        beforeEach(async function (ctx) {
          ctx.settings.security.disableBcryptRoundsUpgrades = true
          ctx.user.hashedPassword = ctx.hashedPassword = 'asdfjadflasdf'
          ctx.bcrypt.compare = sinon.stub().resolves(true)
          ctx.bcrypt.getRounds = sinon.stub().returns(1)
          ctx.AuthenticationManager.promises.setUserPassword = sinon
            .stub()
            .resolves()
          ;({ user: ctx.result } =
            await ctx.AuthenticationManager.promises.authenticate(
              { email: ctx.email },
              ctx.unencryptedPassword,
              null,
              { enforceHIBPCheck: false }
            ))
        })

        it('should not check the number of rounds', function (ctx) {
          expect(ctx.metrics.inc).to.have.been.calledWith(
            'bcrypt_check_rounds',
            1,
            { status: 'disabled' }
          )
        })

        it('should not set the users password (with a higher number of rounds)', function (ctx) {
          ctx.AuthenticationManager.promises.setUserPassword
            .calledWith(ctx.user, ctx.unencryptedPassword)
            .should.equal(false)
        })

        it('should return the user', function (ctx) {
          ctx.result.should.equal(ctx.user)
        })
      })
    })

    describe('when the user does not exist in the database', function () {
      beforeEach(async function (ctx) {
        ctx.User.findOne = sinon
          .stub()
          .returns({ exec: sinon.stub().resolves(null) })
        ;({ user: ctx.result } =
          await ctx.AuthenticationManager.promises.authenticate(
            { email: ctx.email },
            ctx.unencrpytedPassword,
            null,
            { enforceHIBPCheck: false }
          ))
      })

      it('should not return a user', function (ctx) {
        expect(ctx.result).to.equal(null)
      })
    })
  })

  describe('validateEmail', function () {
    describe('valid', function () {
      it('should return null', function (ctx) {
        const result =
          ctx.AuthenticationManager.validateEmail('foo@example.com')
        expect(result).to.equal(null)
      })
    })

    describe('invalid', function () {
      it('should return validation error object for no email', function (ctx) {
        const result = ctx.AuthenticationManager.validateEmail('')
        expect(result).to.an.instanceOf(AuthenticationErrors.InvalidEmailError)
        expect(result.message).to.equal('email not valid')
      })

      it('should return validation error object for invalid', function (ctx) {
        const result = ctx.AuthenticationManager.validateEmail('notanemail')
        expect(result).to.be.an.instanceOf(
          AuthenticationErrors.InvalidEmailError
        )
        expect(result.message).to.equal('email not valid')
      })
    })
  })

  describe('validatePassword', function () {
    beforeEach(function (ctx) {
      // 73 characters:
      ctx.longPassword =
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef012345678'
    })

    describe('with a null password', function () {
      it('should return an error', function (ctx) {
        const result = ctx.AuthenticationManager.validatePassword()

        expect(result).to.be.an.instanceOf(
          AuthenticationErrors.InvalidPasswordError
        )
        expect(result.message).to.equal('password not set')
        expect(result.info.code).to.equal('not_set')
      })
    })

    describe('password length', function () {
      describe('with the default password length options', function () {
        beforeEach(function (ctx) {
          ctx.metrics.inc.reset()
        })

        it('should send a metric', function (ctx) {
          ctx.AuthenticationManager.validatePassword('foo')
          expect(ctx.metrics.inc.calledWith('try-validate-password')).to.equal(
            true
          )
        })

        it('should reject passwords that are too short', function (ctx) {
          const result1 = ctx.AuthenticationManager.validatePassword('')
          expect(result1).to.be.an.instanceOf(
            AuthenticationErrors.InvalidPasswordError
          )
          expect(result1.message).to.equal('password is too short')
          expect(result1.info.code).to.equal('too_short')

          const result2 = ctx.AuthenticationManager.validatePassword('foo')
          expect(result2).to.be.an.instanceOf(
            AuthenticationErrors.InvalidPasswordError
          )
          expect(result2.message).to.equal('password is too short')
          expect(result2.info.code).to.equal('too_short')
        })

        it('should reject passwords that are too long', function (ctx) {
          const result = ctx.AuthenticationManager.validatePassword(
            ctx.longPassword
          )

          expect(result).to.be.an.instanceOf(
            AuthenticationErrors.InvalidPasswordError
          )
          expect(result.message).to.equal('password is too long')
          expect(result.info.code).to.equal('too_long')
        })

        it('should accept passwords that are a good length', function (ctx) {
          expect(
            ctx.AuthenticationManager.validatePassword('l337h4x0r')
          ).to.equal(null)
        })
      })

      describe('when the password length is specified in settings', function () {
        beforeEach(function (ctx) {
          ctx.settings.passwordStrengthOptions = {
            length: {
              min: 10,
              max: 12,
            },
          }
        })

        it('should reject passwords that are too short', function (ctx) {
          const result = ctx.AuthenticationManager.validatePassword('012345678')

          expect(result).to.be.an.instanceOf(
            AuthenticationErrors.InvalidPasswordError
          )
          expect(result.message).to.equal('password is too short')
          expect(result.info.code).to.equal('too_short')
        })

        it('should accept passwords of exactly minimum length', function (ctx) {
          expect(
            ctx.AuthenticationManager.validatePassword('0123456789')
          ).to.equal(null)
        })

        it('should reject passwords that are too long', function (ctx) {
          const result =
            ctx.AuthenticationManager.validatePassword('0123456789abc')

          expect(result).to.be.an.instanceOf(
            AuthenticationErrors.InvalidPasswordError
          )
          expect(result.message).to.equal('password is too long')
          expect(result.info.code).to.equal('too_long')
        })

        it('should accept passwords of exactly maximum length', function (ctx) {
          expect(
            ctx.AuthenticationManager.validatePassword('0123456789ab')
          ).to.equal(null)
        })
      })

      describe('when the maximum password length is set to >72 characters in settings', function () {
        beforeEach(function (ctx) {
          ctx.settings.passwordStrengthOptions = {
            length: {
              max: 128,
            },
          }
        })

        it('should still reject passwords > 72 characters in length', function (ctx) {
          const result = ctx.AuthenticationManager.validatePassword(
            ctx.longPassword
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
        it('should allow passwords with valid characters', function (ctx) {
          expect(
            ctx.AuthenticationManager.validatePassword(
              'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
            )
          ).to.equal(null)
          expect(
            ctx.AuthenticationManager.validatePassword(
              '1234567890@#$%^&*()-_=+[]{};:<>/?!£€.,'
            )
          ).to.equal(null)
        })

        it('should not allow passwords with invalid characters', function (ctx) {
          const result = ctx.AuthenticationManager.validatePassword(
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
        beforeEach(function (ctx) {
          ctx.settings.passwordStrengthOptions = {
            chars: {
              symbols: ' ',
            },
          }
        })

        it('should allow passwords with valid characters', function (ctx) {
          expect(
            ctx.AuthenticationManager.validatePassword(
              'correct horse battery staple'
            )
          ).to.equal(null)
        })

        it('should disallow passwords with invalid characters', function (ctx) {
          const result = ctx.AuthenticationManager.validatePassword(
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
        beforeEach(function (ctx) {
          ctx.settings.passwordStrengthOptions = {
            allowAnyChars: true,
          }
        })

        it('should allow any characters', function (ctx) {
          expect(
            ctx.AuthenticationManager.validatePassword(
              'correct horse battery staple'
            )
          ).to.equal(null)
          expect(
            ctx.AuthenticationManager.validatePassword(
              '1234567890@#$%^&*()-_=+[]{};:<>/?!£€.,'
            )
          ).to.equal(null)
        })
      })
    })
  })

  describe('_validatePasswordNotTooSimilar', function () {
    beforeEach(function (ctx) {
      ctx.metrics.inc.reset()
    })

    it('should return an error when the password is too similar to email', function (ctx) {
      const password = '12someuser34'
      const email = 'someuser@example.com'
      const error = ctx.AuthenticationManager._validatePasswordNotTooSimilar(
        password,
        email
      )
      expect(error).to.exist
    })

    it('should return an error when the password is re-arranged elements of the email', function (ctx) {
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
        const error = ctx.AuthenticationManager._validatePasswordNotTooSimilar(
          password,
          email
        )
        expect(error).to.exist
      }
    })

    it('should return nothing when the password different from email', function (ctx) {
      const password = '58WyLvr'
      const email = 'someuser@example.com'
      const error = ctx.AuthenticationManager._validatePasswordNotTooSimilar(
        password,
        email
      )
      expect(error).to.not.exist
    })

    it('should return nothing when the password is much longer than parts of the email', function (ctx) {
      const password = new Array(30).fill('a').join('')
      const email = 'a@cd.com'
      const error = ctx.AuthenticationManager._validatePasswordNotTooSimilar(
        password,
        email
      )
      expect(error).to.not.exist
    })
  })

  describe('setUserPassword', function () {
    beforeEach(function (ctx) {
      ctx.user_id = new ObjectId()
      ctx.password = 'bananagram'
      ctx.hashedPassword = 'asdkjfa;osiuvandf'
      ctx.salt = 'saltaasdfasdfasdf'
      ctx.user = {
        _id: ctx.user_id,
        email: 'user@example.com',
        hashedPassword: ctx.hashedPassword,
      }
      ctx.bcrypt.compare = sinon.stub().resolves(false)
      ctx.bcrypt.genSalt = sinon.stub().resolves(ctx.salt)
      ctx.bcrypt.hash = sinon.stub().resolves(ctx.hashedPassword)
      ctx.User.findOne = sinon
        .stub()
        .returns({ exec: sinon.stub().resolves(ctx.user) })
      ctx.db.users.updateOne = sinon.stub().resolves()
    })

    describe('same as previous password', function () {
      beforeEach(function (ctx) {
        ctx.bcrypt.compare.resolves(true)
      })

      it('should be rejected', async function (ctx) {
        await expect(
          ctx.AuthenticationManager.promises.setUserPassword(
            ctx.user,
            ctx.password
          )
        ).to.be.rejectedWith(AuthenticationErrors.PasswordMustBeDifferentError)
      })
    })

    describe('too long', function () {
      beforeEach(function (ctx) {
        ctx.settings.passwordStrengthOptions = {
          length: {
            max: 10,
          },
        }
        ctx.password = 'dsdsadsadsadsadsadkjsadjsadjsadljs'
      })

      it('should return and error', async function (ctx) {
        await expect(
          ctx.AuthenticationManager.promises.setUserPassword(
            ctx.user,
            ctx.password
          )
        ).to.be.rejectedWith('password is too long')
      })

      it('should not start the bcrypt process', async function (ctx) {
        await expect(
          ctx.AuthenticationManager.promises.setUserPassword(
            ctx.user,
            ctx.password
          )
        ).to.be.rejected

        ctx.bcrypt.genSalt.called.should.equal(false)
        ctx.bcrypt.hash.called.should.equal(false)
      })
    })

    describe('contains full email', function () {
      beforeEach(function (ctx) {
        ctx.password = `some${ctx.user.email}password`
      })

      it('should reject the password', async function (ctx) {
        await expect(
          ctx.AuthenticationManager.promises.setUserPassword(
            ctx.user,
            ctx.password
          )
        ).to.be.rejectedWith(AuthenticationErrors.InvalidPasswordError)
      })
    })

    describe('contains first part of email', function () {
      beforeEach(function (ctx) {
        ctx.password = `some${ctx.user.email.split('@')[0]}password`
      })

      it('should reject the password', async function (ctx) {
        await expect(
          ctx.AuthenticationManager.promises.setUserPassword(
            ctx.user,
            ctx.password
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

      it('should reject the password', async function (ctx) {
        try {
          await ctx.AuthenticationManager.promises.setUserPassword(
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
      beforeEach(function (ctx) {
        ctx.settings.passwordStrengthOptions = {
          length: {
            max: 10,
            min: 6,
          },
        }
        ctx.password = 'dsd'
      })

      it('should return and error', async function (ctx) {
        await expect(
          ctx.AuthenticationManager.promises.setUserPassword(
            ctx.user,
            ctx.password
          )
        ).to.be.rejectedWith('password is too short')
      })

      it('should not start the bcrypt process', async function (ctx) {
        await expect(
          ctx.AuthenticationManager.promises.setUserPassword(
            ctx.user,
            ctx.password
          )
        ).to.be.rejected

        ctx.bcrypt.genSalt.called.should.equal(false)
        ctx.bcrypt.hash.called.should.equal(false)
      })
    })

    describe('password too similar to email', function () {
      beforeEach(function (ctx) {
        ctx.user.email = 'foobarbazquux@example.com'
        ctx.password = 'foo21barbaz'
        ctx.metrics.inc.reset()
      })

      it('should produce an error when the password is too similar to the email', async function (ctx) {
        try {
          await ctx.AuthenticationManager.promises.setUserPassword(
            ctx.user,
            ctx.password
          )
          expect.fail('should have thrown')
        } catch (err) {
          expect(err.message).to.equal(
            'password is too similar to email address'
          )
          expect(err?.info?.code).to.equal('too_similar')
        }

        expect(
          ctx.metrics.inc.calledWith('password-too-similar-to-email')
        ).to.equal(true)
      })

      it('should produce an error when the password is too similar to the email, regardless of case', async function (ctx) {
        try {
          await ctx.AuthenticationManager.promises.setUserPassword(
            ctx.user,
            ctx.password.toUpperCase()
          )
          expect.fail('should have thrown')
        } catch (err) {
          expect(err.message).to.equal(
            'password is too similar to email address'
          )
          expect(err?.info?.code).to.equal('too_similar')
        }

        expect(
          ctx.metrics.inc.calledWith('password-too-similar-to-email')
        ).to.equal(true)
      })
    })

    describe('successful password set attempt', function () {
      beforeEach(async function (ctx) {
        ctx.metrics.inc.reset()
        ctx.UserGetter.promises.getUser = sinon
          .stub()
          .resolves({ overleaf: null })
        await ctx.AuthenticationManager.promises.setUserPassword(
          ctx.user,
          ctx.password
        )
      })

      it("should update the user's password in the database", function (ctx) {
        const { args } = ctx.db.users.updateOne.lastCall
        expect(args[0]).to.deep.equal({
          _id: new ObjectId(ctx.user_id.toString()),
        })
        expect(args[1]).to.deep.equal({
          $set: {
            hashedPassword: ctx.hashedPassword,
          },
          $unset: {
            password: true,
          },
        })
      })

      it('should hash the password', function (ctx) {
        ctx.bcrypt.genSalt.calledWith(4).should.equal(true)
        ctx.bcrypt.hash.calledWith(ctx.password, ctx.salt).should.equal(true)
      })

      it('should not send a metric for password-too-similar-to-email', function (ctx) {
        expect(
          ctx.metrics.inc.calledWith('password-too-similar-to-email')
        ).to.equal(false)
      })
    })
  })
})
