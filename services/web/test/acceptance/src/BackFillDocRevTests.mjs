import { db, ObjectId } from '../../../app/src/infrastructure/mongodb.js'
import { promisify } from 'node:util'
import { exec } from 'node:child_process'
import logger from '@overleaf/logger'
import { expect } from 'chai'

describe('BackFillDocRevTests', function () {
  const docId1 = new ObjectId()
  const docId2 = new ObjectId()
  const docId3 = new ObjectId()

  beforeEach('insert docs', async function () {
    await db.docs.insertMany([
      { _id: docId1, deleted: true },
      { _id: docId2 },
      { _id: docId3, rev: 42 },
    ])
  })

  async function runScript(dryRun) {
    let result
    try {
      result = await promisify(exec)(
        [
          'VERBOSE_LOGGING=true',
          'node',
          'scripts/back_fill_doc_rev.mjs',
          dryRun,
        ].join(' ')
      )
    } catch (error) {
      // dump details like exit code, stdErr and stdOut
      logger.error({ error }, 'script failed')
      throw error
    }
    const { stdout: stdOut } = result

    expect(stdOut).to.include('rev missing 2 | deleted=true 1')
    expect(stdOut).to.match(
      new RegExp(`Running update on batch with ids .+${docId1}`)
    )
    expect(stdOut).to.match(
      new RegExp(`Running update on batch with ids .+${docId2}`)
    )
    expect(stdOut).to.not.match(
      new RegExp(`Running update on batch with ids .+${docId3}`)
    )
  }

  describe('dry-run=true', function () {
    beforeEach('run script', async function () {
      await runScript('--dry-run=true')
    })

    it('should not back fill the rev', async function () {
      const docs = await db.docs.find({}, { $sort: { _id: 1 } }).toArray()
      expect(docs).to.deep.equal([
        { _id: docId1, deleted: true },
        { _id: docId2 },
        { _id: docId3, rev: 42 },
      ])
    })
  })

  describe('dry-run=false', function () {
    beforeEach('run script', async function () {
      await runScript('--dry-run=false')
    })

    it('should back fill the rev', async function () {
      const docs = await db.docs.find({}, { $sort: { _id: 1 } }).toArray()
      expect(docs).to.deep.equal([
        { _id: docId1, rev: 1, deleted: true },
        { _id: docId2, rev: 1 },
        { _id: docId3, rev: 42 },
      ])
    })
  })
})
