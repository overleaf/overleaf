import { expect } from 'chai'
import sinon from 'sinon'
import Path from 'node:path'
import fs from 'node:fs'
import _ from 'lodash'
import User from './helpers/User.mjs'
import UserHelper from './helpers/UserHelper.mjs'
import MockDocstoreApiClass from './mocks/MockDocstoreApi.mjs'
import MockV1HistoryApiClass from './mocks/MockV1HistoryApi.mjs'
import { fileURLToPath } from 'node:url'

let MockDocstoreApi, MockV1HistoryApi

const __dirname = fileURLToPath(new URL('.', import.meta.url))

before(function () {
  MockDocstoreApi = MockDocstoreApiClass.instance()
  MockV1HistoryApi = MockV1HistoryApiClass.instance()
})

describe('ProjectDuplicateNames', function () {
  beforeEach(function (done) {
    this.owner = new User()
    this.owner.login(done)
    this.project = {}
    this.callback = sinon.stub()
  })

  describe('creating a project from the example template', function () {
    beforeEach(function (done) {
      this.owner.createProject(
        'example-project',
        { template: 'example' },
        (error, projectId) => {
          expect(error).to.not.exist
          this.example_project_id = projectId
          this.owner.getProject(projectId, (error, project) => {
            expect(error).to.not.exist
            this.project = project
            this.mainTexDoc = _.find(
              project.rootFolder[0].docs,
              doc => doc.name === 'main.tex'
            )
            this.refBibDoc = _.find(
              project.rootFolder[0].docs,
              doc => doc.name === 'sample.bib'
            )
            this.imageFile = _.find(
              project.rootFolder[0].fileRefs,
              file => file.name === 'frog.jpg'
            )
            this.rootFolderId = project.rootFolder[0]._id.toString()
            // create a folder called 'testfolder'
            this.owner.request.post(
              {
                uri: `/project/${this.example_project_id}/folder`,
                json: {
                  name: 'testfolder',
                  parent_folder_id: this.rootFolderId,
                },
              },
              (err, res, body) => {
                expect(err).to.not.exist
                this.testFolderId = body._id
                done()
              }
            )
          })
        }
      )
    })

    it('should create a project', function () {
      expect(this.project.rootFolder[0].docs.length).to.equal(2)
      expect(this.project.rootFolder[0].fileRefs.length).to.equal(1)
    })

    it('should create two docs in the docstore', function () {
      const docs = MockDocstoreApi.docs[this.example_project_id]
      expect(Object.keys(docs).length).to.equal(2)
    })

    it('should create one file in the history-v1', function () {
      const files =
        MockV1HistoryApi.blobs[this.project.overleaf.history.id.toString()]
      expect(Object.keys(files).length).to.equal(1)
    })

    describe('for an existing doc', function () {
      describe('trying to add a doc with the same name', function () {
        beforeEach(function (done) {
          this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/doc`,
              json: {
                name: 'main.tex',
                parent_folder_id: this.rootFolderId,
              },
            },
            (err, res, body) => {
              expect(err).to.not.exist
              this.res = res
              done()
            }
          )
        })

        it('should respond with 400 error status', function () {
          expect(this.res.statusCode).to.equal(400)
        })
      })

      describe('trying to add a folder with the same name', function () {
        beforeEach(function (done) {
          this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/folder`,
              json: {
                name: 'main.tex',
                parent_folder_id: this.rootFolderId,
              },
            },
            (err, res, body) => {
              expect(err).to.not.exist
              this.res = res
              done()
            }
          )
        })

        it('should respond with 400 error status', function () {
          expect(this.res.statusCode).to.equal(400)
        })
      })
    })

    describe('for an existing file', function () {
      describe('trying to add a doc with the same name', function () {
        beforeEach(function (done) {
          this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/doc`,
              json: {
                name: 'frog.jpg',
                parent_folder_id: this.rootFolderId,
              },
            },
            (err, res, body) => {
              expect(err).to.not.exist
              this.res = res
              done()
            }
          )
        })

        it('should respond with 400 error status', function () {
          expect(this.res.statusCode).to.equal(400)
        })
      })

      describe('trying to add a folder with the same name', function () {
        beforeEach(function (done) {
          this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/folder`,
              json: {
                name: 'frog.jpg',
                parent_folder_id: this.rootFolderId,
              },
            },
            (err, res, body) => {
              expect(err).to.not.exist
              this.res = res
              done()
            }
          )
        })

        it('should respond with 400 error status', function () {
          expect(this.res.statusCode).to.equal(400)
        })
      })

      describe('trying to upload a file with the same name', function () {
        beforeEach(function (done) {
          this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/upload`,
              json: true,
              qs: {
                folder_id: this.rootFolderId,
                qqfilename: 'frog.jpg',
              },
              formData: {
                name: 'frog.jpg',
                qqfile: {
                  value: fs.createReadStream(
                    Path.join(__dirname, '/../files/1pixel.png')
                  ),
                  options: {
                    filename: 'frog.jpg',
                    contentType: 'image/jpeg',
                  },
                },
              },
            },
            (err, res, body) => {
              expect(err).to.not.exist
              this.body = body
              // update the image id because we have replaced the file
              this.imageFile._id = this.body.entity_id
              done()
            }
          )
        })

        it('should succeed (overwriting the file)', function () {
          expect(this.body.success).to.equal(true)
        })
      })
    })
    // at this point the @imageFile._id has changed

    describe('for an existing folder', function () {
      describe('trying to add a doc with the same name', function () {
        beforeEach(function (done) {
          this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/doc`,
              json: {
                name: 'testfolder',
                parent_folder_id: this.rootFolderId,
              },
            },
            (err, res, body) => {
              expect(err).to.not.exist
              this.res = res
              done()
            }
          )
        })

        it('should respond with 400 error status', function () {
          expect(this.res.statusCode).to.equal(400)
        })
      })

      describe('trying to add a folder with the same name', function () {
        beforeEach(function (done) {
          this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/folder`,
              json: {
                name: 'testfolder',
                parent_folder_id: this.rootFolderId,
              },
            },
            (err, res, body) => {
              expect(err).to.not.exist
              this.res = res
              done()
            }
          )
        })

        it('should respond with 400 error status', function () {
          expect(this.res.statusCode).to.equal(400)
        })
      })

      describe('trying to upload a file with the same name', function () {
        beforeEach(function (done) {
          this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/upload`,
              json: true,
              qs: {
                folder_id: this.rootFolderId,
                qqfilename: 'frog.jpg',
              },
              formData: {
                qqfile: {
                  value: fs.createReadStream(
                    Path.join(__dirname, '/../files/1pixel.png')
                  ),
                  options: {
                    filename: 'testfolder',
                    contentType: 'image/jpeg',
                  },
                },
              },
            },
            (err, res, body) => {
              expect(err).to.not.exist
              this.body = body
              done()
            }
          )
        })

        it('should respond with failure status', function () {
          expect(this.body.success).to.equal(false)
        })
      })
    })

    describe('rename for an existing doc', function () {
      describe('trying to rename a doc to the same name', function () {
        beforeEach(function (done) {
          this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/doc/${this.refBibDoc._id}/rename`,
              json: {
                name: 'main.tex',
              },
            },
            (err, res, body) => {
              expect(err).to.not.exist
              this.res = res
              done()
            }
          )
        })

        it('should respond with 400 error status', function () {
          expect(this.res.statusCode).to.equal(400)
        })
      })

      describe('trying to rename a folder to the same name', function () {
        beforeEach(function (done) {
          this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/folder/${this.testFolderId}/rename`,
              json: {
                name: 'main.tex',
              },
            },
            (err, res, body) => {
              expect(err).to.not.exist
              this.res = res
              done()
            }
          )
        })

        it('should respond with 400 error status', function () {
          expect(this.res.statusCode).to.equal(400)
        })
      })

      describe('trying to rename a file to the same name', function () {
        beforeEach(function (done) {
          this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/file/${this.imageFile._id}/rename`,
              json: {
                name: 'main.tex',
              },
            },
            (err, res, body) => {
              expect(err).to.not.exist
              this.res = res
              done()
            }
          )
        })

        it('should respond with failure status', function () {
          expect(this.res.statusCode).to.equal(400)
        })
      })
    })

    describe('rename for an existing file', function () {
      describe('trying to rename a doc to the same name', function () {
        beforeEach(function (done) {
          this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/doc/${this.refBibDoc._id}/rename`,
              json: {
                name: 'frog.jpg',
              },
            },
            (err, res, body) => {
              expect(err).to.not.exist
              this.res = res
              done()
            }
          )
        })

        it('should respond with 400 error status', function () {
          expect(this.res.statusCode).to.equal(400)
        })
      })

      describe('trying to rename a folder to the same name', function () {
        beforeEach(function (done) {
          this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/folder/${this.testFolderId}/rename`,
              json: {
                name: 'frog.jpg',
              },
            },
            (err, res, body) => {
              expect(err).to.not.exist
              this.res = res
              done()
            }
          )
        })

        it('should respond with 400 error status', function () {
          expect(this.res.statusCode).to.equal(400)
        })
      })

      describe('trying to rename a file to the same name', function () {
        beforeEach(function (done) {
          this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/file/${this.imageFile._id}/rename`,
              json: {
                name: 'frog.jpg',
              },
            },
            (err, res, body) => {
              expect(err).to.not.exist
              this.res = res
              done()
            }
          )
        })

        it('should respond with failure status', function () {
          expect(this.res.statusCode).to.equal(400)
        })
      })
    })

    describe('rename for an existing folder', function () {
      describe('trying to rename a doc to the same name', function () {
        beforeEach(function (done) {
          this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/doc/${this.refBibDoc._id}/rename`,
              json: {
                name: 'testfolder',
              },
            },
            (err, res, body) => {
              expect(err).to.not.exist
              this.res = res
              done()
            }
          )
        })

        it('should respond with 400 error status', function () {
          expect(this.res.statusCode).to.equal(400)
        })
      })

      describe('trying to rename a folder to the same name', function () {
        beforeEach(function (done) {
          this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/folder/${this.testFolderId}/rename`,
              json: {
                name: 'testfolder',
              },
            },
            (err, res, body) => {
              expect(err).to.not.exist
              this.res = res
              done()
            }
          )
        })

        it('should respond with 400 error status', function () {
          expect(this.res.statusCode).to.equal(400)
        })
      })

      describe('trying to rename a file to the same name', function () {
        beforeEach(function (done) {
          this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/file/${this.imageFile._id}/rename`,
              json: {
                name: 'testfolder',
              },
            },
            (err, res, body) => {
              expect(err).to.not.exist
              this.res = res
              done()
            }
          )
        })

        it('should respond with failure status', function () {
          expect(this.res.statusCode).to.equal(400)
        })
      })
    })

    describe('for an existing folder with a file with the same name', function () {
      beforeEach(function (done) {
        this.owner.request.post(
          {
            uri: `/project/${this.example_project_id}/doc`,
            json: {
              name: 'main.tex',
              parent_folder_id: this.testFolderId,
            },
          },
          (err, res, body) => {
            if (err) {
              throw err
            }
            this.owner.request.post(
              {
                uri: `/project/${this.example_project_id}/doc`,
                json: {
                  name: 'frog.jpg',
                  parent_folder_id: this.testFolderId,
                },
              },
              (err, res, body) => {
                if (err) {
                  throw err
                }
                this.owner.request.post(
                  {
                    uri: `/project/${this.example_project_id}/folder`,
                    json: {
                      name: 'otherFolder',
                      parent_folder_id: this.testFolderId,
                    },
                  },
                  (err, res, body) => {
                    if (err) {
                      throw err
                    }
                    this.subFolderId = body._id
                    this.owner.request.post(
                      {
                        uri: `/project/${this.example_project_id}/folder`,
                        json: {
                          name: 'otherFolder',
                          parent_folder_id: this.rootFolderId,
                        },
                      },
                      (err, res, body) => {
                        if (err) {
                          throw err
                        }
                        this.otherFolderId = body._id
                        done()
                      }
                    )
                  }
                )
              }
            )
          }
        )
      })

      describe('trying to move a doc into the folder', function () {
        beforeEach(function (done) {
          this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/doc/${this.mainTexDoc._id}/move`,
              json: {
                folder_id: this.testFolderId,
              },
            },
            (err, res, body) => {
              expect(err).to.not.exist
              this.res = res
              done()
            }
          )
        })

        it('should respond with 400 error status', function () {
          expect(this.res.statusCode).to.equal(400)
        })
      })

      describe('trying to move a file into the folder', function () {
        beforeEach(function (done) {
          this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/file/${this.imageFile._id}/move`,
              json: {
                folder_id: this.testFolderId,
              },
            },
            (err, res, body) => {
              expect(err).to.not.exist
              this.res = res
              done()
            }
          )
        })

        it('should respond with 400 error status', function () {
          expect(this.res.statusCode).to.equal(400)
        })
      })

      describe('trying to move a folder into the folder', function () {
        beforeEach(function (done) {
          this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/folder/${this.otherFolderId}/move`,
              json: {
                folder_id: this.testFolderId,
              },
            },
            (err, res, body) => {
              expect(err).to.not.exist
              this.res = res
              done()
            }
          )
        })

        it('should respond with 400 error status', function () {
          expect(this.res.statusCode).to.equal(400)
        })
      })

      describe('trying to move a folder into a subfolder of itself', function () {
        beforeEach(function (done) {
          this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/folder/${this.testFolderId}/move`,
              json: {
                folder_id: this.subFolderId,
              },
            },
            (err, res, body) => {
              expect(err).to.not.exist
              this.res = res
              done()
            }
          )
        })

        it('should respond with 400 error status', function () {
          expect(this.res.statusCode).to.equal(400)
        })
      })
    })
  })

  describe('regex characters in title', function () {
    let response, userHelper
    beforeEach(async function () {
      userHelper = new UserHelper()
      userHelper = await UserHelper.createUser()
      userHelper = await UserHelper.loginUser(
        userHelper.getDefaultEmailPassword()
      )
    })
    it('should handle characters that would cause an invalid regular expression', async function () {
      const projectName = 'Example (test'
      response = await userHelper.fetch('/project/new', {
        method: 'POST',
        body: new URLSearchParams([['projectName', projectName]]),
      })
      const body = await response.json()
      expect(response.status).to.equal(200) // can create project
      response = await userHelper.fetch(`/project/${body.project_id}`)
      expect(response.status).to.equal(200) // can open project
    })
  })
})
