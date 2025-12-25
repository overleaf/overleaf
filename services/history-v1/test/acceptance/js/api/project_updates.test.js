const BPromise = require('bluebird')
const { expect } = require('chai')
const fs = BPromise.promisifyAll(require('node:fs'))
const HTTPStatus = require('http-status')
const fetch = require('node-fetch')

const cleanup = require('../storage/support/cleanup')
const fixtures = require('../storage/support/fixtures')
const testFiles = require('../storage/support/test_files')
const expectResponse = require('./support/expect_response')
const testServer = require('./support/test_server')

const core = require('overleaf-editor-core')
const testProjects = require('./support/test_projects')
const Change = core.Change
const ChunkResponse = core.ChunkResponse
const File = core.File
const Operation = core.Operation
const Origin = core.Origin
const Snapshot = core.Snapshot
const TextOperation = core.TextOperation
const V2DocVersions = core.V2DocVersions

const knex = require('../../../../storage').knex

describe('history import', function () {
  beforeEach(cleanup.everything)
  beforeEach(fixtures.create)

  function changeToRaw(change) {
    return change.toRaw()
  }

  function makeChange(operation) {
    return new Change([operation], new Date(), [])
  }

  let basicAuthClient
  let pseudoJwtBasicAuthClient
  let clientForProject

  before(async function () {
    basicAuthClient = testServer.basicAuthClient
    pseudoJwtBasicAuthClient = testServer.pseudoJwtBasicAuthClient
    clientForProject = await testServer.createClientForProject('1')
  })

  it('creates blobs and then imports a snapshot and history', function () {
    // We need to be able to set the projectId to match an existing doc ID.
    const testProjectId = '1'
    const testFilePathname = 'main.tex'
    const testAuthors = [123, null]
    const testTextOperation0 = TextOperation.fromJSON({ textOperation: ['a'] })
    const testTextOperation1 = TextOperation.fromJSON({
      textOperation: [1, 'b'],
    })

    let testSnapshot

    return fetch(
      testServer.url(
        `/api/projects/${testProjectId}/blobs/${File.EMPTY_FILE_HASH}`
      ),
      {
        method: 'PUT',
        body: fs.createReadStream(testFiles.path('empty.tex')),
        headers: {
          Authorization: testServer.basicAuthHeader,
        },
      }
    )
      .then(response => {
        expect(response.ok).to.be.true
      })
      .then(() => {
        // Import project
        testSnapshot = new Snapshot()
        testSnapshot.addFile(
          testFilePathname,
          File.fromHash(File.EMPTY_FILE_HASH)
        )
        return basicAuthClient.apis.ProjectImport.importSnapshot1({
          project_id: testProjectId,
          snapshot: testSnapshot.toRaw(),
        })
      })
      .then(response => {
        // Check project is valid
        expect(response.obj.projectId).to.equal(testProjectId)
      })
      .then(() => {
        // Try importing the project again
        return basicAuthClient.apis.ProjectImport.importSnapshot1({
          project_id: testProjectId,
          snapshot: testSnapshot.toRaw(),
        })
      })
      .then(() => {
        // Check that importing a duplicate fails
        expect.fail()
      })
      .catch(expectResponse.conflict)
      .then(() => {
        // Get project history
        return clientForProject.apis.Project.getLatestHistory({
          project_id: testProjectId,
        })
      })
      .then(response => {
        // Check that the imported history is valid
        const chunk = ChunkResponse.fromRaw(response.obj).getChunk()
        const snapshot = chunk.getSnapshot()
        expect(snapshot.countFiles()).to.equal(1)
        const file = snapshot.getFile(testFilePathname)
        expect(file.getHash()).to.eql(File.EMPTY_FILE_HASH)
        expect(chunk.getChanges().length).to.equal(0)
        expect(chunk.getEndVersion()).to.equal(0)
      })
      .then(() => {
        // Import changes with an end version
        const changes = [
          makeChange(Operation.editFile(testFilePathname, testTextOperation0)),
          makeChange(Operation.editFile(testFilePathname, testTextOperation1)),
        ]
        changes[0].setAuthors(testAuthors)
        return basicAuthClient.apis.ProjectImport.importChanges1({
          project_id: testProjectId,
          changes: changes.map(changeToRaw),
          end_version: 0,
          return_snapshot: 'hashed',
        })
      })
      .then(response => {
        expect(response.status).to.equal(HTTPStatus.CREATED)
        const snapshot = Snapshot.fromRaw(response.obj)
        expect(snapshot.countFiles()).to.equal(1)
        expect(snapshot.getFile('main.tex').getHash()).to.equal(
          testFiles.STRING_AB_HASH
        )
      })

      .then(() => {
        // Get project history
        return clientForProject.apis.Project.getLatestHistory({
          project_id: testProjectId,
        })
      })
      .then(response => {
        // Check that the history is valid
        const chunkResponse = ChunkResponse.fromRaw(response.obj)
        const chunk = chunkResponse.getChunk()
        const snapshot = chunk.getSnapshot()
        expect(snapshot.countFiles()).to.equal(1)
        const file = snapshot.getFile(testFilePathname)
        expect(file.getHash()).to.equal(File.EMPTY_FILE_HASH)
        expect(chunk.getChanges().length).to.equal(2)
        const changeWithAuthors = chunk.getChanges()[0]
        expect(changeWithAuthors.getAuthors().length).to.equal(2)
        expect(changeWithAuthors.getAuthors()).to.deep.equal(testAuthors)
        expect(chunk.getStartVersion()).to.equal(0)
        expect(chunk.getEndVersion()).to.equal(2)
      })
      .then(() => {
        return clientForProject.apis.Project.getLatestHistory({
          project_id: testProjectId,
        })
      })
      .then(response => {
        // it should retrieve the same chunk
        const chunkResponse = ChunkResponse.fromRaw(response.obj)
        const chunk = chunkResponse.getChunk()
        expect(chunk.getChanges().length).to.equal(2)
        expect(chunk.getStartVersion()).to.equal(0)
        expect(chunk.getEndVersion()).to.equal(2)
      })
      .then(() => {
        // Get project's latest content
        return clientForProject.apis.Project.getLatestContent({
          project_id: testProjectId,
        })
      })
      .then(response => {
        // Check that the content is valid
        const snapshot = Snapshot.fromRaw(response.obj)
        expect(snapshot.countFiles()).to.equal(1)
        const file = snapshot.getFile(testFilePathname)
        expect(file.getContent()).to.equal('ab')
      })
  })

  it('rejects invalid changes in history', function () {
    const testProjectId = '1'
    const testFilePathname = 'main.tex'
    const testTextOperation = TextOperation.fromJSON({
      textOperation: ['a', 10],
    })

    let testSnapshot

    return fetch(
      testServer.url(
        `/api/projects/${testProjectId}/blobs/${File.EMPTY_FILE_HASH}`
      ),
      {
        method: 'PUT',
        body: fs.createReadStream(testFiles.path('empty.tex')),
        headers: {
          Authorization: testServer.basicAuthHeader,
        },
      }
    )
      .then(response => {
        expect(response.ok).to.be.true
      })
      .then(() => {
        // Import project
        testSnapshot = new Snapshot()
        testSnapshot.addFile(
          testFilePathname,
          File.fromHash(File.EMPTY_FILE_HASH)
        )
        return basicAuthClient.apis.ProjectImport.importSnapshot1({
          project_id: testProjectId,
          snapshot: testSnapshot.toRaw(),
        })
      })
      .then(response => {
        // Check project is valid
        expect(response.obj.projectId).to.equal(testProjectId)
      })
      .then(() => {
        // Import invalid changes
        const changes = [
          makeChange(Operation.editFile(testFilePathname, testTextOperation)),
        ]
        return basicAuthClient.apis.ProjectImport.importChanges1({
          project_id: testProjectId,
          end_version: 0,
          return_snapshot: 'hashed',
          changes: changes.map(changeToRaw),
        })
      })
      .then(() => {
        // Check that this fails
        expect.fail()
      })
      .catch(expectResponse.unprocessableEntity)
      .then(() => {
        // Get the latest content
        return clientForProject.apis.Project.getLatestContent({
          project_id: testProjectId,
        })
      })
      .then(response => {
        // Check that no changes have been stored
        const snapshot = Snapshot.fromRaw(response.obj)
        expect(snapshot.countFiles()).to.equal(1)
        const file = snapshot.getFile(testFilePathname)
        expect(file.getContent()).to.equal('')
      })
      .then(() => {
        // Send a change with the wrong end version that is not conflicting
        // with the latest snapshot
        const changes = [makeChange(Operation.removeFile(testFilePathname))]
        return basicAuthClient.apis.ProjectImport.importChanges1({
          project_id: testProjectId,
          end_version: 10000,
          changes,
        })
      })
      .then(() => {
        // Check that this fails
        expect.fail()
      })
      .catch(expectResponse.unprocessableEntity)
      .then(() => {
        // Get the latest project history
        return clientForProject.apis.Project.getLatestHistory({
          project_id: testProjectId,
        })
      })
      .then(response => {
        // Check that no changes have been stored
        const chunkResponse = ChunkResponse.fromRaw(response.obj)
        const changes = chunkResponse.getChunk().getChanges()
        expect(changes).to.have.length(0)
      })
  })

  it('creates and edits a file using changes', function () {
    const testProjectId = '1'
    const mainFilePathname = 'main.tex'
    const testFilePathname = 'test.tex'
    const testTextOperation = TextOperation.fromJSON({ textOperation: ['a'] })
    const inexistentAuthors = [1234, 5678]
    const projectVersion = '12345.0'
    const v2DocVersions = new V2DocVersions({
      'random-doc-id': { pathname: 'doc-path.tex', v: 123 },
    })
    const testLabelOrigin = Origin.fromRaw({
      kind: 'saved ver',
    })
    const testRestoreOrigin = Origin.fromRaw({
      kind: 'restore',
      timestamp: '2016-01-01T00:00:00',
      version: 1,
    })

    let testSnapshot

    return fetch(
      testServer.url(
        `/api/projects/${testProjectId}/blobs/${File.EMPTY_FILE_HASH}`
      ),
      {
        method: 'PUT',
        body: fs.createReadStream(testFiles.path('empty.tex')),
        headers: {
          Authorization: testServer.basicAuthHeader,
        },
      }
    )
      .then(response => {
        expect(response.ok).to.be.true
      })
      .then(() => {
        // Import a project
        testSnapshot = new Snapshot()
        testSnapshot.addFile(
          mainFilePathname,
          File.fromHash(File.EMPTY_FILE_HASH)
        )
        return basicAuthClient.apis.ProjectImport.importSnapshot1({
          project_id: testProjectId,
          snapshot: testSnapshot.toRaw(),
        })
      })
      .then(response => {
        // Check that the project is valid
        expect(response.obj.projectId).to.equal(testProjectId)
      })
      .then(() => {
        // Import changes
        const testFile = File.fromHash(File.EMPTY_FILE_HASH)
        const changes = [
          makeChange(Operation.addFile(testFilePathname, testFile)),
          makeChange(Operation.editFile(testFilePathname, testTextOperation)),
        ]
        changes[0].setProjectVersion(projectVersion)
        changes[1].setAuthors(inexistentAuthors)
        changes[1].setV2DocVersions(v2DocVersions)
        return basicAuthClient.apis.ProjectImport.importChanges1({
          project_id: testProjectId,
          end_version: 0,
          return_snapshot: 'hashed',
          changes: changes.map(changeToRaw),
        })
      })
      .then(response => {
        expect(response.status).to.equal(HTTPStatus.CREATED)
        const snapshot = Snapshot.fromRaw(response.obj)
        expect(snapshot.countFiles()).to.equal(2)
        expect(snapshot.getFile('main.tex').getHash()).to.equal(
          File.EMPTY_FILE_HASH
        )
        expect(snapshot.getFile('test.tex').getHash()).to.equal(
          testFiles.STRING_A_HASH
        )
      })
      .then(() => {
        // Get the project history
        return clientForProject.apis.Project.getLatestHistory({
          project_id: testProjectId,
        })
      })
      .then(response => {
        // it should not fail when the some of the authors do not exist anymore
        const chunkResponse = ChunkResponse.fromRaw(response.obj)
        const changes = chunkResponse.getChunk().getChanges()
        expect(changes.length).to.equal(2)
        const changeWithAuthor = changes[1]
        expect(changeWithAuthor.getAuthors()).to.deep.equal(inexistentAuthors)
      })
      .then(() => {
        // it should retrieve the latest snapshot when the changes set is empty
        return basicAuthClient.apis.ProjectImport.importChanges1({
          project_id: testProjectId,
          end_version: 0,
          return_snapshot: 'hashed',
          changes: [],
        })
      })
      .then(response => {
        // Check latest snapshot
        const snapshot = Snapshot.fromRaw(response.obj)
        expect(snapshot.countFiles()).to.equal(2)
        expect(snapshot.getFile('main.tex').getHash()).to.equal(
          File.EMPTY_FILE_HASH
        )
        expect(snapshot.getFile('test.tex').getHash()).to.equal(
          testFiles.STRING_A_HASH
        )
        expect(snapshot.getProjectVersion()).to.equal(projectVersion)
        expect(snapshot.getV2DocVersions()).to.deep.equal(v2DocVersions)
      })
      .then(() => {
        // Import changes with origin
        const testFile = File.fromHash(File.EMPTY_FILE_HASH)
        const changes = [
          makeChange(Operation.removeFile(testFilePathname)),
          makeChange(Operation.addFile(testFilePathname, testFile)),
        ]
        changes[0].setOrigin(testLabelOrigin)
        changes[1].setOrigin(testRestoreOrigin)
        return basicAuthClient.apis.ProjectImport.importChanges1({
          project_id: testProjectId,
          end_version: 0,
          changes: changes.map(changeToRaw),
        })
      })
      .then(() => {
        // Get the latest history
        return clientForProject.apis.Project.getLatestHistory({
          project_id: testProjectId,
        })
      })
      .then(response => {
        // Check that the origin is stored
        const chunkResponse = ChunkResponse.fromRaw(response.obj)
        const changes = chunkResponse.getChunk().getChanges()
        expect(changes).to.have.length(4)
        expect(changes[2].getOrigin()).to.deep.equal(testLabelOrigin)
        expect(changes[3].getOrigin()).to.deep.equal(testRestoreOrigin)
      })
      .then(() => {
        // Import invalid changes
        const testFile = File.fromHash(File.EMPTY_FILE_HASH)
        const changes = [makeChange(Operation.addFile('../../a.tex', testFile))]
        return basicAuthClient.apis.ProjectImport.importChanges1({
          project_id: testProjectId,
          end_version: 0,
          changes: changes.map(changeToRaw),
        })
      })
      .then(() => {
        // Check that this fails and returns a 422
        expect.fail()
      })
      .catch(expectResponse.unprocessableEntity)
  })

  it('imports changes with git-bridge origin', function () {
    const testProjectId = '1'
    const testFilePathname = 'git.tex'
    const testFile = File.fromHash(File.EMPTY_FILE_HASH)
    const testGitOrigin = Origin.fromRaw({
      kind: 'git-bridge',
    })

    let testSnapshot

    return fetch(
      testServer.url(
        `/api/projects/${testProjectId}/blobs/${File.EMPTY_FILE_HASH}`
      ),
      {
        method: 'PUT',
        body: fs.createReadStream(testFiles.path('empty.tex')),
        headers: {
          Authorization: testServer.basicAuthHeader,
        },
      }
    )
      .then(response => {
        expect(response.ok).to.be.true
      })
      .then(() => {
        testSnapshot = new Snapshot()
        testSnapshot.addFile(testFilePathname, testFile)
        return basicAuthClient.apis.ProjectImport.importSnapshot1({
          project_id: testProjectId,
          snapshot: testSnapshot.toRaw(),
        })
      })
      .then(response => {
        expect(response.obj.projectId).to.equal(testProjectId)
      })
      .then(() => {
        const changes = [
          makeChange(Operation.addFile(testFilePathname, testFile)),
        ]
        changes[0].setOrigin(testGitOrigin)
        return basicAuthClient.apis.ProjectImport.importChanges1({
          project_id: testProjectId,
          end_version: 0,
          changes: changes.map(changeToRaw),
        })
      })
      .then(response => {
        expect(response.status).to.equal(HTTPStatus.CREATED)
      })
      .then(() => {
        return clientForProject.apis.Project.getLatestHistory({
          project_id: testProjectId,
        })
      })
      .then(response => {
        const chunkResponse = ChunkResponse.fromRaw(response.obj)
        const changes = chunkResponse.getChunk().getChanges()
        expect(changes.length).to.be.at.least(1)
        const lastChange = changes[changes.length - 1]
        expect(lastChange.getOrigin()).to.deep.equal(testGitOrigin)
      })
  })

  it('rejects text operations on binary files', function () {
    const testProjectId = '1'
    const testFilePathname = 'main.tex'
    const testTextOperation = TextOperation.fromJSON({ textOperation: ['bb'] })

    let testSnapshot

    return fetch(
      testServer.url(
        `/api/projects/${testProjectId}/blobs/${testFiles.NON_BMP_TXT_HASH}`
      ),
      {
        method: 'PUT',
        body: fs.createReadStream(testFiles.path('non_bmp.txt')),
        headers: {
          Authorization: testServer.basicAuthHeader,
        },
      }
    )
      .then(response => {
        expect(response.ok).to.be.true
      })
      .then(() => {
        // Import a project
        testSnapshot = new Snapshot()
        testSnapshot.addFile(
          testFilePathname,
          File.fromHash(testFiles.NON_BMP_TXT_HASH)
        )
        return basicAuthClient.apis.ProjectImport.importSnapshot1({
          project_id: testProjectId,
          snapshot: testSnapshot.toRaw(),
        })
      })
      .then(response => {
        // Check that the project is valid
        expect(response.obj.projectId).to.equal(testProjectId)
      })
      .then(() => {
        // Import invalid changes
        const changes = [
          makeChange(Operation.editFile(testFilePathname, testTextOperation)),
        ]
        return basicAuthClient.apis.ProjectImport.importChanges1({
          project_id: testProjectId,
          end_version: 0,
          changes: changes.map(changeToRaw),
        })
      })
      .then(() => {
        // Expect invalid changes to fail
        expect.fail()
      })
      .catch(expectResponse.unprocessableEntity)
      .then(() => {
        // Get latest content
        return clientForProject.apis.Project.getLatestContent({
          project_id: testProjectId,
        })
      })
      .then(response => {
        // Check that no changes were stored
        const snapshot = Snapshot.fromRaw(response.obj)
        expect(snapshot.countFiles()).to.equal(1)
        expect(snapshot.getFile(testFilePathname).getHash()).to.equal(
          testFiles.NON_BMP_TXT_HASH
        )
      })
  })

  it('accepts text operation on files with null characters if stringLength is present', function () {
    const testProjectId = '1'
    const mainFilePathname = 'main.tex'
    const testTextOperation = TextOperation.fromJSON({
      textOperation: [3, 'a'],
    })

    let testSnapshot

    function importChanges() {
      const changes = [
        makeChange(Operation.editFile(mainFilePathname, testTextOperation)),
      ]
      return basicAuthClient.apis.ProjectImport.importChanges1({
        project_id: testProjectId,
        end_version: 0,
        changes: changes.map(changeToRaw),
      })
    }

    function getLatestContent() {
      return clientForProject.apis.Project.getLatestContent({
        project_id: testProjectId,
      })
    }

    return fetch(
      testServer.url(
        `/api/projects/${testProjectId}/blobs/${testFiles.NULL_CHARACTERS_TXT_HASH}`
      ),
      {
        method: 'PUT',
        body: fs.createReadStream(testFiles.path('null_characters.txt')),
        headers: {
          Authorization: testServer.basicAuthHeader,
        },
      }
    )
      .then(response => {
        expect(response.ok).to.be.true
      })
      .then(() => {
        // Import project
        testSnapshot = new Snapshot()
        testSnapshot.addFile(
          mainFilePathname,
          File.fromHash(testFiles.NULL_CHARACTERS_TXT_HASH)
        )
        return basicAuthClient.apis.ProjectImport.importSnapshot1({
          project_id: testProjectId,
          snapshot: testSnapshot.toRaw(),
        })
      })
      .then(importChanges)
      .then(() => {
        // Expect invalid changes to fail
        expect.fail()
      })
      .catch(expectResponse.unprocessableEntity)
      .then(getLatestContent)
      .then(response => {
        // Check that no changes were made
        const snapshot = Snapshot.fromRaw(response.obj)
        expect(snapshot.countFiles()).to.equal(1)
        expect(snapshot.getFile(mainFilePathname).getHash()).to.equal(
          testFiles.NULL_CHARACTERS_TXT_HASH
        )
      })
      .then(() => {
        // Set string length
        return knex('project_blobs').update(
          'string_length',
          testFiles.NULL_CHARACTERS_TXT_BYTE_LENGTH
        )
      })
      .then(importChanges)
      .then(getLatestContent)
      .then(response => {
        const snapshot = Snapshot.fromRaw(response.obj)
        expect(snapshot.countFiles()).to.equal(1)
        expect(snapshot.getFile(mainFilePathname).getContent()).to.equal(
          '\x00\x00\x00a'
        )
      })
  })

  it('returns 404 when chunk is not found in bucket', function () {
    const testProjectId = '1'
    const fooChange = makeChange(Operation.removeFile('foo.tex'))

    return knex('chunks')
      .insert({
        doc_id: testProjectId,
        start_version: 0,
        end_version: 100,
        end_timestamp: null,
      })
      .then(() => {
        // Import changes
        return basicAuthClient.apis.ProjectImport.importChanges1({
          project_id: testProjectId,
          end_version: 100,
          changes: [fooChange.toRaw()],
        })
      })
      .then(() => {
        // Expect invalid changes to fail
        expect.fail()
      })
      .catch(expectResponse.notFound)
  })

  it('creates and returns changes with v2 author ids', function () {
    const testFilePathname = 'test.tex'
    const testTextOperation = TextOperation.fromJSON({ textOperation: ['a'] })
    const v2Authors = ['5a296963ad5e82432674c839', null]

    let testProjectId

    return testProjects
      .createEmptyProject()
      .then(projectId => {
        testProjectId = projectId
        expect(testProjectId).to.be.a('string')
      })
      .then(() => {
        return fetch(
          testServer.url(
            `/api/projects/${testProjectId}/blobs/${File.EMPTY_FILE_HASH}`
          ),
          {
            method: 'PUT',
            body: fs.createReadStream(testFiles.path('empty.tex')),
            headers: {
              Authorization: testServer.basicAuthHeader,
            },
          }
        )
      })
      .then(response => {
        expect(response.ok).to.be.true
      })
      .then(() => {
        // Import changes
        const testFile = File.fromHash(File.EMPTY_FILE_HASH)
        const changes = [
          makeChange(Operation.addFile(testFilePathname, testFile)),
          makeChange(Operation.editFile(testFilePathname, testTextOperation)),
        ]
        changes[1].setV2Authors(v2Authors)
        return basicAuthClient.apis.ProjectImport.importChanges1({
          project_id: testProjectId,
          end_version: 0,
          return_snapshot: 'hashed',
          changes: changes.map(changeToRaw),
        })
      })
      .then(response => {
        expect(response.status).to.equal(HTTPStatus.CREATED)
        const snapshot = Snapshot.fromRaw(response.obj)
        expect(snapshot.countFiles()).to.equal(1)
        expect(snapshot.getFile('test.tex').getHash()).to.equal(
          testFiles.STRING_A_HASH
        )
      })
      .then(() => {
        // Get project history
        return pseudoJwtBasicAuthClient.apis.Project.getLatestHistory({
          project_id: testProjectId,
        })
      })
      .then(response => {
        // it should not fail when the some of the authors do not exist anymore
        const chunkResponse = ChunkResponse.fromRaw(response.obj)
        const changes = chunkResponse.getChunk().getChanges()
        expect(changes.length).to.equal(2)
        const changeWithAuthor = changes[1]
        expect(changeWithAuthor.getV2Authors()).to.deep.equal(v2Authors)
      })
  })

  it('should reject invalid v2 author ids', function () {
    const testFilePathname = 'test.tex'
    const v2Authors = ['not-a-v2-id']

    let testProjectId

    return testProjects
      .createEmptyProject()
      .then(projectId => {
        testProjectId = projectId
        expect(testProjectId).to.be.a('string')
      })
      .then(() => {
        return fetch(
          testServer.url(
            `/api/projects/${testProjectId}/blobs/${File.EMPTY_FILE_HASH}`
          ),
          {
            method: 'PUT',
            body: fs.createReadStream(testFiles.path('empty.tex')),
            headers: {
              Authorization: testServer.basicAuthHeader,
            },
          }
        )
      })
      .then(response => {
        expect(response.ok).to.be.true
      })
      .then(() => {
        // Import changes
        const testFile = File.fromHash(File.EMPTY_FILE_HASH)
        const changes = [
          makeChange(Operation.addFile(testFilePathname, testFile)),
        ]

        changes[0].v2Authors = v2Authors
        return basicAuthClient.apis.ProjectImport.importChanges1({
          project_id: testProjectId,
          end_version: 0,
          changes: changes.map(changeToRaw),
        })
      })
      .then(() => {
        // Check that invalid changes fail
        expect.fail()
      })
      .catch(expectResponse.unprocessableEntity)
  })

  it('should reject changes with both v1 and v2 authors ids', function () {
    const testFilePathname = 'test.tex'
    const v1Authors = [456]
    const v2Authors = ['5a296963ad5e82432674c839', null]

    let testProjectId

    return testProjects
      .createEmptyProject()
      .then(projectId => {
        testProjectId = projectId
        expect(testProjectId).to.be.a('string')
      })
      .then(() => {
        return fetch(
          testServer.url(
            `/api/projects/${testProjectId}/blobs/${File.EMPTY_FILE_HASH}`
          ),
          {
            method: 'PUT',
            body: fs.createReadStream(testFiles.path('empty.tex')),
            headers: {
              Authorization: testServer.basicAuthHeader,
            },
          }
        )
      })
      .then(response => {
        expect(response.ok).to.be.true
      })
      .then(() => {
        // Import changes
        const testFile = File.fromHash(File.EMPTY_FILE_HASH)
        const changes = [
          makeChange(Operation.addFile(testFilePathname, testFile)),
        ]

        changes[0].authors = v1Authors
        changes[0].v2Authors = v2Authors
        return basicAuthClient.apis.ProjectImport.importChanges1({
          project_id: testProjectId,
          end_version: 0,
          changes: changes.map(changeToRaw),
        })
      })
      .then(() => {
        // Check that invalid changes fail
        expect.fail()
      })
      .catch(expectResponse.unprocessableEntity)
  })

  it("returns unprocessable if end_version isn't provided", function () {
    return testProjects
      .createEmptyProject()
      .then(projectId => {
        expect(projectId).to.be.a('string')
        return projectId
      })
      .then(projectId => {
        // Import changes
        return basicAuthClient.apis.ProjectImport.importChanges1({
          project_id: projectId,
          changes: [],
        })
      })
      .then(() => {
        // Check that invalid changes fail
        expect.fail()
      })
      .catch(error => {
        expect(error.message).to.equal('request failed with status 422')
      })
  })

  it('returns unprocessable if return_snapshot is invalid', function () {
    return testProjects
      .createEmptyProject()
      .then(projectId => {
        // Import changes
        return basicAuthClient.apis.ProjectImport.importChanges1({
          project_id: projectId,
          changes: [],
          end_version: 0,
          return_snapshot: 'not_a_valid_value',
        })
      })
      .then(() => {
        // Check that invalid changes fail
        expect.fail()
      })
      .catch(error => {
        expect(error.status).to.equal(HTTPStatus.UNPROCESSABLE_ENTITY)
      })
  })
})
