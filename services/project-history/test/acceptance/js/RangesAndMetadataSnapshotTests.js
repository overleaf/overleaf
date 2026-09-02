import { expect } from 'chai'
import mongodb from 'mongodb-legacy'
import nock from 'nock'
import * as ProjectHistoryClient from './helpers/ProjectHistoryClient.js'
import * as ProjectHistoryApp from './helpers/ProjectHistoryApp.js'
const { ObjectId } = mongodb

const MockHistoryStore = () => nock('http://127.0.0.1:3100')
const MockWeb = () => nock('http://127.0.0.1:3000')

const fixture = path => new URL(`../fixtures/${path}`, import.meta.url)

describe('RangesAndMetadataSnapshot', function () {
  beforeEach(async function () {
    await ProjectHistoryApp.ensureRunning()

    this.historyId = new ObjectId().toString()
    MockHistoryStore().post('/api/projects').reply(200, {
      projectId: this.historyId,
    })

    const v1Project = await ProjectHistoryClient.initializeProject(
      this.historyId
    )
    this.projectId = new ObjectId().toString()
    MockWeb()
      .get(`/project/${this.projectId}/details`)
      .reply(200, {
        name: 'Test Project',
        overleaf: { history: { id: v1Project.id } },
      })
      .persist()

    MockHistoryStore()
      .get(`/api/projects/${this.historyId}/versions/4/history`)
      .replyWithFile(200, fixture('chunks/4-6.json'))
      .persist()

    // getRangesSnapshot loads the full blob content of editable (text)
    // files to compute tracked-changes/comments, even when there are none
    MockHistoryStore()
      .get(
        `/api/projects/${this.historyId}/blobs/c6654ea913979e13e22022653d284444f284a172`
      )
      .replyWithFile(
        200,
        fixture('blobs/c6654ea913979e13e22022653d284444f284a172')
      )
      .persist()
  })

  afterEach(function () {
    nock.cleanAll()
  })

  describe('getRangesSnapshot', function () {
    it('should return empty ranges for a plain text file', async function () {
      const ranges = await ProjectHistoryClient.getRangesSnapshot(
        this.projectId,
        'foo.tex',
        4
      )
      expect(ranges).to.deep.equal({ changes: [], comments: [] })
    })

    it('should 404 for a pathname that does not exist at that version', async function () {
      try {
        await ProjectHistoryClient.getRangesSnapshot(
          this.projectId,
          'missing.tex',
          4
        )
        expect.fail('should have thrown')
      } catch (error) {
        expect(error.response.status).to.equal(404)
      }
    })
  })

  describe('getFileMetadataSnapshot', function () {
    it('should return the metadata for a file that has some', async function () {
      const data = await ProjectHistoryClient.getFileMetadataSnapshot(
        this.projectId,
        'main.tex',
        4
      )
      expect(data).to.deep.equal({ metadata: { main: true } })
    })

    it('should return no metadata for a file that has none', async function () {
      const data = await ProjectHistoryClient.getFileMetadataSnapshot(
        this.projectId,
        'foo.tex',
        4
      )
      expect(data).to.deep.equal({})
    })
  })

  describe('getPathsAtVersion', function () {
    it('should return the paths of all files at that version', async function () {
      const data = await ProjectHistoryClient.getPathsAtVersion(
        this.projectId,
        4
      )
      expect(data.paths.slice().sort()).to.deep.equal(['foo.tex', 'main.tex'])
    })
  })
})
