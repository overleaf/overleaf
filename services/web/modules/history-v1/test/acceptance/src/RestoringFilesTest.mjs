import { expect } from 'chai'

import _ from 'lodash'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import Path from 'node:path'
import User from '../../../../../test/acceptance/src/helpers/User.mjs'
import MockProjectHistoryApiClass from '../../../../../test/acceptance/src/mocks/MockProjectHistoryApi.mjs'
import MockDocstoreApiClass from '../../../../../test/acceptance/src/mocks/MockDocstoreApi.mjs'
import MockFilestoreApiClass from '../../../../../test/acceptance/src/mocks/MockFilestoreApi.mjs'
import MockV1HistoryApiClass from '../../../../../test/acceptance/src/mocks/MockV1HistoryApi.mjs'
import Features from '../../../../../app/src/infrastructure/Features.js'

let MockProjectHistoryApi, MockDocstoreApi, MockFilestoreApi, MockV1HistoryApi

const __dirname = fileURLToPath(new URL('.', import.meta.url))

before(function () {
  MockProjectHistoryApi = MockProjectHistoryApiClass.instance()
  MockDocstoreApi = MockDocstoreApiClass.instance()
  MockFilestoreApi = MockFilestoreApiClass.instance()
  MockV1HistoryApi = MockV1HistoryApiClass.instance()
})

describe('RestoringFiles', function () {
  beforeEach(function (done) {
    this.owner = new User()
    this.owner.login(error => {
      if (error) {
        throw error
      }
      this.owner.createProject(
        'example-project',
        { template: 'example' },
        (error, projectId) => {
          this.project_id = projectId
          if (error) {
            throw error
          }
          done()
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
        this.owner.request(
          {
            method: 'POST',
            url: `/project/${this.project_id}/restore_file`,
            json: {
              pathname: 'foo.tex',
              version: 42,
            },
          },
          (error, response, body) => {
            if (error) {
              throw error
            }
            expect(response.statusCode).to.equal(200)
            done()
          }
        )
      })

      it('should have created a doc', function (done) {
        this.owner.getProject(this.project_id, (error, project) => {
          if (error) {
            throw error
          }
          let doc = _.find(
            project.rootFolder[0].docs,
            doc => doc.name === 'foo.tex'
          )
          doc = MockDocstoreApi.docs[this.project_id][doc._id]
          expect(doc.lines).to.deep.equal(['hello world, this is foo.tex!'])
          done()
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
        this.owner.request(
          {
            method: 'POST',
            url: `/project/${this.project_id}/restore_file`,
            json: {
              pathname: 'image.png',
              version: 42,
            },
          },
          (error, response, body) => {
            if (error) {
              throw error
            }
            expect(response.statusCode).to.equal(200)
            done()
          }
        )
      })

      if (Features.hasFeature('project-history-blobs')) {
        it('should have created a file in history-v1', function (done) {
          this.owner.getProject(this.project_id, (error, project) => {
            if (error) {
              throw error
            }
            let file = _.find(
              project.rootFolder[0].fileRefs,
              file => file.name === 'image.png'
            )
            file =
              MockV1HistoryApi.blobs[project.overleaf.history.id.toString()][
                file.hash
              ]
            expect(file).to.deep.equal(Buffer.from(this.pngData))
            done()
          })
        })
      }
      if (Features.hasFeature('filestore')) {
        it('should have created a file in filestore', function (done) {
          this.owner.getProject(this.project_id, (error, project) => {
            if (error) {
              throw error
            }
            let file = _.find(
              project.rootFolder[0].fileRefs,
              file => file.name === 'image.png'
            )
            file = MockFilestoreApi.getFile(this.project_id, file._id)
            expect(file).to.deep.equal(this.pngData)
            done()
          })
        })
      }
    })

    describe('restoring to a directory that exists', function () {
      beforeEach(function (done) {
        MockProjectHistoryApi.addOldFile(
          this.project_id,
          42,
          'foldername/foo2.tex',
          'hello world, this is foo-2.tex!'
        )
        this.owner.request.post(
          {
            uri: `project/${this.project_id}/folder`,
            json: {
              name: 'foldername',
            },
          },
          (error, response, body) => {
            if (error) {
              throw error
            }
            expect(response.statusCode).to.equal(200)
            this.owner.request(
              {
                method: 'POST',
                url: `/project/${this.project_id}/restore_file`,
                json: {
                  pathname: 'foldername/foo2.tex',
                  version: 42,
                },
              },
              (error, response, body) => {
                if (error) {
                  throw error
                }
                expect(response.statusCode).to.equal(200)
                done()
              }
            )
          }
        )
      })

      it('should have created the doc in the named folder', function (done) {
        this.owner.getProject(this.project_id, (error, project) => {
          if (error) {
            throw error
          }
          const folder = _.find(
            project.rootFolder[0].folders,
            folder => folder.name === 'foldername'
          )
          let doc = _.find(folder.docs, doc => doc.name === 'foo2.tex')
          doc = MockDocstoreApi.docs[this.project_id][doc._id]
          expect(doc.lines).to.deep.equal(['hello world, this is foo-2.tex!'])
          done()
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
        this.owner.request(
          {
            method: 'POST',
            url: `/project/${this.project_id}/restore_file`,
            json: {
              pathname: 'nothere/foo3.tex',
              version: 42,
            },
          },
          (error, response, body) => {
            if (error) {
              throw error
            }
            expect(response.statusCode).to.equal(200)
            done()
          }
        )
      })

      it('should have created the folder and restored the doc to it', function (done) {
        this.owner.getProject(this.project_id, (error, project) => {
          if (error) {
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
          done()
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
        this.owner.request(
          {
            method: 'POST',
            url: `/project/${this.project_id}/restore_file`,
            json: {
              pathname: 'main.tex',
              version: 42,
            },
          },
          (error, response, body) => {
            if (error) {
              throw error
            }
            expect(response.statusCode).to.equal(200)
            done()
          }
        )
      })

      it('should have created the doc in the root folder', function (done) {
        this.owner.getProject(this.project_id, (error, project) => {
          if (error) {
            throw error
          }
          let doc = _.find(project.rootFolder[0].docs, doc =>
            doc.name.match(/main \(Restored on/)
          )
          expect(doc).to.exist
          doc = MockDocstoreApi.docs[this.project_id][doc._id]
          expect(doc.lines).to.deep.equal(['hello world, this is main.tex!'])
          done()
        })
      })
    })
  })
})
