// @ts-check
import cleanup from '../storage/support/cleanup.js'
import fetch from 'node-fetch'
import testServer from './support/test_backup_deletion_server.mjs'
import { expect } from 'chai'
import testProjects from './support/test_projects.js'
import { db } from '../../../../storage/lib/mongodb.js'
import { ObjectId } from 'mongodb'
import {
  backupPersistor,
  projectBlobsBucket,
  chunksBucket,
} from '../../../../storage/lib/backupPersistor.mjs'
import { makeProjectKey } from '../../../../storage/lib/blob_store/index.js'
import config from 'config'
import Stream from 'stream'
import projectKey from '../../../../storage/lib/project_key.js'

/**
 * @typedef {import("node-fetch").Response} Response
 */

const { deksBucket } = config.get('backupStore')

const deletedProjectsCollection = db.collection('deletedProjects')

/**
 * @param {string} bucket
 * @param {string} prefix
 * @return {Promise<Array<string>>}
 */
async function listS3Bucket(bucket, prefix) {
  // @ts-ignore access to internal library helper
  const client = backupPersistor._getClientForBucket(bucket)
  const response = await client
    .listObjectsV2({ Bucket: bucket, Prefix: prefix })
    .promise()
  return (response.Contents || []).map(item => item.Key || '')
}

/**
 * @param {ObjectId} projectId
 * @return {Promise<Response>}
 */
async function deleteProject(projectId) {
  return await fetch(testServer.testUrl(`/project/${projectId}/backup`), {
    method: 'DELETE',
    headers: { Authorization: testServer.basicAuthHeader },
  })
}

/**
 * @param {number|ObjectId} historyId
 * @return {Promise<void>}
 */
async function expectToHaveBackup(historyId) {
  const prefix = projectKey.format(historyId.toString()) + '/'
  expect(await listS3Bucket(deksBucket, prefix)).to.have.length(1)
  expect(await listS3Bucket(chunksBucket, prefix)).to.have.length(2)
  expect(await listS3Bucket(projectBlobsBucket, prefix)).to.have.length(2)
}

/**
 * @param {number|ObjectId} historyId
 * @return {Promise<void>}
 */
async function expectToHaveNoBackup(historyId) {
  const prefix = projectKey.format(historyId.toString()) + '/'
  expect(await listS3Bucket(deksBucket, prefix)).to.have.length(0)
  expect(await listS3Bucket(chunksBucket, prefix)).to.have.length(0)
  expect(await listS3Bucket(projectBlobsBucket, prefix)).to.have.length(0)
}

describe('backupDeletion', function () {
  beforeEach(cleanup.everything)
  beforeEach('create health check projects', async function () {
    await testProjects.createEmptyProject('42')
    await testProjects.createEmptyProject('000000000000000000000042')
  })
  beforeEach(testServer.listenOnRandomPort)

  it('renders 200 on /status', async function () {
    const response = await fetch(testServer.testUrl('/status'))
    expect(response.status).to.equal(200)
  })

  it('renders 200 on /health_check', async function () {
    const response = await fetch(testServer.testUrl('/health_check'))
    expect(response.status).to.equal(200)
  })

  describe('DELETE /project/:projectId', function () {
    const postgresHistoryId = 1
    const projectIdPostgres = new ObjectId('000000000000000000000001')
    const projectIdMongoDB = new ObjectId('000000000000000000000002')
    const projectIdNonDeleted = new ObjectId('000000000000000000000003')
    const projectIdNonExpired = new ObjectId('000000000000000000000004')
    const projectIdWithChunks = new ObjectId('000000000000000000000005')
    const projectIdNoHistoryId = new ObjectId('000000000000000000000006')

    beforeEach('populate mongo', async function () {
      await deletedProjectsCollection.insertMany([
        {
          _id: new ObjectId(),
          deleterData: {
            deletedProjectId: projectIdPostgres,
            deletedAt: new Date('2024-01-01T00:00:00Z'),
            deletedProjectOverleafHistoryId: postgresHistoryId,
          },
        },
        {
          _id: new ObjectId(),
          deleterData: {
            deletedProjectId: projectIdNonExpired,
            deletedAt: new Date(),
            deletedProjectOverleafHistoryId: projectIdNonExpired.toString(),
          },
        },
        {
          _id: new ObjectId(),
          deleterData: {
            deletedProjectId: projectIdNoHistoryId,
            deletedAt: new Date('2024-01-01T00:00:00Z'),
          },
        },
        ...[projectIdMongoDB, projectIdWithChunks].map(projectId => {
          return {
            _id: new ObjectId(),
            deleterData: {
              deletedProjectId: projectId,
              deletedAt: new Date('2024-01-01T00:00:00Z'),
              deletedProjectOverleafHistoryId: projectId.toString(),
            },
          }
        }),
      ])
    })

    beforeEach('initialize history', async function () {
      await testProjects.createEmptyProject(projectIdWithChunks.toString())
    })

    beforeEach('create a file in s3', async function () {
      const historyIds = [
        postgresHistoryId,
        projectIdMongoDB,
        projectIdNonDeleted,
        projectIdNonExpired,
        projectIdWithChunks,
        projectIdNoHistoryId,
      ]
      const jobs = []
      for (const historyId of historyIds) {
        jobs.push(
          backupPersistor.sendStream(
            projectBlobsBucket,
            makeProjectKey(historyId, 'a'.repeat(40)),
            Stream.Readable.from(['blob a']),
            { contentLength: 6 }
          )
        )
        jobs.push(
          backupPersistor.sendStream(
            projectBlobsBucket,
            makeProjectKey(historyId, 'b'.repeat(40)),
            Stream.Readable.from(['blob b']),
            { contentLength: 6 }
          )
        )
        jobs.push(
          backupPersistor.sendStream(
            chunksBucket,
            projectKey.format(historyId) + '/111',
            Stream.Readable.from(['chunk 1']),
            { contentLength: 7 }
          )
        )
        jobs.push(
          backupPersistor.sendStream(
            chunksBucket,
            projectKey.format(historyId) + '/222',
            Stream.Readable.from(['chunk 2']),
            { contentLength: 7 }
          )
        )
      }
      await Promise.all(jobs)
    })

    it('renders 401 without auth', async function () {
      const response = await fetch(
        testServer.testUrl('/project/000000000000000000000042/backup'),
        { method: 'DELETE' }
      )
      expect(response.status).to.equal(401)
      expect(response.headers.get('www-authenticate')).to.match(/^Basic/)
    })

    it('returns 422 when not deleted', async function () {
      const response = await deleteProject(projectIdNonDeleted)
      expect(response.status).to.equal(422)
      expect(await response.text()).to.equal(
        'refusing to delete non-deleted project'
      )
      await expectToHaveBackup(projectIdNonDeleted)
    })
    it('returns 422 when not expired', async function () {
      const response = await deleteProject(projectIdNonExpired)
      expect(response.status).to.equal(422)
      expect(await response.text()).to.equal(
        'refusing to delete non-expired project'
      )
      await expectToHaveBackup(projectIdNonExpired)
    })
    it('returns 422 when live-history not deleted', async function () {
      const response = await deleteProject(projectIdWithChunks)
      expect(response.status).to.equal(422)
      expect(await response.text()).to.equal(
        'refusing to delete project with remaining chunks'
      )
      await expectToHaveBackup(projectIdWithChunks)
    })
    it('returns 422 when historyId is unknown', async function () {
      const response = await deleteProject(projectIdNoHistoryId)
      expect(response.status).to.equal(422)
      expect(await response.text()).to.equal(
        'refusing to delete project with unknown historyId'
      )
      await expectToHaveBackup(projectIdNoHistoryId)
    })
    it('should successfully delete postgres id', async function () {
      await expectToHaveBackup(postgresHistoryId)
      const response = await deleteProject(projectIdPostgres)
      expect(response.status).to.equal(204)
      await expectToHaveNoBackup(postgresHistoryId)
    })
    it('should successfully delete mongo id', async function () {
      await expectToHaveBackup(projectIdMongoDB)
      const response = await deleteProject(projectIdMongoDB)
      expect(response.status).to.equal(204)
      await expectToHaveNoBackup(projectIdMongoDB)
    })
  })
})
