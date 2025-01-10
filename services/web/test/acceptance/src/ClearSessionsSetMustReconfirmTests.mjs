import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { expect } from 'chai'
import logger from '@overleaf/logger'
import { ObjectId, db } from '../../../app/src/infrastructure/mongodb.js'
import fs from 'node:fs/promises'
import UserHelper from './helpers/User.mjs'
import UserGetter from '../../../app/src/Features/User/UserGetter.js'

const User = UserHelper.promises
const TEST_FILE_PATH = '/tmp/test-users.txt'

describe('ClearSessionsSetMustReconfirm', function () {
  let user1, user2, user3, user4, usersMustReconfirm, usersMustNotReconfirm

  beforeEach('create test users', async function () {
    user1 = new User()
    user2 = new User() // not in the file
    user3 = new User() // not in the file
    user4 = new User()
    await user1.login()
    await user2.login()
    await user3.login()
    await user4.login()
    usersMustReconfirm = [user1, user4]
    usersMustNotReconfirm = [user2, user3]
  })

  beforeEach('create test file', async function () {
    await fs.writeFile(
      TEST_FILE_PATH,
      usersMustReconfirm.map(user => user._id.toString()).join('\n')
    )
  })

  afterEach('cleanup test file', async function () {
    try {
      await fs.unlink(TEST_FILE_PATH)
    } catch (err) {
      // Ignore error if file doesn't exist
    }
  })

  async function runScript(filePath = TEST_FILE_PATH) {
    let result
    try {
      result = await promisify(exec)(
        ['VERBOSE_LOGGING=true']
          .concat(['node', 'scripts/clear_sessions_set_must_reconfirm.mjs'])
          .concat([filePath])
          .join(' ')
      )
    } catch (error) {
      logger.error({ error }, 'script failed')
      throw error
    }
    const { stdout: stdOut } = result
    expect(stdOut).to.include('DONE.')
    return result
  }

  describe('processing users', function () {
    it('should process all users successfully', async function () {
      const { stdout } = await runScript()
      expect(stdout).to.include(`${usersMustReconfirm.length} successful`)
      expect(stdout).to.include('0 failed to clear sessions')
      expect(stdout).to.include('0 failed to set must_reconfirm')
      for (const user of usersMustReconfirm) {
        const updatedUser = await UserGetter.promises.getUser({
          _id: user._id,
        })
        expect(updatedUser.must_reconfirm).to.be.true
      }
      for (const user of usersMustNotReconfirm) {
        const updatedUser = await UserGetter.promises.getUser({
          _id: user._id,
        })
        expect(updatedUser.must_reconfirm).to.be.false
      }
    })

    it('should handle invalid user IDs in file', async function () {
      await fs.writeFile(
        TEST_FILE_PATH,
        [
          'invalid-id',
          ...usersMustReconfirm.map(user => user._id.toString()).join('\n'),
        ].join('\n')
      )
      try {
        await runScript()
        expect.fail('Should have thrown error')
      } catch (error) {
        expect(error.message).to.include('user ID not valid')
      }
    })

    it('should process large number of users with concurrency limit', async function () {
      const manyUserIds = Array.from({ length: 15 }, () =>
        new ObjectId().toString()
      )
      await fs.writeFile(TEST_FILE_PATH, manyUserIds.join('\n'))
      const { stdout } = await runScript()
      expect(stdout).to.include('15 successful')
    })
  })

  describe('error handling', function () {
    beforeEach('ensure test file exists', async function () {
      await fs.writeFile(
        TEST_FILE_PATH,
        usersMustReconfirm.map(user => user._id.toString()).join('\n')
      )
    })

    it('should report failed user updates', async function () {
      await db.users.updateOne(
        { _id: user1._id },
        { $set: { must_reconfirm: null } }
      )
      const { stdout } = await runScript()
      expect(stdout).to.include('failed to set must_reconfirm')
    })

    it('should handle missing input file', async function () {
      try {
        await runScript(['/non/existent/file'])
        expect.fail('Should have thrown error')
      } catch (error) {
        expect(error.message).to.include('ENOENT')
      }
    })
  })

  describe('audit logging', function () {
    it('should create audit log entries for processed users', async function () {
      await runScript()
      for (const user of usersMustReconfirm) {
        const auditLogEntry = await user.getAuditLog()
        expect(auditLogEntry).to.exist
        expect(auditLogEntry[0].operation).to.equal('login')
        expect(auditLogEntry[1].operation).to.equal('must-reset-password-set')
        expect(auditLogEntry[1].initiatorId).to.be.undefined
        expect(auditLogEntry[1].ipAddress).to.be.undefined
        expect(auditLogEntry[1].info).to.deep.equal({ script: true })
      }
      for (const user of usersMustNotReconfirm) {
        const auditLogEntry = await user.getAuditLog()
        expect(auditLogEntry).to.exist
        expect(auditLogEntry[0].operation).to.equal('login')
        expect(auditLogEntry[1]).to.be.undefined
      }
    })
  })
})
