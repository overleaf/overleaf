const { expect } = require('chai')
const { promisify } = require('node:util')
const { exec } = require('node:child_process')
const logger = require('@overleaf/logger')
const { db } = require('../../../app/src/infrastructure/mongodb')

async function runScript(args = []) {
  try {
    return await promisify(exec)(
      ['node', 'scripts/migration_compile_timeout_60s_to_20s.js', ...args].join(
        ' '
      )
    )
  } catch (error) {
    logger.error({ error }, 'script failed')
    throw error
  }
}

async function runFixupScript(args = []) {
  try {
    return await promisify(exec)(
      [
        'node',
        'scripts/migration_compile_timeout_60s_to_20s_fixup_features_updated_at.js',
        ...args,
      ].join(' ')
    )
  } catch (error) {
    logger.error({ error }, 'script failed')
    throw error
  }
}

describe('MigrateUserFeatureTimeoutTests', function () {
  describe('initial script', function () {
    const usersInput = {
      noFeatures: {},
      noFeatureTimeout: { features: {} },
      timeout10s: {
        features: { compileTimeout: 10, other: 'val1' },
        bar: '1',
        featuresUpdatedAt: new Date('2020-01-01'),
      },
      timeout20s: { features: { compileTimeout: 20, other: 'val2' }, bar: '2' },
      timeout30s: {
        features: { compileTimeout: 30, other: 'val3' },
        bar: '3',
        featuresUpdatedAt: new Date('2025-01-01'),
      },
      timeout60s: {
        features: { compileTimeout: 60, other: 'val4' },
        bar: '4',
        featuresUpdatedAt: new Date(),
      },
      timeout120s: {
        features: { compileTimeout: 120, other: 'val5' },
        bar: '5',
      },
      timeout180s: {
        features: { compileTimeout: 180, other: 'val6' },
        bar: '6',
        featuresUpdatedAt: new Date('2020-01-01'),
      },
    }

    const usersKeys = Object.keys(usersInput)
    const userIds = {}

    beforeEach('insert users', async function () {
      const usersInsertedValues = await db.users.insertMany(
        usersKeys.map(key => ({
          ...usersInput[key],
          email: `${key}@example.com`,
        }))
      )
      usersKeys.forEach(
        (key, index) => (userIds[key] = usersInsertedValues.insertedIds[index])
      )
    })

    afterEach('clear users', async function () {
      await db.users.deleteMany({})
    })

    it('gives correct counts in dry mode', async function () {
      const users = await db.users.find().toArray()
      expect(users).to.have.lengthOf(usersKeys.length)

      const result = await runScript([])

      expect(result.stderr).to.contain(
        'Doing dry run. Add --commit to commit changes'
      )
      expect(result.stdout).to.contain(
        'Found 3 users with compileTimeout <= 60s && != 20s'
      )
      expect(result.stdout).to.contain(
        'Found 1 users with compileTimeout == 20s'
      )
      expect(result.stdout).not.to.contain('Updated')

      const usersAfter = await db.users.find().toArray()

      expect(usersAfter).to.deep.equal(users)
    })

    it("updates users compileTimeout when '--commit' is set", async function () {
      const users = await db.users.find().toArray()
      expect(users).to.have.lengthOf(usersKeys.length)
      const result = await runScript(['--commit'])

      expect(result.stdout).to.contain(
        'Found 3 users with compileTimeout <= 60s && != 20s'
      )
      expect(result.stdout).to.contain(
        'Found 1 users with compileTimeout == 20s'
      )
      expect(result.stdout).to.contain('Updated 3 records')

      const usersAfter = await db.users.find().toArray()

      expect(
        usersAfter.map(({ featuresUpdatedAt, ...rest }) => rest)
      ).to.deep.equal([
        { _id: userIds.noFeatures, email: 'noFeatures@example.com' },
        {
          _id: userIds.noFeatureTimeout,
          email: 'noFeatureTimeout@example.com',
          features: {},
        },
        {
          _id: userIds.timeout10s,
          email: 'timeout10s@example.com',
          features: { compileTimeout: 20, other: 'val1' },
          bar: '1',
        },
        {
          _id: userIds.timeout20s,
          email: 'timeout20s@example.com',
          features: { compileTimeout: 20, other: 'val2' },
          bar: '2',
        },
        {
          _id: userIds.timeout30s,
          email: 'timeout30s@example.com',
          features: { compileTimeout: 20, other: 'val3' },
          bar: '3',
        },
        {
          _id: userIds.timeout60s,
          email: 'timeout60s@example.com',
          features: { compileTimeout: 20, other: 'val4' },
          bar: '4',
        },
        {
          _id: userIds.timeout120s,
          email: 'timeout120s@example.com',
          features: { compileTimeout: 120, other: 'val5' },
          bar: '5',
        },
        {
          _id: userIds.timeout180s,
          email: 'timeout180s@example.com',
          features: { compileTimeout: 180, other: 'val6' },
          bar: '6',
        },
      ])

      expect(usersAfter[0].featuresUpdatedAt).to.be.undefined
      expect(usersAfter[1].featuresUpdatedAt).to.be.undefined
      expect(usersAfter[2].featuresUpdatedAt).to.be.instanceOf(Date)
      expect(usersAfter[3].featuresUpdatedAt).to.be.undefined // was already 20s
      expect(usersAfter[4].featuresUpdatedAt).to.be.instanceOf(Date)
      expect(usersAfter[5].featuresUpdatedAt).to.be.instanceOf(Date)
      expect(usersAfter[6].featuresUpdatedAt).to.be.undefined

      const result2 = await runScript([])

      expect(result2.stdout).to.contain(
        'Found 0 users with compileTimeout <= 60s && != 20s'
      )
      expect(result2.stdout).to.contain(
        'Found 4 users with compileTimeout == 20s'
      )
    })
  })

  describe('fixup script', function () {
    const usersInput = {
      timeout20s1: {
        features: { compileTimeout: 20 },
      },
      timeout20s2: {
        features: { compileTimeout: 20 },
        featuresUpdatedAt: new Date('2023-01-01'),
      },
      timeout20s3: {
        features: { compileTimeout: 20 },
        featuresUpdatedAt: new Date('2025-01-01'),
      },
      timeout240s1: {
        features: { compileTimeout: 240 },
      },
      timeout240s2: {
        features: { compileTimeout: 240 },
        featuresUpdatedAt: new Date('2023-01-01'),
      },
      timeout240s3: {
        features: { compileTimeout: 240 },
        featuresUpdatedAt: new Date('2025-01-01'),
      },
    }

    const usersKeys = Object.keys(usersInput)
    const userIds = {}

    beforeEach('insert users', async function () {
      const usersInsertedValues = await db.users.insertMany(
        usersKeys.map(key => ({
          ...usersInput[key],
          email: `${key}@example.com`,
        }))
      )
      usersKeys.forEach(
        (key, index) => (userIds[key] = usersInsertedValues.insertedIds[index])
      )
    })
    afterEach('clear users', async function () {
      await db.users.deleteMany({})
    })

    it('gives correct counts in dry mode', async function () {
      const users = await db.users.find().toArray()
      expect(users).to.have.lengthOf(usersKeys.length)
      const result = await runFixupScript([])
      expect(result.stderr).to.contain(
        'Doing dry run. Add --commit to commit changes'
      )
      expect(result.stdout).to.contain(
        'Found 2 users needing their featuresUpdatedAt updated'
      )
      expect(result.stdout).not.to.contain('Updated 2 records')
      const usersAfter = await db.users.find().toArray()
      expect(usersAfter).to.deep.equal(users)
    })

    it("updates users featuresUpdatedAt when '--commit' is set", async function () {
      const FEATURES_UPDATED_AT = new Date('2024-04-16T12:41:00Z')
      const users = await db.users.find().toArray()
      expect(users).to.have.lengthOf(usersKeys.length)
      const result = await runFixupScript(['--commit'])
      expect(result.stdout).to.contain(
        'Found 2 users needing their featuresUpdatedAt updated'
      )
      expect(result.stdout).to.contain('Updated 2 records')
      const usersAfter = await db.users.find().toArray()
      expect(usersAfter).to.deep.equal([
        {
          _id: userIds.timeout20s1,
          email: 'timeout20s1@example.com',
          features: { compileTimeout: 20 },
          featuresUpdatedAt: FEATURES_UPDATED_AT,
        },
        {
          _id: userIds.timeout20s2,
          email: 'timeout20s2@example.com',
          features: { compileTimeout: 20 },
          featuresUpdatedAt: FEATURES_UPDATED_AT,
        },
        {
          _id: userIds.timeout20s3,
          email: 'timeout20s3@example.com',
          features: { compileTimeout: 20 },
          featuresUpdatedAt: new Date('2025-01-01'),
        },
        {
          _id: userIds.timeout240s1,
          email: 'timeout240s1@example.com',
          features: { compileTimeout: 240 },
        },
        {
          _id: userIds.timeout240s2,
          email: 'timeout240s2@example.com',
          features: { compileTimeout: 240 },
          featuresUpdatedAt: new Date('2023-01-01'),
        },
        {
          _id: userIds.timeout240s3,
          email: 'timeout240s3@example.com',
          features: { compileTimeout: 240 },
          featuresUpdatedAt: new Date('2025-01-01'),
        },
      ])

      const result2 = await runFixupScript([])

      expect(result2.stdout).to.contain(
        'Found 0 users needing their featuresUpdatedAt updated'
      )
    })
  })
})
