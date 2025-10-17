import fs from 'node:fs'
import Path from 'node:path'
import { expect } from 'chai'
import UserHelper from './helpers/User.mjs'
import MockV1HistoryApiClass from './mocks/MockV1HistoryApi.mjs'
import ProjectGetter from '../../../app/src/Features/Project/ProjectGetter.mjs'
import { fileURLToPath } from 'node:url'
import sinon from 'sinon'
import logger from '@overleaf/logger'
import Metrics from './helpers/metrics.mjs'
const User = UserHelper.promises

let MockV1HistoryApi

before(function () {
  MockV1HistoryApi = MockV1HistoryApiClass.instance()
})

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const fileContent = fs.readFileSync(
  Path.join(__dirname, '../files/2pixel.png'),
  'utf-8'
)

describe('HistoryTests', function () {
  let user, projectId, fileId, fileHash, fileURL, blobURL
  let historySource

  async function getSourceMetric(source) {
    return await Metrics.promises.getMetric(
      line => line.includes('request_blob') && line.includes(source)
    )
  }
  beforeEach('create project', async function () {
    user = new User()
    await user.login()

    projectId = await user.createProject('project1')
    const project = await ProjectGetter.promises.getProject(projectId)
    ;({ entity_id: fileId, hash: fileHash } =
      await user.uploadFileInProjectFull(
        projectId,
        project.rootFolder[0]._id.toString(),
        '2pixel.png',
        '2pixel.png',
        'image/png'
      ))
    fileURL = `/project/${projectId}/file/${fileId}`
    blobURL = `/project/${projectId}/blob/${fileHash}`
    historySource = await getSourceMetric('history-v1')
  })

  async function expectHistoryV1Hit() {
    expect(await getSourceMetric('history-v1')).to.equal(historySource + 1)
  }
  async function expectNoIncrement() {
    expect(await getSourceMetric('history-v1')).to.equal(historySource)
  }

  describe('/project/:projectId/download/zip', function () {
    let spy, downloadZIPURL
    beforeEach(async function () {
      spy = sinon.spy(logger, 'error')
      downloadZIPURL = `/project/${projectId}/download/zip`
    })
    afterEach(function () {
      spy.restore()
    })
    it('should work from history-v1', async function () {
      const { response, body } = await user.doRequest('GET', downloadZIPURL)
      expect(response.statusCode).to.equal(200)
      expect(body).to.include('2pixel.png')
      await expectHistoryV1Hit()
    })
    it('should not include when missing', async function () {
      MockV1HistoryApi.reset()
      const { response, body } = await user.doRequest('GET', downloadZIPURL)
      expect(response.statusCode).to.equal(200)
      expect(
        spy.args.find(([, msg]) => msg === 'error adding files to zip stream')
      ).to.exist
      expect(body).to.not.include('2pixel.png')
      await expectNoIncrement()
    })
  })

  describe('/project/:projectId/blob/:hash', function () {
    describe('HEAD', function () {
      it('should fetch the file size from history-v1', async function () {
        const { response } = await user.doRequest('HEAD', blobURL)
        expect(response.statusCode).to.equal(200)
        expect(response.headers['content-length']).to.equal('3694')
        await expectHistoryV1Hit()
      })
      it('should return 404 without fallback', async function () {
        MockV1HistoryApi.reset()
        const { response } = await user.doRequest('HEAD', blobURL)
        expect(response.statusCode).to.equal(404)
        await expectNoIncrement()
      })
    })
    describe('GET', function () {
      it('should fetch the file from history-v1', async function () {
        const { response, body } = await user.doRequest('GET', blobURL)
        expect(response.statusCode).to.equal(200)
        expect(body).to.equal(fileContent)
        await expectHistoryV1Hit()
      })
      it('should set cache headers', async function () {
        const { response } = await user.doRequest('GET', blobURL)
        expect(response.headers['cache-control']).to.equal(
          'private, max-age=86400, stale-while-revalidate=31536000'
        )
        expect(response.headers.etag).to.equal(fileHash)
      })
      it('should return a 304 when revalidating', async function () {
        const { response, body } = await user.doRequest('GET', {
          url: blobURL,
          headers: { 'If-None-Match': fileHash },
        })
        expect(response.statusCode).to.equal(304)
        expect(response.headers.etag).to.equal(fileHash)
        expect(body).to.equal('')
      })
      it('should return 404 without fallback', async function () {
        MockV1HistoryApi.reset()
        const { response } = await user.doRequest('GET', blobURL)
        expect(response.statusCode).to.equal(404)
        await expectNoIncrement()
      })
      it('should not set cache headers on 404', async function () {
        MockV1HistoryApi.reset()
        const { response } = await user.doRequest('GET', blobURL)
        expect(response.statusCode).to.equal(404)
        expect(response.headers).not.to.have.property('cache-control')
        expect(response.headers).not.to.have.property('etag')
      })
    })
  })

  // Legacy endpoint that is powered by history-v1 in SaaS
  describe('/project/:projectId/file/:fileId', function () {
    describe('HEAD', function () {
      it('should fetch the file size from history-v1', async function () {
        const { response } = await user.doRequest('HEAD', fileURL)
        expect(response.statusCode).to.equal(200)
        expect(response.headers['content-length']).to.equal('3694')
        await expectHistoryV1Hit()
      })
      it('should return 404 with both files missing', async function () {
        MockV1HistoryApi.reset()
        const { response } = await user.doRequest('HEAD', blobURL)
        expect(response.statusCode).to.equal(404)
      })
    })
    describe('GET', function () {
      it('should fetch the file from history-v1', async function () {
        const { response, body } = await user.doRequest('GET', fileURL)
        expect(response.statusCode).to.equal(200)
        expect(body).to.equal(fileContent)
        await expectHistoryV1Hit()
      })
      it('should set cache headers', async function () {
        const { response } = await user.doRequest('GET', fileURL)
        expect(response.headers['cache-control']).to.equal(
          'private, max-age=3600'
        )
      })
      it('should not set cache headers on 404', async function () {
        MockV1HistoryApi.reset()
        // The legacy filestore downloads are not properly handling 404s, so delete the file from the file-tree to trigger the 404. All the filestore code will be removed soon.
        await user.doRequest('DELETE', fileURL)

        const { response } = await user.doRequest('GET', fileURL)
        expect(response.statusCode).to.equal(404)
        expect(response.headers).not.to.have.property('cache-control')
        expect(response.headers).not.to.have.property('etag')
      })
      it('should return 404 when missing', async function () {
        MockV1HistoryApi.reset()
        const { response } = await user.doRequest('GET', fileURL)
        expect(response.statusCode).to.equal(404)
      })
    })
  })
})
