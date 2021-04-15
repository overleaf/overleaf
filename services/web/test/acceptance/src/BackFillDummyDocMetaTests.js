const { exec } = require('child_process')
const { promisify } = require('util')
const { expect } = require('chai')
const logger = require('logger-sharelatex')
const { db, ObjectId } = require('../../../app/src/infrastructure/mongodb')

const DUMMY_NAME = 'unknown.tex'
const DUMMY_TIME = new Date('2021-04-12T00:00:00.000Z')
const ONE_DAY_IN_S = 60 * 60 * 24

function getObjectIdFromDate(date) {
  const seconds = new Date(date).getTime() / 1000
  return ObjectId.createFromTime(seconds)
}

describe('BackFillDummyDocMeta', function () {
  let docId1, docId2, docId3, docId4, docId5, docId6
  let projectId1, projectId2, projectId3, projectId4, projectId5, projectId6
  let stopAtSeconds
  beforeEach('create docs', async function () {
    docId1 = getObjectIdFromDate('2021-04-01T00:00:00.000Z')
    docId2 = getObjectIdFromDate('2021-04-11T00:00:00.000Z')
    docId3 = getObjectIdFromDate('2021-04-12T00:00:00.000Z')
    docId4 = getObjectIdFromDate('2021-04-13T00:00:00.000Z')
    docId5 = getObjectIdFromDate('2021-04-14T00:00:00.000Z')
    docId6 = getObjectIdFromDate('2021-04-15T00:00:00.000Z')

    projectId1 = getObjectIdFromDate('2021-04-01T00:00:00.000Z')
    projectId2 = getObjectIdFromDate('2021-04-11T00:00:00.000Z')
    projectId3 = getObjectIdFromDate('2021-04-12T00:00:00.000Z')
    projectId4 = getObjectIdFromDate('2021-04-13T00:00:00.000Z')
    projectId5 = getObjectIdFromDate('2021-04-14T00:00:00.000Z')
    projectId6 = getObjectIdFromDate('2021-04-15T00:00:00.000Z')

    stopAtSeconds = new Date('2021-04-16T00:00:00.000Z').getTime() / 1000
  })
  const now = new Date()
  beforeEach('insert doc stubs into docs collection', async function () {
    await db.docs.insertMany([
      // incomplete, without deletedDocs context
      { _id: docId1, project_id: projectId1, deleted: true },
      { _id: docId2, project_id: projectId2, deleted: true },
      { _id: docId3, project_id: projectId3, deleted: true },
      // incomplete, with deletedDocs context
      { _id: docId4, project_id: projectId4, deleted: true },
      // complete
      {
        _id: docId5,
        project_id: projectId5,
        deleted: true,
        name: 'foo.tex',
        deletedAt: now
      },
      // not deleted
      { _id: docId6, project_id: projectId6 }
    ])
  })
  beforeEach('insert deleted project context', async function () {
    await db.deletedProjects.insertMany([
      // projectId1 has no entry

      // hard-deleted
      { deleterData: { deletedProjectId: projectId2 } },
      // soft-deleted, no entry for doc
      {
        deleterData: { deletedProjectId: projectId3 },
        project: { deletedDocs: [] }
      },
      // soft-deleted, has entry for doc
      {
        deleterData: { deletedProjectId: projectId4 },
        project: {
          deletedDocs: [{ _id: docId4, name: 'main.tex', deletedAt: now }]
        }
      }
    ])
  })

  let options
  async function runScript(dryRun) {
    options = {
      DRY_RUN: dryRun,
      FIRST_PROJECT_ID: projectId1.toString(),
      INCREMENT_BY_S: ONE_DAY_IN_S,
      STOP_AT_S: stopAtSeconds,
      // start right away
      LET_USER_DOUBLE_CHECK_INPUTS_FOR: 1
    }
    let result
    try {
      result = await promisify(exec)(
        Object.entries(options)
          .map(([key, value]) => `${key}=${value}`)
          .concat(['node', 'scripts/back_fill_dummy_doc_meta.js'])
          .join(' ')
      )
    } catch (error) {
      // dump details like exit code, stdErr and stdOut
      logger.error({ error }, 'script failed')
      throw error
    }
    let { stderr: stdErr, stdout: stdOut } = result
    stdErr = stdErr.split('\n')
    stdOut = stdOut
      .split('\n')
      .filter(line => !line.includes('Using settings from'))

    expect(stdOut).to.deep.equal([
      `Back filling dummy meta data for ["${docId1}"]`,
      `Orphaned deleted doc ${docId1} (no deletedProjects entry)`,
      `Back filling dummy meta data for ["${docId2}"]`,
      `Orphaned deleted doc ${docId2} (failed hard deletion)`,
      `Back filling dummy meta data for ["${docId3}"]`,
      `Missing deletedDoc for ${docId3}`,
      `Back filling dummy meta data for ["${docId4}"]`,
      `Found deletedDoc for ${docId4}`,
      ''
    ])
    expect(stdErr).to.deep.equal([
      ...`Options: ${JSON.stringify(options, null, 2)}`.split('\n'),
      'Waiting for you to double check inputs for 1 ms',
      `Processed 1 until ${getObjectIdFromDate('2021-04-01T23:59:59.000Z')}`,
      `Processed 1 until ${getObjectIdFromDate('2021-04-02T23:59:59.000Z')}`,
      `Processed 1 until ${getObjectIdFromDate('2021-04-03T23:59:59.000Z')}`,
      `Processed 1 until ${getObjectIdFromDate('2021-04-04T23:59:59.000Z')}`,
      `Processed 1 until ${getObjectIdFromDate('2021-04-05T23:59:59.000Z')}`,
      `Processed 1 until ${getObjectIdFromDate('2021-04-06T23:59:59.000Z')}`,
      `Processed 1 until ${getObjectIdFromDate('2021-04-07T23:59:59.000Z')}`,
      `Processed 1 until ${getObjectIdFromDate('2021-04-08T23:59:59.000Z')}`,
      `Processed 1 until ${getObjectIdFromDate('2021-04-09T23:59:59.000Z')}`,
      `Processed 1 until ${getObjectIdFromDate('2021-04-10T23:59:59.000Z')}`,
      `Processed 2 until ${getObjectIdFromDate('2021-04-11T23:59:59.000Z')}`,
      `Processed 3 until ${getObjectIdFromDate('2021-04-12T23:59:59.000Z')}`,
      `Processed 4 until ${getObjectIdFromDate('2021-04-13T23:59:59.000Z')}`,
      `Processed 4 until ${getObjectIdFromDate('2021-04-14T23:59:59.000Z')}`,
      `Processed 4 until ${getObjectIdFromDate('2021-04-15T23:59:59.000Z')}`,
      `Processed 4 until ${getObjectIdFromDate('2021-04-16T23:59:59.000Z')}`,
      'Done.',
      ''
    ])
  }

  describe('DRY_RUN=true', function () {
    beforeEach('run script', async function () {
      await runScript(true)
    })

    it('should leave docs as is', async function () {
      const docs = await db.docs.find({}).toArray()
      expect(docs).to.deep.equal([
        { _id: docId1, project_id: projectId1, deleted: true },
        { _id: docId2, project_id: projectId2, deleted: true },
        { _id: docId3, project_id: projectId3, deleted: true },
        { _id: docId4, project_id: projectId4, deleted: true },
        {
          _id: docId5,
          project_id: projectId5,
          deleted: true,
          name: 'foo.tex',
          deletedAt: now
        },
        { _id: docId6, project_id: projectId6 }
      ])
    })
  })

  describe('DRY_RUN=false', function () {
    beforeEach('run script', async function () {
      await runScript(false)
    })

    it('should back fill name and deletedAt dates into broken docs', async function () {
      const docs = await db.docs.find({}).toArray()
      expect(docs).to.deep.equal([
        {
          _id: docId1,
          project_id: projectId1,
          deleted: true,
          name: DUMMY_NAME,
          deletedAt: DUMMY_TIME
        },
        {
          _id: docId2,
          project_id: projectId2,
          deleted: true,
          name: DUMMY_NAME,
          deletedAt: DUMMY_TIME
        },
        {
          _id: docId3,
          project_id: projectId3,
          deleted: true,
          name: DUMMY_NAME,
          deletedAt: DUMMY_TIME
        },
        {
          _id: docId4,
          project_id: projectId4,
          deleted: true,
          name: 'main.tex',
          deletedAt: now
        },
        {
          _id: docId5,
          project_id: projectId5,
          deleted: true,
          name: 'foo.tex',
          deletedAt: now
        },
        { _id: docId6, project_id: projectId6 }
      ])
    })
  })
})
