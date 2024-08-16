const SandboxedModule = require('sandboxed-module')
const path = require('path')
const sinon = require('sinon')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/Security/OneTimeTokenHandler'
)
const Errors = require('../../../../app/src/Features/Errors/Errors')
const tk = require('timekeeper')
const { expect } = require('chai')

describe('OneTimeTokenHandler', function () {
  beforeEach(function () {
    tk.freeze(Date.now()) // freeze the time for these tests
    this.stubbedToken = 'mock-token'
    this.callback = sinon.stub()
    this.OneTimeTokenHandler = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': this.settings,
        crypto: {
          randomBytes: () => this.stubbedToken,
        },
        '../../infrastructure/mongodb': {
          db: (this.db = { tokens: {} }),
        },
      },
    })
  })

  afterEach(function () {
    tk.reset()
  })

  describe('getNewToken', function () {
    beforeEach(function () {
      this.db.tokens.insertOne = sinon.stub().yields()
    })

    describe('normally', function () {
      beforeEach(function () {
        this.OneTimeTokenHandler.getNewToken(
          'password',
          'mock-data-to-store',
          this.callback
        )
      })

      it('should insert a generated token with a 1 hour expiry', function () {
        this.db.tokens.insertOne
          .calledWith({
            use: 'password',
            token: this.stubbedToken,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
            data: 'mock-data-to-store',
          })
          .should.equal(true)
      })

      it('should call the callback with the token', function () {
        this.callback.calledWith(null, this.stubbedToken).should.equal(true)
      })
    })

    describe('with an optional expiresIn parameter', function () {
      beforeEach(function () {
        this.OneTimeTokenHandler.getNewToken(
          'password',
          'mock-data-to-store',
          { expiresIn: 42 },
          this.callback
        )
      })

      it('should insert a generated token with a custom expiry', function () {
        this.db.tokens.insertOne
          .calledWith({
            use: 'password',
            token: this.stubbedToken,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 42 * 1000),
            data: 'mock-data-to-store',
          })
          .should.equal(true)
      })

      it('should call the callback with the token', function () {
        this.callback.calledWith(null, this.stubbedToken).should.equal(true)
      })
    })
  })

  describe('peekValueFromToken', function () {
    describe('successfully', function () {
      const data = { email: 'some-mock-data' }
      let result
      beforeEach(async function () {
        this.db.tokens.findOneAndUpdate = sinon
          .stub()
          .resolves({ data, peekCount: 1 })
        result = await this.OneTimeTokenHandler.promises.peekValueFromToken(
          'password',
          'mock-token'
        )
      })

      it('should increment the peekCount', function () {
        this.db.tokens.findOneAndUpdate
          .calledWith(
            {
              use: 'password',
              token: 'mock-token',
              expiresAt: { $gt: new Date() },
              usedAt: { $exists: false },
              peekCount: { $not: { $gte: this.OneTimeTokenHandler.MAX_PEEKS } },
            },
            {
              $inc: { peekCount: 1 },
            }
          )
          .should.equal(true)
      })

      it('should return the data', function () {
        expect(result).to.deep.equal({ data, remainingPeeks: 3 })
      })
    })

    describe('when a valid token is not found', function () {
      beforeEach(function () {
        this.db.tokens.findOneAndUpdate = sinon.stub().resolves(null)
      })

      it('should return a NotFoundError', async function () {
        await expect(
          this.OneTimeTokenHandler.promises.peekValueFromToken(
            'password',
            'mock-token'
          )
        ).to.be.rejectedWith(Errors.NotFoundError)
      })
    })
  })

  describe('expireToken', function () {
    beforeEach(function () {
      this.db.tokens.updateOne = sinon.stub().yields(null)
      this.OneTimeTokenHandler.expireToken(
        'password',
        'mock-token',
        this.callback
      )
    })

    it('should expire the token', function () {
      this.db.tokens.updateOne
        .calledWith(
          {
            use: 'password',
            token: 'mock-token',
          },
          {
            $set: {
              usedAt: new Date(),
            },
          }
        )
        .should.equal(true)
      this.callback.calledWith(null).should.equal(true)
    })
  })

  describe('getValueFromTokenAndExpire', function () {
    describe('successfully', function () {
      beforeEach(function () {
        this.db.tokens.findOneAndUpdate = sinon
          .stub()
          .yields(null, { data: 'mock-data' })
        this.OneTimeTokenHandler.getValueFromTokenAndExpire(
          'password',
          'mock-token',
          this.callback
        )
      })

      it('should expire the token', function () {
        this.db.tokens.findOneAndUpdate
          .calledWith(
            {
              use: 'password',
              token: 'mock-token',
              expiresAt: { $gt: new Date() },
              usedAt: { $exists: false },
              peekCount: { $not: { $gte: this.OneTimeTokenHandler.MAX_PEEKS } },
            },
            {
              $set: { usedAt: new Date() },
            }
          )
          .should.equal(true)
      })

      it('should return the data', function () {
        this.callback.calledWith(null, 'mock-data').should.equal(true)
      })
    })

    describe('when a valid token is not found', function () {
      beforeEach(function () {
        this.db.tokens.findOneAndUpdate = sinon.stub().yields(null, null)
        this.OneTimeTokenHandler.getValueFromTokenAndExpire(
          'password',
          'mock-token',
          this.callback
        )
      })

      it('should return a NotFoundError', function () {
        this.callback
          .calledWith(sinon.match.instanceOf(Errors.NotFoundError))
          .should.equal(true)
      })
    })
  })
})
