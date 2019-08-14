const { expect } = require('chai')
const _ = require('underscore')
const mkdirp = require('mkdirp')
const { promisify } = require('util')

const Settings = require('settings-sharelatex')
const User = require('./helpers/User').promises
require('./helpers/MockFileStoreApi')
require('./helpers/MockClsiApi')

const express = require('express')
const LinkedUrlProxy = express()
LinkedUrlProxy.get('/', (req, res, next) => {
  if (req.query.url === 'http://example.com/foo') {
    return res.send('foo foo foo')
  } else if (req.query.url === 'http://example.com/bar') {
    return res.send('bar bar bar')
  } else {
    return res.sendStatus(404)
  }
})

describe('LinkedFiles', function() {
  let projectOne, projectOneId, projectOneRootFolderId
  let projectTwo, projectTwoId, projectTwoRootFolderId
  let sourceDocName = 'test.txt'
  let owner

  before(function(done) {
    LinkedUrlProxy.listen(6543, done)
  })

  beforeEach(async function() {
    owner = new User()
    await owner.login()
    await promisify(mkdirp)(Settings.path.dumpFolder)
  })

  describe('creating a project linked file', function() {
    beforeEach(async function() {
      projectOneId = await owner.createProject('plf-test-one', {
        template: 'blank'
      })
      projectOne = await owner.getProject(projectOneId)
      projectOneRootFolderId = projectOne.rootFolder[0]._id.toString()

      projectTwoId = await owner.createProject('plf-test-two', {
        template: 'blank'
      })
      projectTwo = await owner.getProject(projectTwoId)
      projectTwoRootFolderId = projectTwo.rootFolder[0]._id.toString()

      await owner.createDocInProject(
        projectTwoId,
        projectTwoRootFolderId,
        sourceDocName
      )
      await owner.createDocInProject(
        projectTwoId,
        projectTwoRootFolderId,
        'some-harmless-doc.txt'
      )
    })

    it('should produce a list of the users projects and their entities', async function() {
      let { body } = await owner.doRequest('get', {
        url: '/user/projects',
        json: true
      })

      expect(body).to.deep.equal({
        projects: [
          {
            _id: projectOneId,
            name: 'plf-test-one',
            accessLevel: 'owner'
          },
          {
            _id: projectTwoId,
            name: 'plf-test-two',
            accessLevel: 'owner'
          }
        ]
      })
      ;({ body } = await owner.doRequest('get', {
        url: `/project/${projectTwoId}/entities`,
        json: true
      }))
      expect(body).to.deep.equal({
        project_id: projectTwoId,
        entities: [
          { path: '/main.tex', type: 'doc' },
          { path: '/some-harmless-doc.txt', type: 'doc' },
          { path: '/test.txt', type: 'doc' }
        ]
      })
    })

    it('should import a file and refresh it if there is no v1 id', async function() {
      // import the file from the source project
      let { response, body } = await owner.doRequest('post', {
        url: `/project/${projectOneId}/linked_file`,
        json: {
          name: 'test-link.txt',
          parent_folder_id: projectOneRootFolderId,
          provider: 'project_file',
          data: {
            source_project_id: projectTwoId,
            source_entity_path: `/${sourceDocName}`
          }
        }
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
        source_entity_path: `/${sourceDocName}`
      })
      expect(firstFile.name).to.equal('test-link.txt')

      // refresh the file
      ;({ response, body } = await owner.doRequest('post', {
        url: `/project/${projectOneId}/linked_file/${existingFileId}/refresh`,
        json: true
      }))
      expect(response.statusCode).to.equal(200)
      const newFileId = body.new_file_id
      expect(newFileId).to.exist
      expect(newFileId).to.not.equal(existingFileId)

      updatedProjectOne = await owner.getProject(projectOneId)
      firstFile = updatedProjectOne.rootFolder[0].fileRefs[0]
      expect(firstFile._id.toString()).to.equal(newFileId.toString())
      expect(firstFile.name).to.equal('test-link.txt')

      // should not work if there is a v1 id
      ;({ response, body } = await owner.doRequest('post', {
        url: `/project/${projectOneId}/linked_file`,
        json: {
          name: 'test-link-should-not-work.txt',
          parent_folder_id: projectOneRootFolderId,
          provider: 'project_file',
          data: {
            v1_source_doc_id: 1234,
            source_entity_path: `/${sourceDocName}`
          }
        }
      }))
      expect(response.statusCode).to.equal(403)
      expect(body).to.equal('You do not have access to this project')
    })
  })

  describe('with a linked project_file from a v1 project that has not been imported', function() {
    beforeEach(async function() {
      projectOneId = await owner.createProject('plf-v1-test-one', {
        template: 'blank'
      })
      projectOne = await owner.getProject(projectOneId)
      projectOneRootFolderId = projectOne.rootFolder[0]._id.toString()
      projectOne.rootFolder[0].fileRefs.push({
        linkedFileData: {
          provider: 'project_file',
          v1_source_doc_id: 9999999, // We won't find this id in the database
          source_entity_path: 'example.jpeg'
        },
        _id: 'abcd',
        rev: 0,
        created: new Date(),
        name: 'example.jpeg'
      })
      await owner.saveProject(projectOne)
    })

    it('should refuse to refresh', async function() {
      const { response, body } = await owner.doRequest('post', {
        url: `/project/${projectOneId}/linked_file/abcd/refresh`,
        json: true
      })
      expect(response.statusCode).to.equal(409)
      expect(body).to.equal(
        'Sorry, the source project is not yet imported to Overleaf v2. Please import it to Overleaf v2 to refresh this file'
      )
    })
  })

  describe('creating a URL based linked file', function() {
    beforeEach(async function() {
      projectOneId = await owner.createProject('url-linked-files-project', {
        template: 'blank'
      })
      projectOne = await owner.getProject(projectOneId)
      projectOneRootFolderId = projectOne.rootFolder[0]._id.toString()
    })

    it('should download, create and replace a file', async function() {
      // downloading the initial file
      let { response, body } = await owner.doRequest('post', {
        url: `/project/${projectOneId}/linked_file`,
        json: {
          provider: 'url',
          data: {
            url: 'http://example.com/foo'
          },
          parent_folder_id: projectOneRootFolderId,
          name: 'url-test-file-1'
        }
      })
      expect(response.statusCode).to.equal(200)

      let updatedProject = await owner.getProject(projectOneId)
      let file = updatedProject.rootFolder[0].fileRefs[0]
      expect(file.linkedFileData).to.deep.equal({
        provider: 'url',
        url: 'http://example.com/foo'
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
            url: 'http://example.com/foo'
          },
          parent_folder_id: projectOneRootFolderId,
          name: 'url-test-file-2'
        }
      }))
      expect(response.statusCode).to.equal(200)
      ;({ response, body } = await owner.doRequest('post', {
        url: `/project/${projectOneId}/linked_file`,
        json: {
          provider: 'url',
          data: {
            url: 'http://example.com/bar'
          },
          parent_folder_id: projectOneRootFolderId,
          name: 'url-test-file-2'
        }
      }))
      expect(response.statusCode).to.equal(200)

      updatedProject = await owner.getProject(projectOneId)
      file = updatedProject.rootFolder[0].fileRefs[1]
      expect(file.linkedFileData).to.deep.equal({
        provider: 'url',
        url: 'http://example.com/bar'
      })
      ;({ response, body } = await owner.doRequest(
        'get',
        `/project/${projectOneId}/file/${file._id}`
      ))
      expect(response.statusCode).to.equal(200)
      expect(body).to.equal('bar bar bar')
    })

    it("should return an error if the file can't be downloaded", async function() {
      // download does not succeed
      let { response, body } = await owner.doRequest('post', {
        url: `/project/${projectOneId}/linked_file`,
        json: {
          provider: 'url',
          data: {
            url: 'http://example.com/does-not-exist'
          },
          parent_folder_id: projectOneRootFolderId,
          name: 'url-test-file-3'
        }
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
            url: '!^$%'
          },
          parent_folder_id: projectOneRootFolderId,
          name: 'url-test-file-4'
        }
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
            url: 'ftp://localhost'
          },
          parent_folder_id: projectOneRootFolderId,
          name: 'url-test-file-5'
        }
      }))
      expect(response.statusCode).to.equal(422) // unprocessable
      expect(body).to.equal(
        'Your URL is not valid. Please check it and try again.'
      )
    })

    it('should accept a URL withuot a leading http://, and add it', async function() {
      let { response, body } = await owner.doRequest('post', {
        url: `/project/${projectOneId}/linked_file`,
        json: {
          provider: 'url',
          data: {
            url: 'example.com/foo'
          },
          parent_folder_id: projectOneRootFolderId,
          name: 'url-test-file-6'
        }
      })
      expect(response.statusCode).to.equal(200)

      const updatedProject = await owner.getProject(projectOneId)

      const file = _.find(
        updatedProject.rootFolder[0].fileRefs,
        file => file.name === 'url-test-file-6'
      )
      expect(file.linkedFileData).to.deep.equal({
        provider: 'url',
        url: 'http://example.com/foo'
      })
      ;({ response, body } = await owner.doRequest(
        'get',
        `/project/${projectOneId}/file/${file._id}`
      ))
      expect(response.statusCode).to.equal(200)
      expect(body).to.equal('foo foo foo')
    })
  })

  // TODO: Add test for asking for host that return ENOTFOUND
  // (This will probably end up handled by the proxy)

  describe('creating a linked output file', function() {
    beforeEach(async function() {
      projectOneId = await owner.createProject('output-test-one', {
        template: 'blank'
      })
      projectOne = await owner.getProject(projectOneId)

      projectOneRootFolderId = projectOne.rootFolder[0]._id.toString()
      projectTwoId = await owner.createProject('output-test-two', {
        template: 'blank'
      })
      projectTwo = await owner.getProject(projectTwoId)
      projectTwoRootFolderId = projectTwo.rootFolder[0]._id.toString()
    })

    it('should import the project.pdf file from the source project and refresh it', async function() {
      // import the file
      let { response, body } = await owner.doRequest('post', {
        url: `/project/${projectOneId}/linked_file`,
        json: {
          name: 'test.pdf',
          parent_folder_id: projectOneRootFolderId,
          provider: 'project_output_file',
          data: {
            source_project_id: projectTwoId,
            source_output_file_path: 'project.pdf',
            build_id: '1234-abcd'
          }
        }
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
        source_output_file_path: 'project.pdf',
        build_id: '1234-abcd'
      })
      expect(firstFile.name).to.equal('test.pdf')

      // refresh the file
      ;({ response, body } = await owner.doRequest('post', {
        url: `/project/${projectOneId}/linked_file/${existingFileId}/refresh`,
        json: true
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
  })

  describe('with a linked project_output_file from a v1 project that has not been imported', function() {
    beforeEach(async function() {
      projectOneId = await owner.createProject('output-v1-test-one', {
        template: 'blank'
      })

      projectOne = await owner.getProject(projectOneId)
      projectOneRootFolderId = projectOne.rootFolder[0]._id.toString()
      projectOne.rootFolder[0].fileRefs.push({
        linkedFileData: {
          provider: 'project_output_file',
          v1_source_doc_id: 9999999, // We won't find this id in the database
          source_output_file_path: 'project.pdf'
        },
        _id: 'abcdef',
        rev: 0,
        created: new Date(),
        name: 'whatever.pdf'
      })
      await owner.saveProject(projectOne)
    })

    it('should refuse to refresh', async function() {
      const { response, body } = await owner.doRequest('post', {
        url: `/project/${projectOneId}/linked_file/abcdef/refresh`,
        json: true
      })
      expect(response.statusCode).to.equal(409)
      expect(body).to.equal(
        'Sorry, the source project is not yet imported to Overleaf v2. Please import it to Overleaf v2 to refresh this file'
      )
    })
  })
})
