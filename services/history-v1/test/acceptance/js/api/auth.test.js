const config = require('config')
const sinon = require('sinon')
const { expect } = require('chai')
const nodeFetch = require('node-fetch')

const cleanup = require('../storage/support/cleanup')
const expectResponse = require('./support/expect_response')
const fixtures = require('../storage/support/fixtures')
const testServer = require('./support/test_server')

describe('auth', function () {
  beforeEach(cleanup.everything)
  beforeEach(fixtures.create)
  beforeEach('Set up stubs', function () {
    sinon.stub(config, 'has').callThrough()
    sinon.stub(config, 'get').callThrough()
  })
  afterEach(sinon.restore)

  it('protects /docs with basic auth', async function () {
    const url = testServer.url('/docs')

    const unauthenticatedResponse = await nodeFetch(url)
    expect(unauthenticatedResponse.status).to.equal(401)
    expect(unauthenticatedResponse.headers.get('www-authenticate')).to.match(
      /^Basic/
    )

    const badHeader =
      'Basic ' + Buffer.from('staging:wrong-password').toString('base64')
    const badPasswordResponse = await nodeFetch(url, {
      headers: { Authorization: badHeader },
    })
    expect(badPasswordResponse.status).to.equal(401)

    const validResponse = await nodeFetch(url, {
      headers: { Authorization: testServer.basicAuthHeader },
    })
    expect(validResponse.status).to.equal(200)
  })

  it('renders 401 on ProjectImport endpoints', async function () {
    const unauthenticatedClient = testServer.client
    try {
      await unauthenticatedClient.apis.ProjectImport.importSnapshot1({
        project_id: '1',
        snapshot: { files: {} },
      })
      expect.fail()
    } catch (err) {
      expectResponse.unauthorized(err)
      expect(err.response.headers['www-authenticate']).to.match(/^Basic/)
    }

    // check that the snapshot was not persisted even if the response was a 401
    const projectClient = await testServer.createClientForProject('1')
    try {
      await projectClient.apis.Project.getLatestHistory({ project_id: '1' })
      expect.fail()
    } catch (err) {
      expectResponse.notFound(err)
    }
  })

  it('renders 401 for JWT endpoints', function () {
    return testServer.client.apis.Project.getLatestHistory({
      project_id: '10000',
    })
      .then(() => {
        expect.fail()
      })
      .catch(err => {
        expectResponse.unauthorized(err)
        expect(err.response.headers['www-authenticate']).to.equal('Bearer')
      })
  })

  it('accepts basic auth in place of JWT (for now)', function () {
    const projectId = fixtures.docs.initializedProject.id
    return testServer.pseudoJwtBasicAuthClient.apis.Project.getLatestHistory({
      project_id: projectId,
    }).then(response => {
      expect(response.obj.chunk).to.exist
    })
  })

  it('uses JWT', function () {
    const projectId = fixtures.docs.initializedProject.id
    return testServer
      .createClientForProject(projectId)
      .then(client => {
        return client.apis.Project.getLatestHistory({
          project_id: projectId,
        })
      })
      .then(response => {
        expect(response.obj.chunk).to.exist
      })
  })

  it('checks for project id', function () {
    return testServer
      .createClientForProject('1')
      .then(client => {
        return client.apis.Project.getLatestHistory({
          project_id: '2',
        })
      })
      .then(() => {
        expect.fail()
      })
      .catch(expectResponse.forbidden)
  })

  it('does not accept jwt for ProjectUpdate endpoints', function () {
    return testServer.createClientForProject('1').then(client => {
      return client.apis.ProjectImport.importSnapshot1({
        project_id: '1',
        snapshot: {},
      })
        .then(() => {
          expect.fail()
        })
        .catch(expectResponse.unauthorized)
    })
  })

  describe('when an old JWT key is defined', function () {
    beforeEach(function () {
      setMockConfig('jwtAuth.oldKey', 'old-secret')
    })

    it('accepts the old key', async function () {
      const projectId = fixtures.docs.initializedProject.id
      const client = await testServer.createClientForProject(projectId, {
        jwtKey: 'old-secret',
      })
      const response = await client.apis.Project.getLatestHistory({
        project_id: projectId,
      })
      expect(response.obj.chunk).to.exist
    })

    it('accepts the new key', async function () {
      const projectId = fixtures.docs.initializedProject.id
      const client = await testServer.createClientForProject(projectId)
      const response = await client.apis.Project.getLatestHistory({
        project_id: projectId,
      })
      expect(response.obj.chunk).to.exist
    })

    it('rejects other keys', async function () {
      const projectId = fixtures.docs.initializedProject.id
      const client = await testServer.createClientForProject(projectId, {
        jwtKey: 'bad-secret',
      })
      try {
        await client.apis.Project.getLatestHistory({
          project_id: projectId,
        })
        expect.fail()
      } catch (err) {
        expectResponse.unauthorized(err)
      }
    })
  })
})

function setMockConfig(path, value) {
  config.has.withArgs(path).returns(true)
  config.get.withArgs(path).returns(value)
}
