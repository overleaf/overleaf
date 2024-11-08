const { expect } = require('chai')
const config = require('config')
const fs = require('node:fs')
const fetch = require('node-fetch')
const HTTPStatus = require('http-status')

const cleanup = require('../storage/support/cleanup')
const fixtures = require('../storage/support/fixtures')
const testFiles = require('../storage/support/test_files')
const testServer = require('./support/test_server')
const { expectHttpError } = require('./support/expect_response')

describe('Project blobs API', function () {
  const projectId = '123'

  beforeEach(cleanup.everything)
  beforeEach(fixtures.create)

  let client
  let token
  before(async function () {
    client = await testServer.createClientForProject(projectId)
    token = testServer.createTokenForProject(projectId)
  })

  it('returns 404 if the blob is not found', async function () {
    const testHash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    await expectHttpError(
      client.apis.Project.getProjectBlob({
        project_id: projectId,
        hash: testHash,
      }),
      HTTPStatus.NOT_FOUND
    )
  })

  it('checks if file hash matches the hash parameter', async function () {
    const testHash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const response = await fetch(
      testServer.url(`/api/projects/${projectId}/blobs/${testHash}`),
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: fs.createReadStream(testFiles.path('hello.txt')),
      }
    )
    expect(response.status).to.equal(HTTPStatus.CONFLICT)

    // check that it did not store the file
    await expectHttpError(
      client.apis.Project.getProjectBlob({
        project_id: projectId,
        hash: testFiles.HELLO_TXT_HASH,
      }),
      HTTPStatus.NOT_FOUND
    )
  })

  it('rejects oversized files', async function () {
    const testHash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const buffer = Buffer.alloc(
      parseInt(config.get('maxFileUploadSize'), 10) + 1
    )
    const response = await fetch(
      testServer.url(`/api/projects/${projectId}/blobs/${testHash}`),
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: buffer,
      }
    )
    expect(response.status).to.equal(HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
  })

  describe('with an existing blob', async function () {
    let fileContents

    beforeEach(async function () {
      fileContents = await fs.promises.readFile(testFiles.path('hello.txt'))
      const response = await fetch(
        testServer.url(
          `/api/projects/${projectId}/blobs/${testFiles.HELLO_TXT_HASH}`
        ),
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
          body: fileContents,
        }
      )
      expect(response.ok).to.be.true
    })

    it('fulfills a request with a JWT header', async function () {
      const response = await client.apis.Project.getProjectBlob({
        project_id: projectId,
        hash: testFiles.HELLO_TXT_HASH,
      })
      const responseText = await response.data.text()
      expect(responseText).to.equal(fileContents.toString())
    })

    it('fulfills a request with a token parameter', async function () {
      const url = new URL(
        testServer.url(
          `/api/projects/${projectId}/blobs/${testFiles.HELLO_TXT_HASH}`
        )
      )
      url.searchParams.append('token', token)
      const response = await fetch(url)
      const payload = await response.text()
      expect(payload).to.equal(fileContents.toString())
    })

    it('rejects an unautorized request', async function () {
      const response = await fetch(
        testServer.url(
          `/api/projects/${projectId}/blobs/${testFiles.HELLO_TXT_HASH}`
        )
      )
      expect(response.status).to.equal(HTTPStatus.UNAUTHORIZED)
    })
  })
})
