import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { expect } from 'chai'
import logger from '@overleaf/logger'
import { filterOutput } from './helpers/settings.mjs'
import { db, ObjectId } from '../../../app/src/infrastructure/mongodb.js'

const ONE_DAY_IN_S = 60 * 60 * 24
const BATCH_SIZE = 3

function getSecondsFromObjectId(id) {
  return id.getTimestamp().getTime() / 1000
}

function getObjectIdFromDate(date) {
  const seconds = new Date(date).getTime() / 1000
  return ObjectId.createFromTime(seconds)
}

describe('DeleteOrphanedDocsOnlineCheck', function () {
  let docIds
  let projectIds
  let stopAtSeconds
  let BATCH_LAST_ID
  beforeEach('create docs', async function () {
    BATCH_LAST_ID = getObjectIdFromDate('2021-03-31T00:00:00.000Z')
    docIds = []
    docIds[0] = getObjectIdFromDate('2021-04-01T00:00:00.000Z')
    docIds[1] = getObjectIdFromDate('2021-04-02T00:00:00.000Z')
    docIds[2] = getObjectIdFromDate('2021-04-11T00:00:00.000Z')
    docIds[3] = getObjectIdFromDate('2021-04-12T00:00:00.000Z')
    docIds[4] = getObjectIdFromDate('2021-04-13T00:00:00.000Z')
    docIds[5] = getObjectIdFromDate('2021-04-14T00:00:00.000Z')
    docIds[6] = getObjectIdFromDate('2021-04-15T00:00:00.000Z')
    docIds[7] = getObjectIdFromDate('2021-04-16T00:01:00.000Z')
    docIds[8] = getObjectIdFromDate('2021-04-16T00:02:00.000Z')
    docIds[9] = getObjectIdFromDate('2021-04-16T00:03:00.000Z')
    docIds[10] = getObjectIdFromDate('2021-04-16T00:04:00.000Z')
    docIds[11] = getObjectIdFromDate('2021-04-16T00:05:00.000Z')

    projectIds = []
    projectIds[0] = getObjectIdFromDate('2021-04-01T00:00:00.000Z')
    projectIds[1] = getObjectIdFromDate('2021-04-02T00:00:00.000Z')
    projectIds[2] = getObjectIdFromDate('2021-04-11T00:00:00.000Z')
    projectIds[3] = getObjectIdFromDate('2021-04-12T00:00:00.000Z')
    projectIds[4] = getObjectIdFromDate('2021-04-13T00:00:00.000Z')
    projectIds[5] = getObjectIdFromDate('2021-04-14T00:00:00.000Z')
    projectIds[6] = getObjectIdFromDate('2021-04-15T00:00:00.000Z')
    projectIds[7] = getObjectIdFromDate('2021-04-16T00:01:00.000Z')
    projectIds[8] = getObjectIdFromDate('2021-04-16T00:02:00.000Z')
    projectIds[9] = getObjectIdFromDate('2021-04-16T00:03:00.000Z')
    // two docs in the same project
    projectIds[10] = projectIds[9]
    projectIds[11] = projectIds[4]

    stopAtSeconds = new Date('2021-04-17T00:00:00.000Z').getTime() / 1000
  })
  beforeEach('create doc stubs', async function () {
    await db.docs.insertMany([
      // orphaned
      { _id: docIds[0], project_id: projectIds[0] },
      { _id: docIds[1], project_id: projectIds[1] },
      { _id: docIds[2], project_id: projectIds[2] },
      { _id: docIds[3], project_id: projectIds[3] },
      // orphaned, failed hard deletion
      { _id: docIds[4], project_id: projectIds[4] },
      // not orphaned, live
      { _id: docIds[5], project_id: projectIds[5] },
      // not orphaned, pending hard deletion
      { _id: docIds[6], project_id: projectIds[6] },
      // multiple in a single batch
      { _id: docIds[7], project_id: projectIds[7] },
      { _id: docIds[8], project_id: projectIds[8] },
      { _id: docIds[9], project_id: projectIds[9] },
      // two docs in one project
      { _id: docIds[10], project_id: projectIds[10] },
      { _id: docIds[11], project_id: projectIds[11] },
    ])
  })
  beforeEach('create project stubs', async function () {
    await db.projects.insertMany([
      // live
      { _id: projectIds[5] },
    ])
  })
  beforeEach('create deleted project stubs', async function () {
    await db.deletedProjects.insertMany([
      // hard-deleted
      { deleterData: { deletedProjectId: projectIds[4] } },
      // soft-deleted
      {
        deleterData: { deletedProjectId: projectIds[6] },
        project: { _id: projectIds[6] },
      },
    ])
  })

  let options
  async function runScript(dryRun) {
    options = {
      BATCH_LAST_ID,
      BATCH_SIZE,
      DRY_RUN: dryRun,
      INCREMENT_BY_S: ONE_DAY_IN_S,
      STOP_AT_S: stopAtSeconds,
      // Lower concurrency to 1 for strict sequence of log messages.
      READ_CONCURRENCY_SECONDARY: 1,
      READ_CONCURRENCY_PRIMARY: 1,
      WRITE_CONCURRENCY: 1,
      // start right away
      LET_USER_DOUBLE_CHECK_INPUTS_FOR: 1,
    }
    let result
    try {
      result = await promisify(exec)(
        Object.entries(options)
          .map(([key, value]) => `${key}=${value}`)
          .concat([
            // Hide verbose log messages `calling destroy for project in docstore`
            'LOG_LEVEL=error',
            // Hide deprecation warnings for calling `db.collection.count`
            'NODE_OPTIONS=--no-deprecation',
          ])
          .concat(['node', 'scripts/delete_orphaned_docs_online_check.mjs'])
          .join(' ')
      )
    } catch (error) {
      // dump details like exit code, stdErr and stdOut
      logger.error({ error }, 'script failed')
      throw error
    }
    let { stderr: stdErr, stdout: stdOut } = result
    stdErr = stdErr.split('\n').filter(filterOutput)
    stdOut = stdOut.split('\n').filter(filterOutput)

    const oneDayFromProjectId9InSeconds =
      getSecondsFromObjectId(projectIds[9]) + ONE_DAY_IN_S
    const oneDayFromProjectId9AsObjectId = getObjectIdFromDate(
      1000 * oneDayFromProjectId9InSeconds
    )
    expect(stdOut).to.deep.equal([
      `Checking projects ["${projectIds[0]}"]`,
      `Deleted project ${projectIds[0]} has 1 orphaned docs: ["${docIds[0]}"]`,
      `Checking projects ["${projectIds[1]}"]`,
      `Deleted project ${projectIds[1]} has 1 orphaned docs: ["${docIds[1]}"]`,
      `Checking projects ["${projectIds[2]}"]`,
      `Deleted project ${projectIds[2]} has 1 orphaned docs: ["${docIds[2]}"]`,
      `Checking projects ["${projectIds[3]}"]`,
      `Deleted project ${projectIds[3]} has 1 orphaned docs: ["${docIds[3]}"]`,
      // Two docs in the same project
      `Checking projects ["${projectIds[4]}"]`,
      `Deleted project ${projectIds[4]} has 2 orphaned docs: ["${docIds[4]}","${docIds[11]}"]`,
      // Project 5 is live
      `Checking projects ["${projectIds[5]}"]`,
      // Project 6 is soft-deleted
      `Checking projects ["${projectIds[6]}"]`,
      // 7,8,9 are on the same day, but exceed the batch size of 2
      `Checking projects ["${projectIds[7]}","${projectIds[8]}","${projectIds[9]}"]`,
      `Deleted project ${projectIds[7]} has 1 orphaned docs: ["${docIds[7]}"]`,
      `Deleted project ${projectIds[8]} has 1 orphaned docs: ["${docIds[8]}"]`,
      // Two docs in the same project
      `Deleted project ${projectIds[9]} has 2 orphaned docs: ["${docIds[9]}","${docIds[10]}"]`,
    ])
    expect(stdErr).to.deep.equal([
      ...`Options: ${JSON.stringify(options, null, 2)}`.split('\n'),
      'Waiting for you to double check inputs for 1 ms',
      `Processed 1 projects (1 projects with orphaned docs/1 docs deleted) until ${getObjectIdFromDate(
        '2021-04-01T00:00:00.000Z'
      )}`,
      `Processed 2 projects (2 projects with orphaned docs/2 docs deleted) until ${getObjectIdFromDate(
        '2021-04-02T00:00:00.000Z'
      )}`,
      `Processed 2 projects (2 projects with orphaned docs/2 docs deleted) until ${getObjectIdFromDate(
        '2021-04-03T00:00:00.000Z'
      )}`,
      `Processed 2 projects (2 projects with orphaned docs/2 docs deleted) until ${getObjectIdFromDate(
        '2021-04-04T00:00:00.000Z'
      )}`,
      `Processed 2 projects (2 projects with orphaned docs/2 docs deleted) until ${getObjectIdFromDate(
        '2021-04-05T00:00:00.000Z'
      )}`,
      `Processed 2 projects (2 projects with orphaned docs/2 docs deleted) until ${getObjectIdFromDate(
        '2021-04-06T00:00:00.000Z'
      )}`,
      `Processed 2 projects (2 projects with orphaned docs/2 docs deleted) until ${getObjectIdFromDate(
        '2021-04-07T00:00:00.000Z'
      )}`,
      `Processed 2 projects (2 projects with orphaned docs/2 docs deleted) until ${getObjectIdFromDate(
        '2021-04-08T00:00:00.000Z'
      )}`,
      `Processed 2 projects (2 projects with orphaned docs/2 docs deleted) until ${getObjectIdFromDate(
        '2021-04-09T00:00:00.000Z'
      )}`,
      `Processed 2 projects (2 projects with orphaned docs/2 docs deleted) until ${getObjectIdFromDate(
        '2021-04-10T00:00:00.000Z'
      )}`,
      `Processed 3 projects (3 projects with orphaned docs/3 docs deleted) until ${getObjectIdFromDate(
        '2021-04-11T00:00:00.000Z'
      )}`,
      `Processed 4 projects (4 projects with orphaned docs/4 docs deleted) until ${getObjectIdFromDate(
        '2021-04-12T00:00:00.000Z'
      )}`,
      `Processed 5 projects (5 projects with orphaned docs/6 docs deleted) until ${getObjectIdFromDate(
        '2021-04-13T00:00:00.000Z'
      )}`,
      `Processed 6 projects (5 projects with orphaned docs/6 docs deleted) until ${getObjectIdFromDate(
        '2021-04-14T00:00:00.000Z'
      )}`,
      `Processed 7 projects (5 projects with orphaned docs/6 docs deleted) until ${getObjectIdFromDate(
        '2021-04-15T00:00:00.000Z'
      )}`,
      `Processed 7 projects (5 projects with orphaned docs/6 docs deleted) until ${getObjectIdFromDate(
        '2021-04-16T00:00:00.000Z'
      )}`,
      // 7,8,9,10 are on the same day, but exceed the batch size of 3
      // Project 9 has two docs.
      `Processed 10 projects (8 projects with orphaned docs/10 docs deleted) until ${projectIds[9]}`,
      // 10 has as ready been processed as part of the last batch -- same project_id as 9.
      `Processed 10 projects (8 projects with orphaned docs/10 docs deleted) until ${oneDayFromProjectId9AsObjectId}`,
      'Done.',
    ])
  }

  describe('DRY_RUN=true', function () {
    beforeEach('run script', async function () {
      await runScript(true)
    })

    it('should leave docs as is', async function () {
      const docs = await db.docs.find({}).toArray()
      expect(docs).to.deep.equal([
        { _id: docIds[0], project_id: projectIds[0] },
        { _id: docIds[1], project_id: projectIds[1] },
        { _id: docIds[2], project_id: projectIds[2] },
        { _id: docIds[3], project_id: projectIds[3] },
        { _id: docIds[4], project_id: projectIds[4] },
        { _id: docIds[5], project_id: projectIds[5] },
        { _id: docIds[6], project_id: projectIds[6] },
        { _id: docIds[7], project_id: projectIds[7] },
        { _id: docIds[8], project_id: projectIds[8] },
        { _id: docIds[9], project_id: projectIds[9] },
        { _id: docIds[10], project_id: projectIds[10] },
        { _id: docIds[11], project_id: projectIds[11] },
      ])
    })
  })

  describe('DRY_RUN=false', function () {
    beforeEach('run script', async function () {
      await runScript(false)
    })

    it('should deleted all but docs from live/soft-deleted projects', async function () {
      const docs = await db.docs.find({}).toArray()
      expect(docs).to.deep.equal([
        // not orphaned, live
        { _id: docIds[5], project_id: projectIds[5] },
        // not orphaned, pending hard deletion
        { _id: docIds[6], project_id: projectIds[6] },
      ])
    })
  })
})
