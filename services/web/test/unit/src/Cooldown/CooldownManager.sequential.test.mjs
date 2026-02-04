import { expect } from 'vitest'
import mongodb from 'mongodb-legacy'
import CooldownManager from '../../../../app/src/Features/Cooldown/CooldownManager.mjs'
import RedisWrapper from '../../../../app/src/infrastructure/RedisWrapper.mjs'

const { ObjectId } = mongodb

describe('CooldownManager', function () {
  beforeEach(RedisWrapper.cleanupTestRedis)

  beforeEach(function (ctx) {
    ctx.project1Id = new ObjectId().toString()
    ctx.project2Id = new ObjectId().toString()
  })

  describe('_buildKey', function () {
    it('should build a properly formatted redis key', function () {
      expect(CooldownManager._buildKey('ABC')).to.equal('Cooldown:{ABC}')
    })
  })

  describe('isProjectOnCooldown', function () {
    describe('when no project is on cooldown', function () {
      it('returns false for project 1', async function (ctx) {
        const result = await CooldownManager.isProjectOnCooldown(ctx.project1Id)
        expect(result).to.be.false
      })

      it('returns false for project 2', async function (ctx) {
        const result = await CooldownManager.isProjectOnCooldown(ctx.project2Id)
        expect(result).to.be.false
      })
    })
    describe('when project 1 is on cooldown', function () {
      beforeEach(async function (ctx) {
        await CooldownManager.putProjectOnCooldown(ctx.project1Id)
      })

      it('returns true for project 1', async function (ctx) {
        const result = await CooldownManager.isProjectOnCooldown(ctx.project1Id)
        expect(result).to.be.true
      })

      it('returns false for project 2', async function (ctx) {
        const result = await CooldownManager.isProjectOnCooldown(ctx.project2Id)
        expect(result).to.be.false
      })
    })
  })
})
