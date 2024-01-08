/* eslint-disable
    max-len,
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
const { expect } = require('chai')
const _ = require('lodash')
const fs = require('fs')
const Path = require('path')

const User = require('../../../../../test/acceptance/src/helpers/User')
const MockProjectHistoryApiClass = require('../../../../../test/acceptance/src/mocks/MockProjectHistoryApi')
const MockDocstoreApiClass = require('../../../../../test/acceptance/src/mocks/MockDocstoreApi')
const MockFilestoreApiClass = require('../../../../../test/acceptance/src/mocks/MockFilestoreApi')

let MockProjectHistoryApi, MockDocstoreApi, MockFilestoreApi

before(function () {
  MockProjectHistoryApi = MockProjectHistoryApiClass.instance()
  MockDocstoreApi = MockDocstoreApiClass.instance()
  MockFilestoreApi = MockFilestoreApiClass.instance()
})

describe('RestoringFiles', function () {
  beforeEach(function (done) {
    this.owner = new User()
    return this.owner.login(error => {
      if (error != null) {
        throw error
      }
      return this.owner.createProject(
        'example-project',
        { template: 'example' },
        (error, projectId) => {
          this.project_id = projectId
          if (error != null) {
            throw error
          }
          return done()
        }
      )
    })
  })

  describe('restoring from v2 history', function () {
    describe('restoring a text file', function () {
      beforeEach(function (done) {
        MockProjectHistoryApi.addOldFile(
          this.project_id,
          42,
          'foo.tex',
          'hello world, this is foo.tex!'
        )
        return this.owner.request(
          {
            method: 'POST',
            url: `/project/${this.project_id}/restore_file`,
            json: {
              pathname: 'foo.tex',
              version: 42,
            },
          },
          (error, response, body) => {
            if (error != null) {
              throw error
            }
            expect(response.statusCode).to.equal(200)
            return done()
          }
        )
      })

      it('should have created a doc', function (done) {
        return this.owner.getProject(this.project_id, (error, project) => {
          if (error != null) {
            throw error
          }
          let doc = _.find(
            project.rootFolder[0].docs,
            doc => doc.name === 'foo.tex'
          )
          doc = MockDocstoreApi.docs[this.project_id][doc._id]
          expect(doc.lines).to.deep.equal(['hello world, this is foo.tex!'])
          return done()
        })
      })
    })

    describe('restoring a binary file', function () {
      beforeEach(function (done) {
        this.pngData = fs.readFileSync(
          Path.resolve(
            __dirname,
            '../../../../../test/acceptance/files/1pixel.png'
          ),
          'binary'
        )
        MockProjectHistoryApi.addOldFile(
          this.project_id,
          42,
          'image.png',
          this.pngData
        )
        return this.owner.request(
          {
            method: 'POST',
            url: `/project/${this.project_id}/restore_file`,
            json: {
              pathname: 'image.png',
              version: 42,
            },
          },
          (error, response, body) => {
            if (error != null) {
              throw error
            }
            expect(response.statusCode).to.equal(200)
            return done()
          }
        )
      })

      it('should have created a file', function (done) {
        return this.owner.getProject(this.project_id, (error, project) => {
          if (error != null) {
            throw error
          }
          let file = _.find(
            project.rootFolder[0].fileRefs,
            file => file.name === 'image.png'
          )
          file = MockFilestoreApi.files[this.project_id][file._id]
          expect(file.content).to.equal(this.pngData)
          return done()
        })
      })
    })

    describe('restoring to a directory that exists', function () {
      beforeEach(function (done) {
        MockProjectHistoryApi.addOldFile(
          this.project_id,
          42,
          'foldername/foo2.tex',
          'hello world, this is foo-2.tex!'
        )
        return this.owner.request.post(
          {
            uri: `project/${this.project_id}/folder`,
            json: {
              name: 'foldername',
            },
          },
          (error, response, body) => {
            if (error != null) {
              throw error
            }
            expect(response.statusCode).to.equal(200)
            return this.owner.request(
              {
                method: 'POST',
                url: `/project/${this.project_id}/restore_file`,
                json: {
                  pathname: 'foldername/foo2.tex',
                  version: 42,
                },
              },
              (error, response, body) => {
                if (error != null) {
                  throw error
                }
                expect(response.statusCode).to.equal(200)
                return done()
              }
            )
          }
        )
      })

      it('should have created the doc in the named folder', function (done) {
        return this.owner.getProject(this.project_id, (error, project) => {
          if (error != null) {
            throw error
          }
          const folder = _.find(
            project.rootFolder[0].folders,
            folder => folder.name === 'foldername'
          )
          let doc = _.find(folder.docs, doc => doc.name === 'foo2.tex')
          doc = MockDocstoreApi.docs[this.project_id][doc._id]
          expect(doc.lines).to.deep.equal(['hello world, this is foo-2.tex!'])
          return done()
        })
      })
    })

    describe('restoring to a directory that no longer exists', function () {
      beforeEach(function (done) {
        MockProjectHistoryApi.addOldFile(
          this.project_id,
          42,
          'nothere/foo3.tex',
          'hello world, this is foo-3.tex!'
        )
        return this.owner.request(
          {
            method: 'POST',
            url: `/project/${this.project_id}/restore_file`,
            json: {
              pathname: 'nothere/foo3.tex',
              version: 42,
            },
          },
          (error, response, body) => {
            if (error != null) {
              throw error
            }
            expect(response.statusCode).to.equal(200)
            return done()
          }
        )
      })

      it('should have created the folder and restored the doc to it', function (done) {
        return this.owner.getProject(this.project_id, (error, project) => {
          if (error != null) {
            throw error
          }
          const folder = _.find(
            project.rootFolder[0].folders,
            folder => folder.name === 'nothere'
          )
          expect(folder).to.exist
          let doc = _.find(folder.docs, doc => doc.name === 'foo3.tex')
          doc = MockDocstoreApi.docs[this.project_id][doc._id]
          expect(doc.lines).to.deep.equal(['hello world, this is foo-3.tex!'])
          return done()
        })
      })
    })

    describe('restoring to a filename that already exists', function () {
      beforeEach(function (done) {
        MockProjectHistoryApi.addOldFile(
          this.project_id,
          42,
          'main.tex',
          'hello world, this is main.tex!'
        )
        return this.owner.request(
          {
            method: 'POST',
            url: `/project/${this.project_id}/restore_file`,
            json: {
              pathname: 'main.tex',
              version: 42,
            },
          },
          (error, response, body) => {
            if (error != null) {
              throw error
            }
            expect(response.statusCode).to.equal(200)
            return done()
          }
        )
      })

      it('should have created the doc in the root folder', function (done) {
        return this.owner.getProject(this.project_id, (error, project) => {
          if (error != null) {
            throw error
          }
          let doc = _.find(project.rootFolder[0].docs, doc =>
            doc.name.match(/main \(Restored on/)
          )
          expect(doc).to.exist
          doc = MockDocstoreApi.docs[this.project_id][doc._id]
          expect(doc.lines).to.deep.equal(['hello world, this is main.tex!'])
          return done()
        })
      })
    })
  })
})
