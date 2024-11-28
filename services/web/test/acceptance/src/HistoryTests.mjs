import fs from 'node:fs'
import Path from 'node:path'
import { expect } from 'chai'
import UserHelper from './helpers/User.js'
import MockV1HistoryApiClass from './mocks/MockV1HistoryApi.js'
import ProjectGetter from '../../../app/src/Features/Project/ProjectGetter.js'
import MockFilestoreApiClass from './mocks/MockFilestoreApi.js'
import { fileURLToPath } from 'node:url'
import Metrics from './helpers/metrics.js'
const User = UserHelper.promises

let MockV1HistoryApi, MockFilestoreApi

before(function () {
  MockV1HistoryApi = MockV1HistoryApiClass.instance()
  MockFilestoreApi = MockFilestoreApiClass.instance()
})

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const fileContent = fs.readFileSync(
  Path.join(__dirname, '../files/2pixel.png'),
  'utf-8'
)

describe('HistoryTests', function () {
  let user, projectId, fileId, fileHash, fileURL, fileURLWithFallback
  let historySource, filestoreSource

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
    fileURL = `/project/${projectId}/blob/${fileHash}`
    fileURLWithFallback = `${fileURL}?fallback=${fileId}`
    historySource = await getSourceMetric('history-v1')
    filestoreSource = await getSourceMetric('filestore')
  })

  async function expectHistoryV1Hit() {
    expect(await getSourceMetric('history-v1')).to.equal(historySource + 1)
    expect(await getSourceMetric('filestore')).to.equal(filestoreSource)
  }
  async function expectFilestoreHit() {
    expect(await getSourceMetric('history-v1')).to.equal(historySource)
    expect(await getSourceMetric('filestore')).to.equal(filestoreSource + 1)
  }
  async function expectNoIncrement() {
    expect(await getSourceMetric('history-v1')).to.equal(historySource)
    expect(await getSourceMetric('filestore')).to.equal(filestoreSource)
  }

  describe('/project/:projectId/blob/:hash', function () {
    describe('HEAD', function () {
      it('should fetch the file size from history-v1', async function () {
        const { response } = await user.doRequest('HEAD', fileURL)
        expect(response.statusCode).to.equal(200)
        expect(response.headers['x-served-by']).to.include('history-v1')
        expect(response.headers['content-length']).to.equal('3694')
        await expectHistoryV1Hit()
      })
      it('should return 404 without fallback', async function () {
        MockV1HistoryApi.reset()
        const { response } = await user.doRequest('HEAD', fileURL)
        expect(response.statusCode).to.equal(404)
        await expectNoIncrement()
      })
      it('should fetch the file size from filestore when missing in history-v1', async function () {
        MockV1HistoryApi.reset()
        const { response } = await user.doRequest('HEAD', fileURLWithFallback)
        expect(response.statusCode).to.equal(200)
        expect(response.headers['x-served-by']).to.include('filestore')
        expect(response.headers['content-length']).to.equal('3694')
        await expectFilestoreHit()
      })
      it('should return 404 with both files missing', async function () {
        MockFilestoreApi.reset()
        MockV1HistoryApi.reset()
        const { response } = await user.doRequest('HEAD', fileURLWithFallback)
        expect(response.statusCode).to.equal(404)
        await expectNoIncrement()
      })
    })
    describe('GET', function () {
      it('should fetch the file from history-v1', async function () {
        const { response, body } = await user.doRequest('GET', fileURL)
        expect(response.statusCode).to.equal(200)
        expect(response.headers['x-served-by']).to.include('history-v1')
        expect(body).to.equal(fileContent)
        await expectHistoryV1Hit()
      })
      it('should return 404 without fallback', async function () {
        MockV1HistoryApi.reset()
        const { response } = await user.doRequest('GET', fileURL)
        expect(response.statusCode).to.equal(404)
        await expectNoIncrement()
      })
      it('should fetch the file size from filestore when missing in history-v1', async function () {
        MockV1HistoryApi.reset()
        const { response, body } = await user.doRequest(
          'GET',
          fileURLWithFallback
        )
        expect(response.statusCode).to.equal(200)
        expect(response.headers['x-served-by']).to.include('filestore')
        expect(body).to.equal(fileContent)
        await expectFilestoreHit()
      })
      it('should return 404 with both files missing', async function () {
        MockFilestoreApi.reset()
        MockV1HistoryApi.reset()
        const { response } = await user.doRequest('GET', fileURLWithFallback)
        expect(response.statusCode).to.equal(404)
        await expectNoIncrement()
      })
    })
  })
})
