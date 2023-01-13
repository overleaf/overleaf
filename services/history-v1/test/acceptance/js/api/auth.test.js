const config = require('config')
const fetch = require('node-fetch')
const sinon = require('sinon')
const { expect } = require('chai')

const cleanup = require('../storage/support/cleanup')
const expectResponse = require('./support/expect_response')
const fixtures = require('../storage/support/fixtures')
const HTTPStatus = require('http-status')
const testServer = require('./support/test_server')

describe('auth', function () {
  beforeEach(cleanup.everything)
  beforeEach(fixtures.create)
  beforeEach('Set up stubs', function () {
    sinon.stub(config, 'has').callThrough()
    sinon.stub(config, 'get').callThrough()
  })
  afterEach(sinon.restore)

  it('renders 401 on swagger docs endpoint without auth', async function () {
    const response = await fetch(testServer.url('/docs'))
    expect(response.status).to.equal(HTTPStatus.UNAUTHORIZED)
    expect(response.headers.get('www-authenticate')).to.match(/^Basic/)
  })

  it('renders swagger docs endpoint with auth', async function () {
    const response = await fetch(testServer.url('/docs'), {
      headers: {
        Authorization: testServer.basicAuthHeader,
      },
    })
    expect(response.ok).to.be.true
  })

  it('takes an old basic auth password during a password change', async function () {
    setMockConfig('basicHttpAuth.oldPassword', 'foo')

    // Primary should still work.
    const response1 = await fetch(testServer.url('/docs'), {
      headers: {
        Authorization: testServer.basicAuthHeader,
      },
    })
    expect(response1.ok).to.be.true

    // Old password should also work.
    const response2 = await fetch(testServer.url('/docs'), {
      headers: {
        Authorization: 'Basic ' + Buffer.from('staging:foo').toString('base64'),
      },
    })
    expect(response2.ok).to.be.true

    // Incorrect password should not work.
    const response3 = await fetch(testServer.url('/docs'), {
      header: {
        Authorization: 'Basic ' + Buffer.from('staging:bar').toString('base64'),
      },
    })
    expect(response3.status).to.equal(HTTPStatus.UNAUTHORIZED)
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
