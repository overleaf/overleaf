/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    mocha/no-identical-title,
    no-path-concat,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const async = require('async')
const { expect } = require('chai')
const sinon = require('sinon')
const mkdirp = require('mkdirp')
const { ObjectId } = require('mongojs')
const Path = require('path')
const fs = require('fs')
const Settings = require('settings-sharelatex')
const _ = require('underscore')

const ProjectGetter = require('../../../app/src/Features/Project/ProjectGetter.js')

const MockDocStoreApi = require('./helpers/MockDocstoreApi')
const MockFileStoreApi = require('./helpers/MockFileStoreApi')
const request = require('./helpers/request')
const User = require('./helpers/User')

describe('ProjectDuplicateNames', function() {
  beforeEach(function(done) {
    this.owner = new User()
    this.owner.login(done)
    this.project = {}
    return (this.callback = sinon.stub())
  })

  describe('creating a project from the example template', function() {
    beforeEach(function(done) {
      return this.owner.createProject(
        'example-project',
        { template: 'example' },
        (error, project_id) => {
          if (error != null) {
            throw error
          }
          this.example_project_id = project_id
          return this.owner.getProject(project_id, (error, project) => {
            this.project = project
            this.mainTexDoc = _.find(
              project.rootFolder[0].docs,
              doc => doc.name === 'main.tex'
            )
            this.refBibDoc = _.find(
              project.rootFolder[0].docs,
              doc => doc.name === 'references.bib'
            )
            this.imageFile = _.find(
              project.rootFolder[0].fileRefs,
              file => file.name === 'universe.jpg'
            )
            this.rootFolderId = project.rootFolder[0]._id.toString()
            // create a folder called 'testfolder'
            return this.owner.request.post(
              {
                uri: `/project/${this.example_project_id}/folder`,
                json: {
                  name: 'testfolder',
                  parent_folder_id: this.rootFolderId
                }
              },
              (err, res, body) => {
                this.testFolderId = body._id
                return done()
              }
            )
          })
        }
      )
    })

    it('should create a project', function() {
      expect(this.project.rootFolder[0].docs.length).to.equal(2)
      return expect(this.project.rootFolder[0].fileRefs.length).to.equal(1)
    })

    it('should create two docs in the docstore', function() {
      const docs = MockDocStoreApi.docs[this.example_project_id]
      return expect(Object.keys(docs).length).to.equal(2)
    })

    it('should create one file in the filestore', function() {
      const files = MockFileStoreApi.files[this.example_project_id]
      return expect(Object.keys(files).length).to.equal(1)
    })

    describe('for an existing doc', function() {
      describe('trying to add a doc with the same name', function() {
        beforeEach(function(done) {
          return this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/doc`,
              json: {
                name: 'main.tex',
                parent_folder_id: this.rootFolderId
              }
            },
            (err, res, body) => {
              this.res = res
              return done()
            }
          )
        })

        it('should respond with 400 error status', function() {
          return expect(this.res.statusCode).to.equal(400)
        })
      })

      describe('trying to add a folder with the same name', function() {
        beforeEach(function(done) {
          return this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/folder`,
              json: {
                name: 'main.tex',
                parent_folder_id: this.rootFolderId
              }
            },
            (err, res, body) => {
              this.res = res
              return done()
            }
          )
        })

        it('should respond with 400 error status', function() {
          return expect(this.res.statusCode).to.equal(400)
        })
      })

      describe('trying to add a folder with the same name', function() {
        beforeEach(function(done) {
          return this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/folder`,
              json: {
                name: 'main.tex',
                parent_folder_id: this.rootFolderId
              }
            },
            (err, res, body) => {
              this.res = res
              return done()
            }
          )
        })

        it('should respond with 400 error status', function() {
          return expect(this.res.statusCode).to.equal(400)
        })
      })
    })

    describe('for an existing file', function() {
      describe('trying to add a doc with the same name', function() {
        beforeEach(function(done) {
          return this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/doc`,
              json: {
                name: 'universe.jpg',
                parent_folder_id: this.rootFolderId
              }
            },
            (err, res, body) => {
              this.res = res
              return done()
            }
          )
        })

        it('should respond with 400 error status', function() {
          return expect(this.res.statusCode).to.equal(400)
        })
      })

      describe('trying to add a folder with the same name', function() {
        beforeEach(function(done) {
          return this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/folder`,
              json: {
                name: 'universe.jpg',
                parent_folder_id: this.rootFolderId
              }
            },
            (err, res, body) => {
              this.res = res
              return done()
            }
          )
        })

        it('should respond with 400 error status', function() {
          return expect(this.res.statusCode).to.equal(400)
        })
      })

      describe('trying to upload a file with the same name', function() {
        beforeEach(function(done) {
          return this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/upload`,
              json: true,
              qs: {
                folder_id: this.rootFolderId,
                qqfilename: 'universe.jpg'
              },
              formData: {
                qqfile: {
                  value: fs.createReadStream(
                    Path.resolve(__dirname + '/../files/1pixel.png')
                  ),
                  options: {
                    filename: 'universe.jpg',
                    contentType: 'image/jpeg'
                  }
                }
              }
            },
            (err, res, body) => {
              this.body = body
              // update the image id because we have replaced the file
              this.imageFile._id = this.body.entity_id
              return done()
            }
          )
        })

        it('should succeed (overwriting the file)', function() {
          return expect(this.body.success).to.equal(true)
        })
      })
    })
    // at this point the @imageFile._id has changed

    describe('for an existing folder', function() {
      describe('trying to add a doc with the same name', function() {
        beforeEach(function(done) {
          return this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/doc`,
              json: {
                name: 'testfolder',
                parent_folder_id: this.rootFolderId
              }
            },
            (err, res, body) => {
              this.res = res
              return done()
            }
          )
        })

        it('should respond with 400 error status', function() {
          return expect(this.res.statusCode).to.equal(400)
        })
      })

      describe('trying to add a folder with the same name', function() {
        beforeEach(function(done) {
          return this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/folder`,
              json: {
                name: 'testfolder',
                parent_folder_id: this.rootFolderId
              }
            },
            (err, res, body) => {
              this.res = res
              return done()
            }
          )
        })

        it('should respond with 400 error status', function() {
          return expect(this.res.statusCode).to.equal(400)
        })
      })

      describe('trying to upload a file with the same name', function() {
        beforeEach(function(done) {
          return this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/upload`,
              json: true,
              qs: {
                folder_id: this.rootFolderId,
                qqfilename: 'universe.jpg'
              },
              formData: {
                qqfile: {
                  value: fs.createReadStream(
                    Path.resolve(__dirname + '/../files/1pixel.png')
                  ),
                  options: {
                    filename: 'testfolder',
                    contentType: 'image/jpeg'
                  }
                }
              }
            },
            (err, res, body) => {
              this.body = body
              return done()
            }
          )
        })

        it('should respond with failure status', function() {
          return expect(this.body.success).to.equal(false)
        })
      })
    })

    describe('for an existing doc', function() {
      describe('trying to rename a doc to the same name', function() {
        beforeEach(function(done) {
          return this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/doc/${
                this.refBibDoc._id
              }/rename`,
              json: {
                name: 'main.tex'
              }
            },
            (err, res, body) => {
              this.res = res
              return done()
            }
          )
        })

        it('should respond with 400 error status', function() {
          return expect(this.res.statusCode).to.equal(400)
        })
      })

      describe('trying to rename a folder to the same name', function() {
        beforeEach(function(done) {
          return this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/folder/${
                this.testFolderId
              }/rename`,
              json: {
                name: 'main.tex'
              }
            },
            (err, res, body) => {
              this.res = res
              return done()
            }
          )
        })

        it('should respond with 400 error status', function() {
          return expect(this.res.statusCode).to.equal(400)
        })
      })

      describe('trying to rename a file to the same name', function() {
        beforeEach(function(done) {
          return this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/file/${
                this.imageFile._id
              }/rename`,
              json: {
                name: 'main.tex'
              }
            },
            (err, res, body) => {
              this.res = res
              return done()
            }
          )
        })

        it('should respond with failure status', function() {
          return expect(this.res.statusCode).to.equal(400)
        })
      })
    })

    describe('for an existing file', function() {
      describe('trying to rename a doc to the same name', function() {
        beforeEach(function(done) {
          return this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/doc/${
                this.refBibDoc._id
              }/rename`,
              json: {
                name: 'universe.jpg'
              }
            },
            (err, res, body) => {
              this.res = res
              return done()
            }
          )
        })

        it('should respond with 400 error status', function() {
          return expect(this.res.statusCode).to.equal(400)
        })
      })

      describe('trying to rename a folder to the same name', function() {
        beforeEach(function(done) {
          return this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/folder/${
                this.testFolderId
              }/rename`,
              json: {
                name: 'universe.jpg'
              }
            },
            (err, res, body) => {
              this.res = res
              return done()
            }
          )
        })

        it('should respond with 400 error status', function() {
          return expect(this.res.statusCode).to.equal(400)
        })
      })

      describe('trying to rename a file to the same name', function() {
        beforeEach(function(done) {
          return this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/file/${
                this.imageFile._id
              }/rename`,
              json: {
                name: 'universe.jpg'
              }
            },
            (err, res, body) => {
              this.res = res
              return done()
            }
          )
        })

        it('should respond with failure status', function() {
          return expect(this.res.statusCode).to.equal(400)
        })
      })
    })

    describe('for an existing folder', function() {
      describe('trying to rename a doc to the same name', function() {
        beforeEach(function(done) {
          return this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/doc/${
                this.refBibDoc._id
              }/rename`,
              json: {
                name: 'testfolder'
              }
            },
            (err, res, body) => {
              this.res = res
              return done()
            }
          )
        })

        it('should respond with 400 error status', function() {
          return expect(this.res.statusCode).to.equal(400)
        })
      })

      describe('trying to rename a folder to the same name', function() {
        beforeEach(function(done) {
          return this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/folder/${
                this.testFolderId
              }/rename`,
              json: {
                name: 'testfolder'
              }
            },
            (err, res, body) => {
              this.res = res
              return done()
            }
          )
        })

        it('should respond with 400 error status', function() {
          return expect(this.res.statusCode).to.equal(400)
        })
      })

      describe('trying to rename a file to the same name', function() {
        beforeEach(function(done) {
          return this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/file/${
                this.imageFile._id
              }/rename`,
              json: {
                name: 'testfolder'
              }
            },
            (err, res, body) => {
              this.res = res
              return done()
            }
          )
        })

        it('should respond with failure status', function() {
          return expect(this.res.statusCode).to.equal(400)
        })
      })
    })

    describe('for an existing folder with a file with the same name', function() {
      beforeEach(function(done) {
        return this.owner.request.post(
          {
            uri: `/project/${this.example_project_id}/doc`,
            json: {
              name: 'main.tex',
              parent_folder_id: this.testFolderId
            }
          },
          (err, res, body) => {
            return this.owner.request.post(
              {
                uri: `/project/${this.example_project_id}/doc`,
                json: {
                  name: 'universe.jpg',
                  parent_folder_id: this.testFolderId
                }
              },
              (err, res, body) => {
                return this.owner.request.post(
                  {
                    uri: `/project/${this.example_project_id}/folder`,
                    json: {
                      name: 'otherFolder',
                      parent_folder_id: this.testFolderId
                    }
                  },
                  (err, res, body) => {
                    this.subFolderId = body._id
                    return this.owner.request.post(
                      {
                        uri: `/project/${this.example_project_id}/folder`,
                        json: {
                          name: 'otherFolder',
                          parent_folder_id: this.rootFolderId
                        }
                      },
                      (err, res, body) => {
                        this.otherFolderId = body._id
                        return done()
                      }
                    )
                  }
                )
              }
            )
          }
        )
      })

      describe('trying to move a doc into the folder', function() {
        beforeEach(function(done) {
          return this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/doc/${
                this.mainTexDoc._id
              }/move`,
              json: {
                folder_id: this.testFolderId
              }
            },
            (err, res, body) => {
              this.res = res
              return done()
            }
          )
        })

        it('should respond with 400 error status', function() {
          return expect(this.res.statusCode).to.equal(400)
        })
      })

      describe('trying to move a file into the folder', function() {
        beforeEach(function(done) {
          return this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/file/${
                this.imageFile._id
              }/move`,
              json: {
                folder_id: this.testFolderId
              }
            },
            (err, res, body) => {
              this.res = res
              return done()
            }
          )
        })

        it('should respond with 400 error status', function() {
          return expect(this.res.statusCode).to.equal(400)
        })
      })

      describe('trying to move a folder into the folder', function() {
        beforeEach(function(done) {
          return this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/folder/${
                this.otherFolderId
              }/move`,
              json: {
                folder_id: this.testFolderId
              }
            },
            (err, res, body) => {
              this.res = res
              return done()
            }
          )
        })

        it('should respond with 400 error status', function() {
          return expect(this.res.statusCode).to.equal(400)
        })
      })

      describe('trying to move a folder into a subfolder of itself', function() {
        beforeEach(function(done) {
          return this.owner.request.post(
            {
              uri: `/project/${this.example_project_id}/folder/${
                this.testFolderId
              }/move`,
              json: {
                folder_id: this.subFolderId
              }
            },
            (err, res, body) => {
              this.res = res
              return done()
            }
          )
        })

        it('should respond with 400 error status', function() {
          return expect(this.res.statusCode).to.equal(400)
        })
      })
    })
  })
})
