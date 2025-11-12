const sinon = require('sinon')
const { expect } = require('chai')
const Errors = require('../../../../app/src/Features/Errors/Errors')
const {
  connectionPromise,
  cleanupTestDatabase,
} = require('../../../../app/src/infrastructure/mongodb')
const OneTimeTokenHandler = require('../../../../app/src/Features/Security/OneTimeTokenHandler')

describe('OneTimeTokenHandler', function () {
  before(async function () {
    await connectionPromise
  })
  beforeEach(cleanupTestDatabase)

  beforeEach(function () {
    this.clock = sinon.useFakeTimers()
  })

  afterEach(function () {
    this.clock.restore()
  })

  describe('getNewToken', function () {
    it('generates a token and stores it in the database', async function () {
      const token = await OneTimeTokenHandler.promises.getNewToken(
        'password',
        'mock-data-to-store'
      )
      const { data } = await OneTimeTokenHandler.promises.peekValueFromToken(
        'password',
        token
      )
      expect(data).to.equal('mock-data-to-store')
    })

    it('expires the generated token after 1 hour', async function () {
      const token = await OneTimeTokenHandler.promises.getNewToken(
        'password',
        'mock-data-to-store'
      )
      this.clock.tick('25:00:00')
      await expect(
        OneTimeTokenHandler.promises.peekValueFromToken('password', token)
      ).to.be.rejectedWith(Errors.NotFoundError)
    })

    it('accepts an expiresIn parameter', async function () {
      const token = await OneTimeTokenHandler.promises.getNewToken(
        'password',
        'mock-data-to-store',
        { expiresIn: 42 }
      )
      this.clock.tick('00:30')
      const { data } = await OneTimeTokenHandler.promises.peekValueFromToken(
        'password',
        token
      )
      expect(data).to.equal('mock-data-to-store')
      this.clock.tick('00:15')
      await expect(
        OneTimeTokenHandler.promises.peekValueFromToken('password', token)
      ).to.be.rejectedWith(Errors.NotFoundError)
    })
  })

  describe('peekValueFromToken', function () {
    it('should return the data and peek count', async function () {
      const data = { email: 'some-mock-data' }
      const token = await OneTimeTokenHandler.promises.getNewToken(
        'password',
        data
      )
      const result = await OneTimeTokenHandler.promises.peekValueFromToken(
        'password',
        token
      )
      expect(result).to.deep.equal({
        data,
        remainingPeeks: OneTimeTokenHandler.MAX_PEEKS - 1,
      })
    })

    it('should throw a NotFoundError if the token is not found', async function () {
      await expect(
        OneTimeTokenHandler.promises.peekValueFromToken('password', 'bad-token')
      ).to.be.rejectedWith(Errors.NotFoundError)
    })

    it('should stop returning the data after the peek count is exceeded', async function () {
      const data = { email: 'some-mock-data' }
      const token = await OneTimeTokenHandler.promises.getNewToken(
        'password',
        data
      )
      for (let peeks = 1; peeks <= OneTimeTokenHandler.MAX_PEEKS; peeks++) {
        const result = await OneTimeTokenHandler.promises.peekValueFromToken(
          'password',
          token
        )
        expect(result).to.deep.equal({
          data,
          remainingPeeks: OneTimeTokenHandler.MAX_PEEKS - peeks,
        })
      }
      await expect(
        OneTimeTokenHandler.promises.peekValueFromToken('password', token)
      ).to.be.rejectedWith(Errors.NotFoundError)
    })
  })

  describe('expireToken', function () {
    it('should expire the token immediately', async function () {
      const token = await OneTimeTokenHandler.promises.getNewToken(
        'password',
        'mock-data'
      )
      await OneTimeTokenHandler.promises.expireToken('password', token)
      await expect(
        OneTimeTokenHandler.promises.peekValueFromToken('password', token)
      ).to.be.rejectedWith(Errors.NotFoundError)
    })
  })

  describe('getValueFromTokenAndExpire', function () {
    it('should return the value and expire the token', async function () {
      const token = await OneTimeTokenHandler.promises.getNewToken(
        'password',
        'mock-data'
      )
      const data =
        await OneTimeTokenHandler.promises.getValueFromTokenAndExpire(
          'password',
          token
        )
      expect(data).to.equal('mock-data')
      await expect(
        OneTimeTokenHandler.promises.peekValueFromToken('password', token)
      ).to.be.rejectedWith(Errors.NotFoundError)
    })

    it('should throw a NotFoundError if the token is not found', async function () {
      await expect(
        OneTimeTokenHandler.promises.getValueFromTokenAndExpire(
          'password',
          'bad-token'
        )
      ).to.be.rejectedWith(Errors.NotFoundError)
    })
  })
})
