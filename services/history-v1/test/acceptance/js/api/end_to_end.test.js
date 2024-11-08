'use strict'

const BPromise = require('bluebird')
const { expect } = require('chai')
const HTTPStatus = require('http-status')
const fetch = require('node-fetch')
const fs = BPromise.promisifyAll(require('node:fs'))

const cleanup = require('../storage/support/cleanup')
const fixtures = require('../storage/support/fixtures')
const testFiles = require('../storage/support/test_files')
const testProjects = require('./support/test_projects')
const testServer = require('./support/test_server')

const core = require('overleaf-editor-core')
const Change = core.Change
const ChunkResponse = core.ChunkResponse
const File = core.File
const Operation = core.Operation
const Snapshot = core.Snapshot
const TextOperation = core.TextOperation

const blobHash = require('../../../../storage').blobHash

describe('overleaf ot', function () {
  beforeEach(cleanup.everything)
  beforeEach(fixtures.create)

  this.timeout(10000) // it takes a while on Docker for Mac

  it('can use API', function () {
    let client, downloadZipClient

    const basicAuthClient = testServer.basicAuthClient
    return (
      testProjects
        .createEmptyProject()
        .then(projectId => {
          return testServer
            .createClientForProject(projectId)
            .then(clientForProject => {
              client = clientForProject
              return testServer.createClientForDownloadZip(projectId)
            })
            .then(clientForProject => {
              downloadZipClient = clientForProject
              return projectId
            })
        })

        // the project is currently empty
        .then(projectId => {
          return client.apis.Project.getLatestContent({
            project_id: projectId,
          }).then(response => {
            const snapshot = Snapshot.fromRaw(response.obj)
            expect(snapshot.countFiles()).to.equal(0)
            return projectId
          })
        })

        // upload a blob and add two files using it
        .then(projectId => {
          return fetch(
            testServer.url(
              `/api/projects/${projectId}/blobs/${testFiles.GRAPH_PNG_HASH}`,
              { qs: { pathname: 'graph_1.png' } }
            ),
            {
              method: 'PUT',
              body: fs.createReadStream(testFiles.path('graph.png')),
              headers: {
                Authorization: testServer.basicAuthHeader,
              },
            }
          )
            .then(response => {
              expect(response.ok).to.be.true
            })
            .then(() => {
              const testFile = File.fromHash(testFiles.GRAPH_PNG_HASH)

              const change = new Change(
                [
                  Operation.addFile('graph_1.png', testFile),
                  Operation.addFile('graph_2.png', testFile),
                ],
                new Date()
              )
              return basicAuthClient.apis.ProjectImport.importChanges1({
                project_id: projectId,
                end_version: 0,
                return_snapshot: 'hashed',
                changes: [change.toRaw()],
              })
            })
            .then(() => projectId)
        })

        // get the new project state
        .then(projectId => {
          return client.apis.Project.getLatestContent({
            project_id: projectId,
          }).then(response => {
            const snapshot = Snapshot.fromRaw(response.obj)
            expect(snapshot.countFiles()).to.equal(2)
            const file0 = snapshot.getFile('graph_1.png')
            expect(file0.getHash()).to.equal(testFiles.GRAPH_PNG_HASH)
            const file1 = snapshot.getFile('graph_2.png')
            expect(file1.getHash()).to.equal(testFiles.GRAPH_PNG_HASH)
            return projectId
          })
        })

        // get the history
        .then(projectId => {
          return client.apis.Project.getLatestHistory({
            project_id: projectId,
          }).then(response => {
            const chunk = ChunkResponse.fromRaw(response.obj).getChunk()
            const changes = chunk.getChanges()
            expect(changes.length).to.equal(1)
            const change0Timestamp = changes[0].getTimestamp().getTime()
            expect(change0Timestamp).to.be.closeTo(Date.now(), 1e4)
            return projectId
          })
        })

        // upload an empty file
        .then(projectId => {
          return fetch(
            testServer.url(
              `/api/projects/${projectId}/blobs/${File.EMPTY_FILE_HASH}`,
              { qs: { pathname: 'main.tex' } }
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
              const testFile = File.fromHash(File.EMPTY_FILE_HASH)

              const change = new Change(
                [Operation.addFile('main.tex', testFile)],
                new Date()
              )
              return basicAuthClient.apis.ProjectImport.importChanges1({
                project_id: projectId,
                end_version: 1,
                return_snapshot: 'hashed',
                changes: [change.toRaw()],
              })
            })
            .then(() => projectId)
        })

        .then(projectId => {
          // Fetch empty file blob
          return client.apis.Project.getProjectBlob({
            project_id: projectId,
            hash: File.EMPTY_FILE_HASH,
          })
            .then(response => {
              expect(response.headers['content-type']).to.equal(
                'application/octet-stream'
              )
              return response.data.arrayBuffer()
            })
            .then(buffer => {
              expect(buffer).to.deep.equal(new ArrayBuffer(0))
              return projectId
            })
        })

        // get the history
        .then(projectId => {
          return client.apis.Project.getLatestHistory({
            project_id: projectId,
          }).then(response => {
            const chunk = ChunkResponse.fromRaw(response.obj).getChunk()
            const changes = chunk.getChanges()
            expect(changes.length).to.equal(2)
            return projectId
          })
        })

        // get the new project state
        .then(projectId => {
          return client.apis.Project.getLatestContent({
            project_id: projectId,
          }).then(response => {
            const snapshot = Snapshot.fromRaw(response.obj)
            expect(snapshot.countFiles()).to.equal(3)
            expect(snapshot.getFile('graph_1.png').getHash()).to.equal(
              testFiles.GRAPH_PNG_HASH
            )
            expect(snapshot.getFile('graph_2.png').getHash()).to.equal(
              testFiles.GRAPH_PNG_HASH
            )
            expect(snapshot.getFile('main.tex').getContent()).to.equal('')
            return projectId
          })
        })

        // edit the main file
        .then(projectId => {
          const change = new Change(
            [
              Operation.editFile(
                'main.tex',
                TextOperation.fromJSON({ textOperation: ['hello'] })
              ),
            ],
            new Date()
          )
          return basicAuthClient.apis.ProjectImport.importChanges1({
            project_id: projectId,
            changes: [change.toRaw()],
            end_version: 2,
            return_snapshot: 'hashed',
          }).then(response => {
            expect(response.status).to.equal(HTTPStatus.CREATED)
            const snapshot = Snapshot.fromRaw(response.obj)
            expect(snapshot.countFiles()).to.equal(3)
            expect(snapshot.getFile('graph_1.png').getHash()).to.equal(
              testFiles.GRAPH_PNG_HASH
            )
            expect(snapshot.getFile('graph_2.png').getHash()).to.equal(
              testFiles.GRAPH_PNG_HASH
            )
            expect(snapshot.getFile('main.tex').getHash()).to.equal(
              blobHash.fromString('hello')
            )
            return projectId
          })
        })

        // get the new project state
        .then(projectId => {
          return client.apis.Project.getLatestContent({
            project_id: projectId,
          }).then(response => {
            const snapshot = Snapshot.fromRaw(response.obj)
            expect(snapshot.countFiles()).to.equal(3)
            expect(snapshot.getFile('graph_1.png').getHash()).to.equal(
              testFiles.GRAPH_PNG_HASH
            )
            expect(snapshot.getFile('graph_2.png').getHash()).to.equal(
              testFiles.GRAPH_PNG_HASH
            )
            const mainFile = snapshot.getFile('main.tex')
            expect(mainFile.getHash()).to.be.null
            expect(mainFile.getContent()).to.equal('hello')
            return projectId
          })
        })

        // edit the main file again
        .then(projectId => {
          const change = new Change(
            [
              Operation.editFile(
                'main.tex',
                TextOperation.fromJSON({ textOperation: [1, -4, 'i world'] })
              ),
            ],
            new Date()
          )
          return basicAuthClient.apis.ProjectImport.importChanges1({
            project_id: projectId,
            changes: [change.toRaw()],
            end_version: 3,
            return_snapshot: 'hashed',
          }).then(response => {
            expect(response.status).to.equal(HTTPStatus.CREATED)
            const snapshot = Snapshot.fromRaw(response.obj)
            expect(snapshot.countFiles()).to.equal(3)
            expect(snapshot.getFile('main.tex').getHash()).to.equal(
              blobHash.fromString('hi world')
            )
            return projectId
          })
        })

        // get the new project state
        .then(projectId => {
          return client.apis.Project.getLatestContent({
            project_id: projectId,
          }).then(response => {
            const snapshot = Snapshot.fromRaw(response.obj)
            expect(snapshot.countFiles()).to.equal(3)
            expect(snapshot.getFile('graph_1.png')).to.exist
            expect(snapshot.getFile('graph_2.png')).to.exist
            const mainFile = snapshot.getFile('main.tex')
            expect(mainFile.getHash()).to.be.null
            expect(mainFile.getContent()).to.equal('hi world')
            return projectId
          })
        })

        // rename the text file
        .then(projectId => {
          const change = new Change(
            [Operation.moveFile('main.tex', 'intro.tex')],
            new Date()
          )
          return basicAuthClient.apis.ProjectImport.importChanges1({
            project_id: projectId,
            changes: [change.toRaw()],
            end_version: 4,
            return_snapshot: 'hashed',
          }).then(response => {
            expect(response.status).to.equal(HTTPStatus.CREATED)
            const snapshot = Snapshot.fromRaw(response.obj)
            expect(snapshot.countFiles()).to.equal(3)
            expect(snapshot.getFile('intro.tex').getHash()).to.equal(
              blobHash.fromString('hi world')
            )
            return projectId
          })
        })

        // get the new project state
        .then(projectId => {
          return client.apis.Project.getLatestContent({
            project_id: projectId,
          }).then(response => {
            const snapshot = Snapshot.fromRaw(response.obj)
            expect(snapshot.countFiles()).to.equal(3)
            expect(snapshot.getFile('graph_1.png')).to.exist
            expect(snapshot.getFile('graph_2.png')).to.exist
            const mainFile = snapshot.getFile('intro.tex')
            expect(mainFile.getHash()).to.be.null
            expect(mainFile.getContent()).to.equal('hi world')
            return projectId
          })
        })

        // remove a graph
        .then(projectId => {
          const change = new Change(
            [Operation.removeFile('graph_1.png')],
            new Date()
          )
          return basicAuthClient.apis.ProjectImport.importChanges1({
            project_id: projectId,
            changes: [change.toRaw()],
            end_version: 5,
            return_snapshot: 'hashed',
          }).then(response => {
            expect(response.status).to.equal(HTTPStatus.CREATED)
            const snapshot = Snapshot.fromRaw(response.obj)
            expect(snapshot.countFiles()).to.equal(2)
            return projectId
          })
        })

        // get the new project state
        .then(projectId => {
          return client.apis.Project.getLatestContent({
            project_id: projectId,
          }).then(response => {
            const snapshot = Snapshot.fromRaw(response.obj)
            expect(snapshot.countFiles()).to.equal(2)
            expect(snapshot.getFile('graph_2.png')).to.exist
            const mainFile = snapshot.getFile('intro.tex')
            expect(mainFile.getHash()).to.be.null
            expect(mainFile.getContent()).to.equal('hi world')
            return projectId
          })
        })

        // download zip with project content
        .then(projectId => {
          return downloadZipClient.apis.Project.getZip({
            project_id: projectId,
            version: 6,
          }).then(response => {
            expect(response.status).to.equal(HTTPStatus.OK)
            const headers = response.headers
            expect(headers['content-type']).to.equal('application/octet-stream')
            expect(headers['content-disposition']).to.equal(
              'attachment; filename=project.zip'
            )
          })
        })
    )
  })
})
