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

const { globalBlobs } = require('../../../../storage/lib/mongodb.js')
const {
  loadGlobalBlobs,
} = require('../../../../storage/lib/blob_store/index.js')

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

    it('supports range request from beginning', async function () {
      const url = new URL(
        testServer.url(
          `/api/projects/${projectId}/blobs/${testFiles.HELLO_TXT_HASH}`
        )
      )
      url.searchParams.append('token', token)
      const response = await fetch(url, { headers: { Range: 'bytes=0-4' } })
      const payload = await response.text()
      // 0-4 is inclusive, so 5 bytes
      expect(payload).to.equal(fileContents.slice(0, 5).toString())
      expect(response.headers.get('Content-Range')).to.equal(
        `bytes 0-4/${testFiles.HELLO_TXT_BYTE_LENGTH}`
      )
      expect(response.headers.get('Content-Length')).to.equal('5')
      expect(response.status).to.equal(HTTPStatus.PARTIAL_CONTENT)
    })

    it('supports range request in middle', async function () {
      const url = new URL(
        testServer.url(
          `/api/projects/${projectId}/blobs/${testFiles.HELLO_TXT_HASH}`
        )
      )
      url.searchParams.append('token', token)
      const response = await fetch(url, { headers: { Range: 'bytes=5-9' } })
      const payload = await response.text()
      // 5-9 is inclusive, so 5 bytes
      expect(payload).to.equal(fileContents.slice(5, 10).toString())
      expect(response.headers.get('Content-Range')).to.equal(
        `bytes 5-9/${testFiles.HELLO_TXT_BYTE_LENGTH}`
      )
      expect(response.headers.get('Content-Length')).to.equal('5')
      expect(response.status).to.equal(HTTPStatus.PARTIAL_CONTENT)
    })

    it('supports range request past end', async function () {
      const url = new URL(
        testServer.url(
          `/api/projects/${projectId}/blobs/${testFiles.HELLO_TXT_HASH}`
        )
      )
      url.searchParams.append('token', token)
      const response = await fetch(url, { headers: { Range: 'bytes=5-100' } })
      const payload = await response.text()
      expect(payload).to.equal(fileContents.slice(5).toString())
      // Response range should be capped to the actual file size
      expect(response.headers.get('Content-Range')).to.equal(
        `bytes 5-10/${testFiles.HELLO_TXT_BYTE_LENGTH}`
      )
      expect(response.headers.get('Content-Length')).to.equal('6')
      expect(response.status).to.equal(HTTPStatus.PARTIAL_CONTENT)
    })

    describe('with invalid request ranges', async function () {
      async function testInvalidRange(range) {
        const url = new URL(
          testServer.url(
            `/api/projects/${projectId}/blobs/${testFiles.HELLO_TXT_HASH}`
          )
        )
        url.searchParams.append('token', token)
        const response = await fetch(url, { headers: { Range: range } })

        expect(response.headers.get('Content-Range')).to.equal(
          `bytes */${testFiles.HELLO_TXT_BYTE_LENGTH}`
        )
        expect(response.headers.get('Content-Length')).to.equal('0')
        expect(response.status).to.equal(
          HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE
        )
      }

      it('should fail on invalid range where start > end', async function () {
        testInvalidRange('bytes=10-5')
      })

      it('should fail on invalid range where start = length', async function () {
        testInvalidRange(`bytes=${testFiles.HELLO_TXT_BYTE_LENGTH + 1}-105`)
      })

      it('should fail on invalid range where start > length', async function () {
        testInvalidRange(`bytes=${testFiles.HELLO_TXT_BYTE_LENGTH}-105`)
      })
    })

    describe('with an empty blob', async function () {
      beforeEach(async function () {
        const response = await fetch(
          testServer.url(
            `/api/projects/${projectId}/blobs/${testFiles.EMPTY_FILE_HASH}`
          ),
          {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}` },
            body: '',
          }
        )
        expect(response.ok).to.be.true
      })

      it('should not handle range requests', async function () {
        const url = new URL(
          testServer.url(
            `/api/projects/${projectId}/blobs/${testFiles.EMPTY_FILE_HASH}`
          )
        )
        url.searchParams.append('token', token)
        const response = await fetch(url, { headers: { Range: 'bytes=0-0' } })
        expect(response.headers.get('Content-Range')).to.equal(
          `bytes */${testFiles.EMPTY_FILE_BYTE_LENGTH}`
        )
        expect(response.headers.get('Content-Length')).to.equal('0')
        expect(response.status).to.equal(
          HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE
        )
      })

      it('should handle full requests', async function () {
        const url = new URL(
          testServer.url(
            `/api/projects/${projectId}/blobs/${testFiles.EMPTY_FILE_HASH}`
          )
        )
        url.searchParams.append('token', token)
        const response = await fetch(url)
        const payload = await response.text()
        expect(payload).to.equal('')
        expect(response.status).to.equal(HTTPStatus.OK)
      })
    })

    it('supports HEAD request', async function () {
      const url = new URL(
        testServer.url(
          `/api/projects/${projectId}/blobs/${testFiles.HELLO_TXT_HASH}`
        )
      )
      url.searchParams.append('token', token)
      const response = await fetch(url, { method: 'HEAD' })
      expect(response.headers.get('Content-Length')).to.equal(
        testFiles.HELLO_TXT_BYTE_LENGTH.toString()
      )
      const payload = await response.text()
      expect(payload).to.have.length(0)
    })

    it('rejects an unautorized request', async function () {
      const response = await fetch(
        testServer.url(
          `/api/projects/${projectId}/blobs/${testFiles.HELLO_TXT_HASH}`
        )
      )
      expect(response.status).to.equal(HTTPStatus.UNAUTHORIZED)
    })

    it('copies the blob to another project', async function () {
      const targetProjectId = '456'
      const targetClient =
        await testServer.createClientForProject(targetProjectId)
      const targetToken = testServer.createTokenForProject(targetProjectId)
      const url = new URL(
        testServer.url(
          `/api/projects/${targetProjectId}/blobs/${testFiles.HELLO_TXT_HASH}`
        )
      )
      url.searchParams.append('copyFrom', projectId)

      const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${targetToken}` },
      })
      expect(response.status).to.equal(HTTPStatus.CREATED)

      const newBlobResponse = await targetClient.apis.Project.getProjectBlob({
        project_id: targetProjectId,
        hash: testFiles.HELLO_TXT_HASH,
      })
      const newBlobResponseText = await newBlobResponse.data.text()
      expect(newBlobResponseText).to.equal(fileContents.toString())
    })

    it('skips copying a blob to another project if it already exists', async function () {
      const targetProjectId = '456'
      const targetClient =
        await testServer.createClientForProject(targetProjectId)
      const targetToken = testServer.createTokenForProject(targetProjectId)

      const fileContents = await fs.promises.readFile(
        testFiles.path('hello.txt')
      )
      const uploadResponse = await fetch(
        testServer.url(
          `/api/projects/${targetProjectId}/blobs/${testFiles.HELLO_TXT_HASH}`
        ),
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${targetToken}` },
          body: fileContents,
        }
      )
      expect(uploadResponse.ok).to.be.true

      const url = new URL(
        testServer.url(
          `/api/projects/${targetProjectId}/blobs/${testFiles.HELLO_TXT_HASH}`
        )
      )
      url.searchParams.append('copyFrom', projectId)

      const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${targetToken}` },
      })
      expect(response.status).to.equal(HTTPStatus.NO_CONTENT)

      const newBlobResponse = await targetClient.apis.Project.getProjectBlob({
        project_id: targetProjectId,
        hash: testFiles.HELLO_TXT_HASH,
      })
      const newBlobResponseText = await newBlobResponse.data.text()
      expect(newBlobResponseText).to.equal(fileContents.toString())
    })
  })

  describe('with a global blob', async function () {
    before(async function () {
      await globalBlobs.insertOne({
        _id: testFiles.STRING_A_HASH,
        byteLength: 1,
        stringLength: 1,
      })
      await loadGlobalBlobs()
    })

    it('does not copy global blobs', async function () {
      const targetProjectId = '456'
      const targetToken = testServer.createTokenForProject(targetProjectId)
      const url = new URL(
        testServer.url(
          `/api/projects/${targetProjectId}/blobs/${testFiles.STRING_A_HASH}`
        )
      )
      url.searchParams.append('copyFrom', projectId)

      const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${targetToken}` },
      })
      expect(response.status).to.equal(HTTPStatus.NO_CONTENT)
    })
  })
})
