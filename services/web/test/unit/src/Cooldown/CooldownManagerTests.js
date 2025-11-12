const { expect } = require('chai')
const { ObjectId } = require('mongodb-legacy')
const CooldownManager = require('../../../../app/src/Features/Cooldown/CooldownManager')
const {
  cleanupTestRedis,
} = require('../../../../app/src/infrastructure/RedisWrapper')

describe('CooldownManager', function () {
  beforeEach(cleanupTestRedis)

  beforeEach(function () {
    this.project1Id = new ObjectId().toString()
    this.project2Id = new ObjectId().toString()
  })

  describe('_buildKey', function () {
    it('should build a properly formatted redis key', function () {
      expect(CooldownManager._buildKey('ABC')).to.equal('Cooldown:{ABC}')
    })
  })

  describe('isProjectOnCooldown', function () {
    describe('when no project is on cooldown', function () {
      it('returns false for project 1', async function () {
        const result = await CooldownManager.promises.isProjectOnCooldown(
          this.project1Id
        )
        expect(result).to.be.false
      })

      it('returns false for project 2', async function () {
        const result = await CooldownManager.promises.isProjectOnCooldown(
          this.project2Id
        )
        expect(result).to.be.false
      })
    })
    describe('when project 1 is on cooldown', function () {
      beforeEach(async function () {
        await CooldownManager.promises.putProjectOnCooldown(this.project1Id)
      })

      it('returns true for project 1', async function () {
        const result = await CooldownManager.promises.isProjectOnCooldown(
          this.project1Id
        )
        expect(result).to.be.true
      })

      it('returns false for project 2', async function () {
        const result = await CooldownManager.promises.isProjectOnCooldown(
          this.project2Id
        )
        expect(result).to.be.false
      })
    })
  })
})
