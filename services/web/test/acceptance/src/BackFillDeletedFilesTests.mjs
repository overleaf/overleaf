import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { expect } from 'chai'
import logger from '@overleaf/logger'
import { db, ObjectId } from '../../../app/src/infrastructure/mongodb.js'
import UserHelper from './helpers/User.mjs'

const User = UserHelper.promises

async function getDeletedFiles(projectId) {
  return (await db.projects.findOne({ _id: projectId })).deletedFiles
}

async function setDeletedFiles(projectId, deletedFiles) {
  await db.projects.updateOne({ _id: projectId }, { $set: { deletedFiles } })
}

async function unsetDeletedFiles(projectId) {
  await db.projects.updateOne(
    { _id: projectId },
    { $unset: { deletedFiles: 1 } }
  )
}

describe('BackFillDeletedFiles', function () {
  let user, projectId1, projectId2, projectId3, projectId4, projectId5

  beforeEach('create projects', async function () {
    user = new User()
    await user.login()

    projectId1 = new ObjectId(await user.createProject('project1'))
    projectId2 = new ObjectId(await user.createProject('project2'))
    projectId3 = new ObjectId(await user.createProject('project3'))
    projectId4 = new ObjectId(await user.createProject('project4'))
    projectId5 = new ObjectId(await user.createProject('project5'))
  })

  let fileId1, fileId2, fileId3, fileId4
  beforeEach('create files', function () {
    // take a short cut and just allocate file ids
    fileId1 = new ObjectId()
    fileId2 = new ObjectId()
    fileId3 = new ObjectId()
    fileId4 = new ObjectId()
  })
  const otherFileDetails = {
    name: 'universe.jpg',
    linkedFileData: null,
    hash: 'ed19e7d6779b47d8c63f6fa5a21954dcfb6cac00',
    deletedAt: new Date(),
    __v: 0,
  }
  let deletedFiles1, deletedFiles2, deletedFiles3
  beforeEach('set deletedFiles details', async function () {
    deletedFiles1 = [
      { _id: fileId1, ...otherFileDetails },
      { _id: fileId2, ...otherFileDetails },
    ]
    deletedFiles2 = [{ _id: fileId3, ...otherFileDetails }]
    await setDeletedFiles(projectId1, deletedFiles1)
    await setDeletedFiles(projectId2, deletedFiles2)

    // a project without deletedFiles entries
    await setDeletedFiles(projectId3, [])
    // a project without deletedFiles array
    await unsetDeletedFiles(projectId4)
    // duplicate entry
    deletedFiles3 = [
      { _id: fileId4, ...otherFileDetails },
      { _id: fileId4, ...otherFileDetails },
    ]
    await setDeletedFiles(projectId5, deletedFiles3)
  })

  async function runScript(args = []) {
    let result
    try {
      result = await promisify(exec)(
        ['LET_USER_DOUBLE_CHECK_INPUTS_FOR=1', 'VERBOSE_LOGGING=true']
          .concat(['node', 'scripts/back_fill_deleted_files.mjs'])
          .concat(args)
          .join(' ')
      )
    } catch (error) {
      // dump details like exit code, stdErr and stdOut
      logger.error({ error }, 'script failed')
      throw error
    }
    const { stdout: stdOut } = result

    expect(stdOut).to.match(
      new RegExp(`Running update on batch with ids .+${projectId1}`)
    )
    expect(stdOut).to.match(
      new RegExp(`Running update on batch with ids .+${projectId2}`)
    )
    expect(stdOut).to.not.match(
      new RegExp(`Running update on batch with ids .+${projectId3}`)
    )
    expect(stdOut).to.not.match(
      new RegExp(`Running update on batch with ids .+${projectId4}`)
    )
    expect(stdOut).to.match(
      new RegExp(`Running update on batch with ids .+${projectId5}`)
    )
  }

  function checkAreFilesBackFilled() {
    it('should back fill file and set projectId', async function () {
      const docs = await db.deletedFiles
        .find({}, { sort: { _id: 1 } })
        .toArray()
      expect(docs).to.deep.equal([
        { _id: fileId1, projectId: projectId1, ...otherFileDetails },
        { _id: fileId2, projectId: projectId1, ...otherFileDetails },
        { _id: fileId3, projectId: projectId2, ...otherFileDetails },
        { _id: fileId4, projectId: projectId5, ...otherFileDetails },
      ])
    })
  }

  describe('back fill only', function () {
    beforeEach('run script', runScript)

    checkAreFilesBackFilled()

    it('should leave the deletedFiles as is', async function () {
      expect(await getDeletedFiles(projectId1)).to.deep.equal(deletedFiles1)
      expect(await getDeletedFiles(projectId2)).to.deep.equal(deletedFiles2)
      expect(await getDeletedFiles(projectId5)).to.deep.equal(deletedFiles3)
    })
  })

  describe('back fill and cleanup', function () {
    beforeEach('run script with cleanup flag', async function () {
      await runScript(['--perform-cleanup'])
    })

    checkAreFilesBackFilled()

    it('should cleanup the deletedFiles', async function () {
      expect(await getDeletedFiles(projectId1)).to.deep.equal([])
      expect(await getDeletedFiles(projectId2)).to.deep.equal([])
      expect(await getDeletedFiles(projectId5)).to.deep.equal([])
    })
  })

  describe('fix partial inserts and cleanup', function () {
    beforeEach('simulate one missing insert', async function () {
      await setDeletedFiles(projectId1, [deletedFiles1[0]])
    })
    beforeEach('run script with cleanup flag', async function () {
      await runScript(['--perform-cleanup'])
    })
    beforeEach('add case for one missing file', async function () {
      await setDeletedFiles(projectId1, deletedFiles1)
    })
    beforeEach('add cases for no more files to insert', async function () {
      await setDeletedFiles(projectId2, deletedFiles2)
      await setDeletedFiles(projectId5, deletedFiles3)
    })

    beforeEach('fixing partial insert and cleanup', async function () {
      await runScript(['--fix-partial-inserts', '--perform-cleanup'])
    })

    checkAreFilesBackFilled()

    it('should cleanup the deletedFiles', async function () {
      expect(await getDeletedFiles(projectId1)).to.deep.equal([])
      expect(await getDeletedFiles(projectId2)).to.deep.equal([])
      expect(await getDeletedFiles(projectId5)).to.deep.equal([])
    })
  })
})
