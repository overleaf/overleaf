'use strict'

const { expect } = require('chai')
const HTTPStatus = require('http-status')
const fetch = require('node-fetch')
const fs = require('node:fs')

const cleanup = require('../storage/support/cleanup')
const fixtures = require('../storage/support/fixtures')
const testFiles = require('../storage/support/test_files')
const testProjects = require('./support/test_projects')
const testServer = require('./support/test_server')

const storage = require('../../../../storage')
const chunkStore = storage.chunkStore
const BlobStore = storage.BlobStore

const { Change, Operation, TextOperation } = require('overleaf-editor-core')

describe('set content', function () {
  beforeEach(cleanup.everything)
  beforeEach(fixtures.create)

  function setContent(projectId, body, opts = {}) {
    const headers = { 'Content-Type': 'application/json' }
    if (!opts.anonymous) {
      headers.Authorization = testServer.basicAuthHeader
    }
    return fetch(testServer.url(`/api/projects/${projectId}/set_content`), {
      method: 'POST',
      body: JSON.stringify({
        source: 'test-source',
        userId: 'abcdef0123456789abcdef01',
        timestamp: new Date().toISOString(),
        ...body,
      }),
      headers,
    })
  }

  function postChanges(projectId, changes, endVersion) {
    return fetch(
      testServer.url(`/api/projects/${projectId}/changes`) +
        `?end_version=${endVersion}`,
      {
        method: 'POST',
        body: JSON.stringify(changes),
        headers: {
          'Content-Type': 'application/json',
          Authorization: testServer.basicAuthHeader,
        },
      }
    )
  }

  // Commit a change returned by set_content, as a caller is expected to do
  async function applyChange(projectId, { change, baseVersion }) {
    const response = await postChanges(projectId, [change], baseVersion)
    expect(response.status).to.equal(HTTPStatus.CREATED)
  }

  async function getFileContent(projectId, pathname) {
    const blobStore = new BlobStore(projectId)
    const chunk = await chunkStore.loadLatest(projectId)
    const snapshot = chunk.getSnapshot()
    snapshot.applyAll(chunk.getChanges())
    const file = snapshot.getFile(pathname)
    await file.load('eager', blobStore)
    return file
  }

  it('requires authentication', async function () {
    const projectId = await testProjects.createEmptyProject()
    const response = await setContent(
      projectId,
      { pathname: 'main.tex', content: 'hello' },
      { anonymous: true }
    )
    expect(response.status).to.equal(HTTPStatus.UNAUTHORIZED)
  })

  it('builds create and edit changes and reports noops for a doc', async function () {
    const projectId = await testProjects.createEmptyProject()

    // Create the doc
    let response = await setContent(projectId, {
      pathname: 'main.tex',
      content: 'one\ntwo\n',
    })
    expect(response.status).to.equal(HTTPStatus.OK)
    let result = await response.json()
    expect(result.baseVersion).to.equal(0)
    expect(result.change.origin).to.deep.equal({ kind: 'test-source' })
    expect(result.change.v2Authors).to.deep.equal(['abcdef0123456789abcdef01'])
    expect(result.change.operations).to.have.length(1)
    expect(result.change.operations[0].pathname).to.equal('main.tex')
    expect(result.change.operations[0].file.hash).to.exist

    // The change is not applied until the caller commits it
    await applyChange(projectId, result)

    // Edit the doc
    response = await setContent(projectId, {
      pathname: 'main.tex',
      content: 'one\ntwo\nthree\n',
    })
    expect(response.status).to.equal(HTTPStatus.OK)
    result = await response.json()
    expect(result.baseVersion).to.equal(1)
    expect(result.change.operations).to.have.length(1)
    expect(result.change.operations[0].pathname).to.equal('main.tex')
    expect(result.change.operations[0].textOperation).to.exist
    await applyChange(projectId, result)

    // Identical content is a noop
    response = await setContent(projectId, {
      pathname: 'main.tex',
      content: 'one\ntwo\nthree\n',
    })
    expect(response.status).to.equal(HTTPStatus.OK)
    expect(await response.json()).to.deep.equal({
      baseVersion: 2,
      change: null,
    })

    const file = await getFileContent(projectId, 'main.tex')
    expect(file.getContent()).to.equal('one\ntwo\nthree\n')
  })

  it('returns a change that can be rebased on a concurrent change', async function () {
    const projectId = await testProjects.createEmptyProject()

    // Create the doc
    let response = await setContent(projectId, {
      pathname: 'main.tex',
      content: 'one\ntwo\nthree\n',
    })
    expect(response.status).to.equal(HTTPStatus.OK)
    await applyChange(projectId, await response.json())

    // Build a change that appends a line, without committing it yet
    response = await setContent(projectId, {
      pathname: 'main.tex',
      content: 'one\ntwo\nthree\nfour\n',
    })
    expect(response.status).to.equal(HTTPStatus.OK)
    const result = await response.json()
    expect(result.baseVersion).to.equal(1)

    // Meanwhile, a concurrent change inserts a line at the top
    const concurrentChange = new Change(
      [
        Operation.editFile(
          'main.tex',
          TextOperation.fromJSON({
            textOperation: ['zero\n', 'one\ntwo\nthree\n'.length],
          })
        ),
      ],
      new Date(),
      []
    )
    let commitResponse = await postChanges(
      projectId,
      [concurrentChange.toRaw()],
      result.baseVersion
    )
    expect(commitResponse.status).to.equal(HTTPStatus.CREATED)

    // The returned change no longer applies at its base version
    commitResponse = await postChanges(
      projectId,
      [result.change],
      result.baseVersion
    )
    expect(commitResponse.status).to.equal(HTTPStatus.UNPROCESSABLE_ENTITY)

    // Rebase the returned change on the concurrent change and commit it
    const rebasedChange = Change.fromRaw(result.change)
    Operation.transformMultiple(
      rebasedChange.getOperations(),
      concurrentChange.getOperations()
    )
    commitResponse = await postChanges(
      projectId,
      [rebasedChange.toRaw()],
      result.baseVersion + 1
    )
    expect(commitResponse.status).to.equal(HTTPStatus.CREATED)

    const file = await getFileContent(projectId, 'main.tex')
    expect(file.getContent()).to.equal('zero\none\ntwo\nthree\nfour\n')
  })

  it('records tracked changes when trackChanges is set', async function () {
    const projectId = await testProjects.createEmptyProject()

    let response = await setContent(projectId, {
      pathname: 'main.tex',
      content: 'hello world',
    })
    expect(response.status).to.equal(HTTPStatus.OK)
    await applyChange(projectId, await response.json())

    response = await setContent(projectId, {
      pathname: 'main.tex',
      content: 'hello brave world',
      trackChanges: true,
    })
    expect(response.status).to.equal(HTTPStatus.OK)
    const result = await response.json()
    expect(result.baseVersion).to.equal(1)
    expect(result.change).to.exist
    await applyChange(projectId, result)

    const file = await getFileContent(projectId, 'main.tex')
    expect(file.getContent({ filterTrackedDeletes: true })).to.equal(
      'hello brave world'
    )
    const trackedChanges = file.getTrackedChanges().asSorted()
    expect(trackedChanges).to.have.length(1)
    expect(trackedChanges[0].tracking.type).to.equal('insert')
    expect(trackedChanges[0].tracking.userId).to.equal(
      'abcdef0123456789abcdef01'
    )
  })

  it('sets binary file content from an uploaded blob', async function () {
    const projectId = await testProjects.createEmptyProject()

    // Create the blob first, as in the importChanges flow
    const uploadResponse = await fetch(
      testServer.url(
        `/api/projects/${projectId}/blobs/${testFiles.GRAPH_PNG_HASH}`
      ),
      {
        method: 'PUT',
        body: fs.createReadStream(testFiles.path('graph.png')),
        headers: { Authorization: testServer.basicAuthHeader },
      }
    )
    expect(uploadResponse.ok).to.be.true

    const response = await setContent(projectId, {
      pathname: 'images/graph.png',
      blobHash: testFiles.GRAPH_PNG_HASH,
    })
    expect(response.status).to.equal(HTTPStatus.OK)
    const result = await response.json()
    expect(result.baseVersion).to.equal(0)
    expect(result.change.operations).to.have.length(1)
    expect(result.change.operations[0].file.hash).to.equal(
      testFiles.GRAPH_PNG_HASH
    )
    await applyChange(projectId, result)

    const file = await getFileContent(projectId, 'images/graph.png')
    expect(file.isEditable()).to.be.false
    expect(file.getHash()).to.equal(testFiles.GRAPH_PNG_HASH)
  })

  it('rejects a payload with both content and blobHash', async function () {
    const projectId = await testProjects.createEmptyProject()
    const response = await setContent(projectId, {
      pathname: 'main.tex',
      content: 'hello',
      blobHash: testFiles.GRAPH_PNG_HASH,
    })
    expect(response.status).to.equal(HTTPStatus.UNPROCESSABLE_ENTITY)
  })

  it('rejects a payload with neither content nor blobHash', async function () {
    const projectId = await testProjects.createEmptyProject()
    const response = await setContent(projectId, { pathname: 'main.tex' })
    expect(response.status).to.equal(HTTPStatus.UNPROCESSABLE_ENTITY)
  })

  it('rejects a payload without a timestamp', async function () {
    const projectId = await testProjects.createEmptyProject()
    const response = await setContent(projectId, {
      pathname: 'main.tex',
      content: 'hello',
      timestamp: undefined,
    })
    expect(response.status).to.equal(HTTPStatus.UNPROCESSABLE_ENTITY)
  })

  it('rejects trackChanges without a userId', async function () {
    const projectId = await testProjects.createEmptyProject()
    const response = await setContent(projectId, {
      pathname: 'main.tex',
      content: 'hello',
      trackChanges: true,
      userId: undefined,
    })
    expect(response.status).to.equal(HTTPStatus.UNPROCESSABLE_ENTITY)
  })

  it('rejects an unknown blob hash', async function () {
    const projectId = await testProjects.createEmptyProject()
    const response = await setContent(projectId, {
      pathname: 'images/graph.png',
      blobHash: testFiles.GRAPH_PNG_HASH,
    })
    expect(response.status).to.equal(HTTPStatus.UNPROCESSABLE_ENTITY)
  })

  it('rejects content that is too large', async function () {
    const projectId = await testProjects.createEmptyProject()
    const response = await setContent(projectId, {
      pathname: 'main.tex',
      content: 'x'.repeat(TextOperation.MAX_STRING_LENGTH + 1),
    })
    expect(response.status).to.equal(HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
  })

  it('returns 404 for an uninitialized project', async function () {
    const projectId = fixtures.docs.uninitializedProject.id
    const response = await setContent(projectId, {
      pathname: 'main.tex',
      content: 'hello',
    })
    expect(response.status).to.equal(HTTPStatus.NOT_FOUND)
  })
})
