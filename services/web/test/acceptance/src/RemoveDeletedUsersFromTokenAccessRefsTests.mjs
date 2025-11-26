import { db, ObjectId } from '../../../app/src/infrastructure/mongodb.mjs'
import { promisify } from 'node:util'
import { exec } from 'node:child_process'
import logger from '@overleaf/logger'
import { expect } from 'chai'

describe('RemoveDeletedUsersFromTokenAccessRefsTests', function () {
  const userId1 = new ObjectId()
  const userId2 = new ObjectId()
  const userId3 = new ObjectId()

  let insertedUsersCount
  beforeEach('insert users', async function () {
    const users = await db.users.insertMany([
      { _id: userId1, email: 'user1@example.com' },
    ])
    insertedUsersCount = users.insertedCount
  })

  const projectId1 = new ObjectId('65d726e807c024c8db43be22')
  const projectId2 = new ObjectId('65d726e807c024c8db43be23')
  const projectId3 = new ObjectId('65d726e807c024c8db43be24')
  const projectId4 = new ObjectId('65d726e807c024c8db43be25')

  beforeEach('insert projects', async function () {
    await db.projects.insertMany([
      {
        _id: projectId1,
        tokenAccessReadAndWrite_refs: [userId1],
        tokenAccessReadOnly_refs: [],
      },
      {
        _id: projectId2,
        tokenAccessReadAndWrite_refs: [userId2],
        tokenAccessReadOnly_refs: [],
      },
      {
        _id: projectId3,
        tokenAccessReadAndWrite_refs: [userId3],
      },
      {
        _id: projectId4,
      },
    ])
  })

  let stdOut

  const runScript = async () => {
    let result
    try {
      result = await promisify(exec)(
        'cd ../../tools/migrations && east migrate -t saas --force 20240220130452_remove_deleted_users_from_token_access_refs'
      )
    } catch (error) {
      // dump details like exit code, stdErr and stdOut
      logger.error({ error }, 'script failed')
      throw error
    }
    const { stdout } = result
    stdOut = stdout

    expect(stdOut).to.match(new RegExp(`User ids count: ${insertedUsersCount}`))
  }

  describe('dry-run=false', function () {
    beforeEach('run script', async function () {
      await runScript('--dry-run=false')
      expect(stdOut).to.not.match(/dry run/i)
    })

    it('should show current user id to be removed', function () {
      expect(stdOut).to.match(
        new RegExp(
          `Found deleted user id: ${userId2.toString()} in project: ${projectId2.toString()}`
        )
      )
      expect(stdOut).to.match(
        new RegExp(
          `Removing deleted ${userId2.toString()} from all projects \\(found in project ${projectId2.toString()}\\)`
        )
      )
      expect(stdOut).to.match(
        new RegExp(
          `Found deleted user id: ${userId3.toString()} in project: ${projectId3.toString()}`
        )
      )
      expect(stdOut).to.match(
        new RegExp(
          `Removing deleted ${userId3.toString()} from all projects \\(found in project ${projectId3.toString()}\\)`
        )
      )
    })

    it('should show fixed projects with non-existing token access fields', function () {
      expect(stdOut)
        .to.match(
          new RegExp(
            `Fixed non-existing token access fields in project ${projectId3.toString()}`
          )
        )
        .and.match(
          new RegExp(
            `Fixed non-existing token access fields in project ${projectId4.toString()}`
          )
        )
    })

    it('should show the deleted user ids (and their count) that were removed', function () {
      expect(stdOut).to.match(
        new RegExp(
          `Deleted user ids \\(2\\)\\n${userId2.toString()}\\n${userId3.toString()}`
        )
      )
    })

    it('should show the project ids (and their count) that were fixed', function () {
      expect(stdOut).to.match(
        new RegExp(
          `Projects with deleted user ids \\(2\\)\\n${projectId2.toString()}\\n${projectId3.toString()}`
        )
      )
    })

    it('should fix the token access fields of projects', async function () {
      const [, ...fixedProjects] = await db.projects
        .find({}, { $sort: { _id: 1 } })
        .toArray()
      expect(fixedProjects).to.deep.equal([
        {
          _id: projectId2,
          tokenAccessReadAndWrite_refs: [],
          tokenAccessReadOnly_refs: [],
        },
        {
          _id: projectId3,
          tokenAccessReadAndWrite_refs: [],
          tokenAccessReadOnly_refs: [],
        },
        {
          _id: projectId4,
          tokenAccessReadOnly_refs: [],
          tokenAccessReadAndWrite_refs: [],
        },
      ])
    })
  })
})
