const { exec } = require('child_process')
const { promisify } = require('util')
const { expect } = require('chai')
const logger = require('logger-sharelatex')
const { db, ObjectId } = require('../../../app/src/infrastructure/mongodb')
const User = require('./helpers/User').promises

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

describe('BackFillDeletedFiles', function() {
  let user, projectId1, projectId2, projectId3, projectId4

  beforeEach('create projects', async function() {
    user = new User()
    await user.login()

    projectId1 = ObjectId(await user.createProject('project1'))
    projectId2 = ObjectId(await user.createProject('project2'))
    projectId3 = ObjectId(await user.createProject('project3'))
    projectId4 = ObjectId(await user.createProject('project4'))
  })

  let fileId1, fileId2, fileId3
  beforeEach('create files', function() {
    // take a short cut and just allocate file ids
    fileId1 = ObjectId()
    fileId2 = ObjectId()
    fileId3 = ObjectId()
  })
  const otherFileDetails = {
    name: 'universe.jpg',
    linkedFileData: null,
    hash: 'ed19e7d6779b47d8c63f6fa5a21954dcfb6cac00',
    deletedAt: new Date(),
    __v: 0
  }
  let deletedFiles1, deletedFiles2
  beforeEach('set deletedFiles details', async function() {
    deletedFiles1 = [
      { _id: fileId1, ...otherFileDetails },
      { _id: fileId2, ...otherFileDetails }
    ]
    deletedFiles2 = [{ _id: fileId3, ...otherFileDetails }]
    await setDeletedFiles(projectId1, deletedFiles1)
    await setDeletedFiles(projectId2, deletedFiles2)

    // a project without deletedFiles entries
    await setDeletedFiles(projectId3, [])
    // a project without deletedFiles array
    await unsetDeletedFiles(projectId4)
  })

  async function runScript(args = []) {
    let result
    try {
      result = await promisify(exec)(
        ['LET_USER_DOUBLE_CHECK_INPUTS_FOR=1']
          .concat(['node', 'scripts/back_fill_deleted_files'])
          .concat(args)
          .join(' ')
      )
    } catch (error) {
      // dump details like exit code, stdErr and stdOut
      logger.error({ error }, 'script failed')
      throw error
    }
    const { stderr: stdErr, stdout: stdOut } = result
    expect(stdOut).to.include(projectId1.toString())
    expect(stdOut).to.include(projectId2.toString())

    expect(stdErr).to.include(`Completed batch ending ${projectId2}`)
  }

  function checkAreFilesBackFilled() {
    it('should back fill file and set projectId', async function() {
      const docs = await db.deletedFiles
        .find({}, { sort: { _id: 1 } })
        .toArray()
      expect(docs).to.deep.equal([
        { _id: fileId1, projectId: projectId1, ...otherFileDetails },
        { _id: fileId2, projectId: projectId1, ...otherFileDetails },
        { _id: fileId3, projectId: projectId2, ...otherFileDetails }
      ])
    })
  }

  describe('back fill only', function() {
    beforeEach('run script', runScript)

    checkAreFilesBackFilled()

    it('should leave the deletedFiles as is', async function() {
      expect(await getDeletedFiles(projectId1)).to.deep.equal(deletedFiles1)
      expect(await getDeletedFiles(projectId2)).to.deep.equal(deletedFiles2)
    })
  })

  describe('back fill and cleanup', function() {
    beforeEach('run script with cleanup flag', async function() {
      await runScript(['--perform-cleanup'])
    })

    checkAreFilesBackFilled()

    it('should cleanup the deletedFiles', async function() {
      expect(await getDeletedFiles(projectId1)).to.deep.equal([])
      expect(await getDeletedFiles(projectId2)).to.deep.equal([])
    })
  })
})
