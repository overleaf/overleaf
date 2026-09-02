import { expect } from 'chai'
import crypto from 'node:crypto'
import _ from 'lodash'
import timekeeper from 'timekeeper'
import Settings from '@overleaf/settings'
import { CacheFlow } from 'cache-flow'
import UserHelper from './helpers/User.mjs'
import express from 'express'
import { plainTextResponse } from '../../../app/src/infrastructure/Response.mjs'
import { parseReq, z, handleValidationError } from '@overleaf/validation-tools'
import { expectValidationErrorRaw } from '@overleaf/validation-tools/testUtils.js'
import Features from '../../../app/src/infrastructure/Features.mjs'
import { db } from '../../../app/src/infrastructure/mongodb.mjs'
import MockDocstoreApiClass from './mocks/MockDocstoreApi.mjs'
import MockProjectHistoryApiClass from './mocks/MockProjectHistoryApi.mjs'
import MockV1HistoryApiClass from './mocks/MockV1HistoryApi.mjs'

const User = UserHelper.promises

const linkedUrlProxySchema = z.object({
  query: z.object({
    url: z.string(),
  }),
})

const LinkedUrlProxy = express()
LinkedUrlProxy.get('/', (req, res, next) => {
  const { query } = parseReq(req, linkedUrlProxySchema)
  if (query.url === 'http://example.com/foo') {
    return plainTextResponse(res, 'foo foo foo')
  } else if (query.url === 'http://example.com/bar') {
    return plainTextResponse(res, 'bar bar bar')
  } else if (query.url === 'http://example.com/large') {
    return plainTextResponse(res, 'x'.repeat(Settings.maxUploadSize + 1))
  } else {
    return res.sendStatus(404)
  }
})
LinkedUrlProxy.use(handleValidationError)

// history-v1 addresses blobs by the git-style sha1 of their content.
function blobHash(content) {
  const buffer = Buffer.from(content)
  return crypto
    .createHash('sha1')
    .update(`blob ${buffer.byteLength}\0`)
    .update(buffer)
    .digest('hex')
}

// The source of a linked project file is gated behind the
// `linked-file-from-history` split test. In saas, assignments come from the
// database, so seed a fully rolled out "enabled" version.
async function enableSourceSplitTest() {
  await db.splittests.updateOne(
    { name: 'linked-file-from-history' },
    {
      $set: {
        versions: [
          {
            versionNumber: 1,
            createdAt: new Date(),
            active: true,
            analyticsEnabled: false,
            phase: 'release',
            variants: [
              {
                name: 'enabled',
                rolloutPercent: 100,
                rolloutStripes: [{ start: 0, end: 100 }],
              },
            ],
          },
        ],
      },
    },
    { upsert: true }
  )
  await CacheFlow.reset('split-test')
}

// The linked file endpoints have no query string of their own, they pick up the
// split test override from the referer of the editor page.
function editorReferer(projectId, variant) {
  return `${Settings.siteUrl}/project/${projectId}?linked-file-from-history=${variant}`
}

// Both sources produce the same file, so the cases below run against each of
// them. Outside saas the override in the referer has no effect and both cases
// read from history, as set in splitTestOverrides.
const SOURCE_VARIANTS = [
  { description: 'with the source read from history', variant: 'enabled' },
  {
    description: 'with the source read from the project tree',
    variant: 'default',
  },
]

describe('LinkedFiles', function () {
  before(function () {
    timekeeper.freeze(new Date())
  })

  after(function () {
    timekeeper.reset()
  })

  let projectOne, projectOneId, projectOneRootFolderId
  let projectTwo, projectTwoId, projectTwoRootFolderId
  const sourceDocName = 'test.txt'
  const sourceDocContent = 'source doc content'
  const sourceFileName = '1pixel.png'
  const sourceFolderName = 'subdir'
  let sourceDocId
  let owner

  let MockDocstoreApi, MockProjectHistoryApi, MockV1HistoryApi
  before(function () {
    MockDocstoreApi = MockDocstoreApiClass.instance()
    MockProjectHistoryApi = MockProjectHistoryApiClass.instance()
    MockV1HistoryApi = MockV1HistoryApiClass.instance()
  })

  let server
  before(function (done) {
    server = LinkedUrlProxy.listen(6543, done)
  })
  after(function (done) {
    server.close(done)
  })

  beforeEach(async function () {
    owner = new User()
    await owner.login()
  })

  describe('creating a project linked file', function () {
    let sourceHistoryId, sourceFileHash, snapshotFiles, snapshotChanges

    // The latest chunk of the source project, as history-v1 serves it.
    function registerSourceSnapshot() {
      MockV1HistoryApi.addChunk(sourceHistoryId, {
        history: {
          snapshot: { files: snapshotFiles },
          changes: snapshotChanges,
        },
        startVersion: 0,
      })
    }

    beforeEach(async function () {
      if (Features.hasFeature('saas')) {
        await enableSourceSplitTest()
      }
    })

    beforeEach(async function () {
      projectOneId = await owner.createProject('plf-test-one', {
        template: 'blank',
      })
      projectOne = await owner.getProject(projectOneId)
      projectOneRootFolderId = projectOne.rootFolder[0]._id.toString()

      projectTwoId = await owner.createProject('plf-test-two', {
        template: 'blank',
      })
      projectTwo = await owner.getProject(projectTwoId)
      projectTwoRootFolderId = projectTwo.rootFolder[0]._id.toString()
      sourceHistoryId = projectTwo.overleaf.history.id.toString()

      sourceDocId = await owner.createDocInProject(
        projectTwoId,
        projectTwoRootFolderId,
        sourceDocName
      )
      MockDocstoreApi.addDocument(projectTwoId, sourceDocId, {
        lines: [sourceDocContent],
      })
      await owner.createDocInProject(
        projectTwoId,
        projectTwoRootFolderId,
        'some-harmless-doc.txt'
      )

      const { body: sourceFolder } = await owner.doRequest('post', {
        url: `/project/${projectTwoId}/folder`,
        json: {
          name: sourceFolderName,
          parent_folder_id: projectTwoRootFolderId,
        },
      })
      await owner.createDocInProject(
        projectTwoId,
        sourceFolder._id,
        'nested.txt'
      )

      await owner.uploadExampleFileInProject(
        projectTwoId,
        projectTwoRootFolderId,
        sourceFileName
      )
      projectTwo = await owner.getProject(projectTwoId)
      sourceFileHash = _.find(
        projectTwo.rootFolder[0].fileRefs,
        file => file.name === sourceFileName
      ).hash

      // Docs live in the docstore, so their blob only exists in history.
      MockV1HistoryApi.addBlob(
        sourceHistoryId,
        blobHash(sourceDocContent),
        sourceDocContent
      )
      snapshotFiles = {
        'main.tex': { hash: blobHash(''), stringLength: 0 },
        [sourceDocName]: {
          hash: blobHash(sourceDocContent),
          stringLength: sourceDocContent.length,
        },
        [`${sourceFolderName}/nested.txt`]: {
          hash: blobHash(''),
          stringLength: 0,
        },
        [sourceFileName]: {
          hash: sourceFileHash,
          byteLength:
            MockV1HistoryApi.blobs[sourceHistoryId][sourceFileHash].byteLength,
        },
      }
      snapshotChanges = []
      registerSourceSnapshot()
    })

    it('should produce a list of the users projects and their entities', async function () {
      let { body } = await owner.doRequest('get', {
        url: '/user/projects',
        json: true,
      })

      expect(body).to.deep.equal({
        projects: [
          {
            _id: projectOneId,
            name: 'plf-test-one',
            accessLevel: 'owner',
          },
          {
            _id: projectTwoId,
            name: 'plf-test-two',
            accessLevel: 'owner',
          },
        ],
      })
      ;({ body } = await owner.doRequest('get', {
        url: `/project/${projectTwoId}/entities`,
        json: true,
      }))
      expect(body).to.deep.equal({
        project_id: projectTwoId,
        entities: [
          { path: `/${sourceFileName}`, type: 'file' },
          { path: '/main.tex', type: 'doc' },
          { path: '/some-harmless-doc.txt', type: 'doc' },
          { path: `/${sourceFolderName}/nested.txt`, type: 'doc' },
          { path: `/${sourceDocName}`, type: 'doc' },
        ],
      })
    })

    for (const { description, variant } of SOURCE_VARIANTS) {
      describe(description, function () {
        function createLinkedFile(json) {
          return owner.doRequest('post', {
            url: `/project/${projectOneId}/linked_file`,
            json,
            headers: { referer: editorReferer(projectOneId, variant) },
          })
        }

        function refreshLinkedFile(fileId) {
          return owner.doRequest('post', {
            url: `/project/${projectOneId}/linked_file/${fileId}/refresh`,
            json: true,
            headers: { referer: editorReferer(projectOneId, variant) },
          })
        }

        it('should import a file and refresh it if there is no v1 id', async function () {
          // import the file from the source project
          let { response, body } = await createLinkedFile({
            name: 'test-link.txt',
            parent_folder_id: projectOneRootFolderId,
            provider: 'project_file',
            data: {
              source_project_id: projectTwoId,
              source_entity_path: `/${sourceDocName}`,
            },
          })
          expect(response.statusCode).to.equal(200)
          const existingFileId = body.new_file_id
          expect(existingFileId).to.exist

          let updatedProjectOne = await owner.getProject(projectOneId)

          let firstFile = updatedProjectOne.rootFolder[0].fileRefs[0]
          expect(firstFile._id.toString()).to.equal(existingFileId.toString())
          expect(firstFile.linkedFileData).to.deep.equal({
            provider: 'project_file',
            source_project_id: projectTwoId,
            source_entity_path: `/${sourceDocName}`,
            importedAt: new Date().toISOString(),
          })
          expect(firstFile.name).to.equal('test-link.txt')
          ;({ body } = await owner.doRequest(
            'get',
            `/project/${projectOneId}/file/${existingFileId}`
          ))
          expect(body).to.equal(sourceDocContent)

          // refresh the file
          ;({ response, body } = await refreshLinkedFile(existingFileId))
          expect(response.statusCode).to.equal(200)
          const newFileId = body.new_file_id
          expect(newFileId).to.exist
          expect(newFileId).to.not.equal(existingFileId)

          updatedProjectOne = await owner.getProject(projectOneId)
          firstFile = updatedProjectOne.rootFolder[0].fileRefs[0]
          expect(firstFile._id.toString()).to.equal(newFileId.toString())
          expect(firstFile.name).to.equal('test-link.txt')

          // should not work if there is a v1 id
          ;({ response, body } = await createLinkedFile({
            name: 'test-link-should-not-work.txt',
            parent_folder_id: projectOneRootFolderId,
            provider: 'project_file',
            data: {
              v1_source_doc_id: 1234,
              source_entity_path: `/${sourceDocName}`,
            },
          }))
          expect(response.statusCode).to.equal(403)
          expect(body).to.equal(
            'The project that contains this file is not shared with you'
          )
        })

        it('should import a binary file from the source project', async function () {
          const { response, body } = await createLinkedFile({
            name: 'test-link.png',
            parent_folder_id: projectOneRootFolderId,
            provider: 'project_file',
            data: {
              source_project_id: projectTwoId,
              source_entity_path: `/${sourceFileName}`,
            },
          })
          expect(response.statusCode).to.equal(200)

          const updatedProjectOne = await owner.getProject(projectOneId)
          const file = _.find(
            updatedProjectOne.rootFolder[0].fileRefs,
            file => file.name === 'test-link.png'
          )
          expect(file._id.toString()).to.equal(body.new_file_id.toString())
          expect(file.hash).to.equal(sourceFileHash)
        })

        it('should refuse to import a folder', async function () {
          const { response, body } = await createLinkedFile({
            name: 'test-link-folder.txt',
            parent_folder_id: projectOneRootFolderId,
            provider: 'project_file',
            data: {
              source_project_id: projectTwoId,
              source_entity_path: `/${sourceFolderName}`,
            },
          })
          expect(response.statusCode).to.equal(400)
          expect(body).to.equal('The file is the wrong type')
        })

        it('should generate a proper error message when the source file has been deleted', async function () {
          // import the file from the source project
          const { response: createResponse, body: createBody } =
            await createLinkedFile({
              name: 'test-link.txt',
              parent_folder_id: projectOneRootFolderId,
              provider: 'project_file',
              data: {
                source_project_id: projectTwoId,
                source_entity_path: `/${sourceDocName}`,
              },
            })
          expect(createResponse.statusCode).to.equal(200)
          const existingFileId = createBody.new_file_id
          expect(existingFileId).to.exist

          // rename the source file
          await owner.renameItemInProject(
            projectTwoId,
            'doc',
            sourceDocId,
            'renamed-doc.txt'
          )
          // the rename reaches history as a move of the pathname
          snapshotFiles['renamed-doc.txt'] = snapshotFiles[sourceDocName]
          delete snapshotFiles[sourceDocName]
          registerSourceSnapshot()

          // refresh the file
          const { response, body } = await refreshLinkedFile(existingFileId)
          expect(response.statusCode).to.equal(404)
          expect(body).to.equal('Source file not found')
        })
      })
    }

    it('should import edits that only reach history on flush', async function () {
      // Edits that are still in document-updater arrive in the snapshot as
      // operations on top of the last blob of the doc, once the source project
      // has been flushed.
      snapshotChanges = [
        {
          operations: [
            {
              pathname: sourceDocName,
              textOperation: ['edited ', sourceDocContent.length],
            },
          ],
          timestamp: new Date().toISOString(),
        },
      ]
      registerSourceSnapshot()

      const { response, body } = await owner.doRequest('post', {
        url: `/project/${projectOneId}/linked_file`,
        json: {
          name: 'test-link.txt',
          parent_folder_id: projectOneRootFolderId,
          provider: 'project_file',
          data: {
            source_project_id: projectTwoId,
            source_entity_path: `/${sourceDocName}`,
          },
        },
        headers: { referer: editorReferer(projectOneId, 'enabled') },
      })
      expect(response.statusCode).to.equal(200)
      expect(MockProjectHistoryApi.flushedProjects).to.include(projectTwoId)

      const { body: content } = await owner.doRequest(
        'get',
        `/project/${projectOneId}/file/${body.new_file_id}`
      )
      expect(content).to.equal(`edited ${sourceDocContent}`)
    })

    it('should reject a malformed file id when refreshing a linked file', async function () {
      const { response, body } = await owner.doRequest('post', {
        url: `/project/${projectOneId}/linked_file/not-an-object-id/refresh`,
        json: true,
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        404,
        'file_id'
      )
    })

    it('should reject a malformed source_project_id when creating a project_file linked file', async function () {
      const { response, body } = await owner.doRequest('post', {
        url: `/project/${projectOneId}/linked_file`,
        json: {
          name: 'test-link.txt',
          parent_folder_id: projectOneRootFolderId,
          provider: 'project_file',
          data: {
            source_project_id: 'not-an-object-id',
            source_entity_path: `/${sourceDocName}`,
          },
        },
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        400,
        'source_project_id'
      )
    })
  })

  describe('with a linked project_file from a v1 project that has not been imported', function () {
    beforeEach(async function () {
      projectOneId = await owner.createProject('plf-v1-test-one', {
        template: 'blank',
      })
      projectOne = await owner.getProject(projectOneId)
      projectOneRootFolderId = projectOne.rootFolder[0]._id.toString()
      projectOne.rootFolder[0].fileRefs.push({
        linkedFileData: {
          provider: 'project_file',
          v1_source_doc_id: 9999999, // We won't find this id in the database
          source_entity_path: 'example.jpeg',
        },
        _id: '000000000000000000000abc',
        rev: 0,
        created: new Date(),
        name: 'example.jpeg',
      })
      await owner.saveProject(projectOne)
    })

    it('should refuse to refresh', async function () {
      const { response, body } = await owner.doRequest('post', {
        url: `/project/${projectOneId}/linked_file/000000000000000000000abc/refresh`,
        json: true,
      })
      expect(response.statusCode).to.equal(409)
      expect(body).to.equal(
        'Sorry, the source project is not yet imported to Overleaf v2. Please import it to Overleaf v2 to refresh this file'
      )
    })
  })

  describe('creating a URL based linked file', function () {
    beforeEach(async function () {
      projectOneId = await owner.createProject('url-linked-files-project', {
        template: 'blank',
      })
      projectOne = await owner.getProject(projectOneId)
      projectOneRootFolderId = projectOne.rootFolder[0]._id.toString()
    })

    it('should download, create and replace a file', async function () {
      // downloading the initial file
      let { response, body } = await owner.doRequest('post', {
        url: `/project/${projectOneId}/linked_file`,
        json: {
          provider: 'url',
          data: {
            url: 'http://example.com/foo',
          },
          parent_folder_id: projectOneRootFolderId,
          name: 'url-test-file-1',
        },
      })
      expect(response.statusCode).to.equal(200)

      let updatedProject = await owner.getProject(projectOneId)
      let file = updatedProject.rootFolder[0].fileRefs[0]
      expect(file.linkedFileData).to.deep.equal({
        provider: 'url',
        url: 'http://example.com/foo',
        importedAt: new Date().toISOString(),
      })
      ;({ response, body } = await owner.doRequest(
        'get',
        `/project/${projectOneId}/file/${file._id}`
      ))
      expect(response.statusCode).to.equal(200)
      expect(body).to.equal('foo foo foo')

      // replacing the file
      ;({ response, body } = await owner.doRequest('post', {
        url: `/project/${projectOneId}/linked_file`,
        json: {
          provider: 'url',
          data: {
            url: 'http://example.com/foo',
          },
          parent_folder_id: projectOneRootFolderId,
          name: 'url-test-file-2',
        },
      }))
      expect(response.statusCode).to.equal(200)
      ;({ response, body } = await owner.doRequest('post', {
        url: `/project/${projectOneId}/linked_file`,
        json: {
          provider: 'url',
          data: {
            url: 'http://example.com/bar',
          },
          parent_folder_id: projectOneRootFolderId,
          name: 'url-test-file-2',
        },
      }))
      expect(response.statusCode).to.equal(200)

      updatedProject = await owner.getProject(projectOneId)
      file = updatedProject.rootFolder[0].fileRefs[1]
      expect(file.linkedFileData).to.deep.equal({
        provider: 'url',
        url: 'http://example.com/bar',
        importedAt: new Date().toISOString(),
      })
      ;({ response, body } = await owner.doRequest(
        'get',
        `/project/${projectOneId}/file/${file._id}`
      ))
      expect(response.statusCode).to.equal(200)
      expect(body).to.equal('bar bar bar')
    })

    it('should return an error if the file exceeds the maximum size', async function () {
      // download does not succeed
      const { response, body } = await owner.doRequest('post', {
        url: `/project/${projectOneId}/linked_file`,
        json: {
          provider: 'url',
          data: {
            url: 'http://example.com/large',
          },
          parent_folder_id: projectOneRootFolderId,
          name: 'url-large-file-1',
        },
      })
      expect(response.statusCode).to.equal(422)
      expect(body).to.equal('File too large')
    })

    it("should return an error if the file can't be downloaded", async function () {
      // download does not succeed
      let { response, body } = await owner.doRequest('post', {
        url: `/project/${projectOneId}/linked_file`,
        json: {
          provider: 'url',
          data: {
            url: 'http://example.com/does-not-exist',
          },
          parent_folder_id: projectOneRootFolderId,
          name: 'url-test-file-3',
        },
      })
      expect(response.statusCode).to.equal(422) // unprocessable
      expect(body).to.equal(
        'Your URL could not be reached (404 status code). Please check it and try again.'
      )

      // url is invalid
      ;({ response, body } = await owner.doRequest('post', {
        url: `/project/${projectOneId}/linked_file`,
        json: {
          provider: 'url',
          data: {
            url: '!^$%',
          },
          parent_folder_id: projectOneRootFolderId,
          name: 'url-test-file-4',
        },
      }))
      expect(response.statusCode).to.equal(422) // unprocessable
      expect(body).to.equal(
        'Your URL is not valid. Please check it and try again.'
      )

      // URL is non-http
      ;({ response, body } = await owner.doRequest('post', {
        url: `/project/${projectOneId}/linked_file`,
        json: {
          provider: 'url',
          data: {
            url: 'ftp://127.0.0.1',
          },
          parent_folder_id: projectOneRootFolderId,
          name: 'url-test-file-5',
        },
      }))
      expect(response.statusCode).to.equal(422) // unprocessable
      expect(body).to.equal(
        'Your URL is not valid. Please check it and try again.'
      )
    })

    it('should accept a URL withuot a leading http://, and add it', async function () {
      let { response, body } = await owner.doRequest('post', {
        url: `/project/${projectOneId}/linked_file`,
        json: {
          provider: 'url',
          data: {
            url: 'example.com/foo',
          },
          parent_folder_id: projectOneRootFolderId,
          name: 'url-test-file-6',
        },
      })
      expect(response.statusCode).to.equal(200)

      const updatedProject = await owner.getProject(projectOneId)

      const file = _.find(
        updatedProject.rootFolder[0].fileRefs,
        file => file.name === 'url-test-file-6'
      )
      expect(file.linkedFileData).to.deep.equal({
        provider: 'url',
        url: 'http://example.com/foo',
        importedAt: new Date().toISOString(),
      })
      ;({ response, body } = await owner.doRequest(
        'get',
        `/project/${projectOneId}/file/${file._id}`
      ))
      expect(response.statusCode).to.equal(200)
      expect(body).to.equal('foo foo foo')
    })

    it('should reject an unrecognized field in the linked file data', async function () {
      const { response, body } = await owner.doRequest('post', {
        url: `/project/${projectOneId}/linked_file`,
        json: {
          provider: 'url',
          data: {
            url: 'http://example.com/foo',
            notARealField: 'nope',
          },
          parent_folder_id: projectOneRootFolderId,
          name: 'url-test-file-invalid',
        },
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        400,
        'notARealField'
      )
    })
  })

  // TODO: Add test for asking for host that return ENOTFOUND
  // (This will probably end up handled by the proxy)

  describe('creating a linked output file', function () {
    beforeEach(async function () {
      projectOneId = await owner.createProject('output-test-one', {
        template: 'blank',
      })
      projectOne = await owner.getProject(projectOneId)

      projectOneRootFolderId = projectOne.rootFolder[0]._id.toString()
      projectTwoId = await owner.createProject('output-test-two', {
        template: 'blank',
      })
      projectTwo = await owner.getProject(projectTwoId)
      projectTwoRootFolderId = projectTwo.rootFolder[0]._id.toString()
    })

    it('should import the output.pdf file from the source project and refresh it', async function () {
      // import the file
      let { response, body } = await owner.doRequest('post', {
        url: `/project/${projectOneId}/linked_file`,
        json: {
          name: 'test.pdf',
          parent_folder_id: projectOneRootFolderId,
          provider: 'project_output_file',
          data: {
            source_project_id: projectTwoId,
            source_output_file_path: 'output.pdf',
            build_id: '1234-abcd',
          },
        },
      })
      expect(response.statusCode).to.equal(200)
      const existingFileId = body.new_file_id
      expect(existingFileId).to.exist

      const updatedProject = await owner.getProject(projectOneId)
      const firstFile = updatedProject.rootFolder[0].fileRefs[0]
      expect(firstFile._id.toString()).to.equal(existingFileId.toString())
      expect(firstFile.linkedFileData).to.deep.equal({
        provider: 'project_output_file',
        source_project_id: projectTwoId,
        source_output_file_path: 'output.pdf',
        build_id: '1234-abcd',
        importedAt: new Date().toISOString(),
      })
      expect(firstFile.name).to.equal('test.pdf')

      // refresh the file
      ;({ response, body } = await owner.doRequest('post', {
        url: `/project/${projectOneId}/linked_file/${existingFileId}/refresh`,
        json: true,
      }))
      expect(response.statusCode).to.equal(200)
      const refreshedFileId = body.new_file_id
      expect(refreshedFileId).to.exist
      expect(refreshedFileId).to.not.equal(existingFileId)

      const refreshedProject = await owner.getProject(projectOneId)
      const refreshedFile = refreshedProject.rootFolder[0].fileRefs[0]
      expect(refreshedFile._id.toString()).to.equal(refreshedFileId.toString())
      expect(refreshedFile.name).to.equal('test.pdf')
    })

    it('should reject a malformed source_project_id when creating a project_output_file linked file', async function () {
      const { response, body } = await owner.doRequest('post', {
        url: `/project/${projectOneId}/linked_file`,
        json: {
          name: 'test.pdf',
          parent_folder_id: projectOneRootFolderId,
          provider: 'project_output_file',
          data: {
            source_project_id: 'not-an-object-id',
            source_output_file_path: 'output.pdf',
            build_id: '1234-abcd',
          },
        },
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        400,
        'source_project_id'
      )
    })

    it('should reject a malformed build_id when creating a project_output_file linked file', async function () {
      const { response, body } = await owner.doRequest('post', {
        url: `/project/${projectOneId}/linked_file`,
        json: {
          name: 'test.pdf',
          parent_folder_id: projectOneRootFolderId,
          provider: 'project_output_file',
          data: {
            source_project_id: projectTwoId,
            source_output_file_path: 'output.pdf',
            build_id: 'not-a-valid-build-id',
          },
        },
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        400,
        'build_id'
      )
    })
  })

  describe('with a linked project_output_file from a v1 project that has not been imported', function () {
    beforeEach(async function () {
      projectOneId = await owner.createProject('output-v1-test-one', {
        template: 'blank',
      })

      projectOne = await owner.getProject(projectOneId)
      projectOneRootFolderId = projectOne.rootFolder[0]._id.toString()
      projectOne.rootFolder[0].fileRefs.push({
        linkedFileData: {
          provider: 'project_output_file',
          v1_source_doc_id: 9999999, // We won't find this id in the database
          source_output_file_path: 'output.pdf',
        },
        _id: '000000000000000000abcdef',
        rev: 0,
        created: new Date(),
        name: 'whatever.pdf',
      })
      await owner.saveProject(projectOne)
    })

    it('should refuse to refresh', async function () {
      const { response, body } = await owner.doRequest('post', {
        url: `/project/${projectOneId}/linked_file/000000000000000000abcdef/refresh`,
        json: true,
      })
      expect(response.statusCode).to.equal(409)
      expect(body).to.equal(
        'Sorry, the source project is not yet imported to Overleaf v2. Please import it to Overleaf v2 to refresh this file'
      )
    })
  })
})
