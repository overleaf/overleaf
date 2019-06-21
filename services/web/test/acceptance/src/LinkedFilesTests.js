/* eslint-disable
    camelcase,
    handle-callback-err,
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
const async = require('async')
const { expect } = require('chai')
const _ = require('underscore')
const mkdirp = require('mkdirp')

const Settings = require('settings-sharelatex')
const MockFileStoreApi = require('./helpers/MockFileStoreApi')
const request = require('./helpers/request')
const User = require('./helpers/User')

const MockClsiApi = require('./helpers/MockClsiApi')

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
  before(function(done) {
    return LinkedUrlProxy.listen(6543, error => {
      if (error != null) {
        return done(error)
      }
      this.owner = new User()
      return this.owner.login(() => mkdirp(Settings.path.dumpFolder, done))
    })
  })

  describe('creating a project linked file', function() {
    before(function(done) {
      this.source_doc_name = 'test.txt'
      return async.series(
        [
          cb => {
            return this.owner.createProject(
              'plf-test-one',
              { template: 'blank' },
              (error, project_id) => {
                this.project_one_id = project_id
                return cb(error)
              }
            )
          },
          cb => {
            return this.owner.getProject(
              this.project_one_id,
              (error, project) => {
                this.project_one = project
                this.project_one_root_folder_id = project.rootFolder[0]._id.toString()
                return cb(error)
              }
            )
          },
          cb => {
            return this.owner.createProject(
              'plf-test-two',
              { template: 'blank' },
              (error, project_id) => {
                this.project_two_id = project_id
                return cb(error)
              }
            )
          },
          cb => {
            return this.owner.getProject(
              this.project_two_id,
              (error, project) => {
                this.project_two = project
                this.project_two_root_folder_id = project.rootFolder[0]._id.toString()
                return cb(error)
              }
            )
          },
          cb => {
            return this.owner.createDocInProject(
              this.project_two_id,
              this.project_two_root_folder_id,
              this.source_doc_name,
              (error, doc_id) => {
                this.source_doc_id = doc_id
                return cb(error)
              }
            )
          },
          cb => {
            return this.owner.createDocInProject(
              this.project_two_id,
              this.project_two_root_folder_id,
              'some-harmless-doc.txt',
              (error, doc_id) => {
                return cb(error)
              }
            )
          }
        ],
        done
      )
    })

    it('should produce a list of the users projects', function(done) {
      return this.owner.request.get(
        {
          url: '/user/projects',
          json: true
        },
        (err, response, body) => {
          expect(err).to.not.exist
          expect(body).to.deep.equal({
            projects: [
              {
                _id: this.project_one_id,
                name: 'plf-test-one',
                accessLevel: 'owner'
              },
              {
                _id: this.project_two_id,
                name: 'plf-test-two',
                accessLevel: 'owner'
              }
            ]
          })
          return done()
        }
      )
    })

    it('should produce a list of entities in the project', function(done) {
      return this.owner.request.get(
        {
          url: `/project/${this.project_two_id}/entities`,
          json: true
        },
        (err, response, body) => {
          expect(err).to.not.exist
          expect(body).to.deep.equal({
            project_id: this.project_two_id,
            entities: [
              { path: '/main.tex', type: 'doc' },
              { path: '/some-harmless-doc.txt', type: 'doc' },
              { path: '/test.txt', type: 'doc' }
            ]
          })
          return done()
        }
      )
    })

    it('should import a file from the source project', function(done) {
      return this.owner.request.post(
        {
          url: `/project/${this.project_one_id}/linked_file`,
          json: {
            name: 'test-link.txt',
            parent_folder_id: this.project_one_root_folder_id,
            provider: 'project_file',
            data: {
              source_project_id: this.project_two_id,
              source_entity_path: `/${this.source_doc_name}`
            }
          }
        },
        (error, response, body) => {
          expect(response.statusCode).to.equal(200)
          const { new_file_id } = body
          this.existing_file_id = new_file_id
          expect(new_file_id).to.exist
          return this.owner.getProject(
            this.project_one_id,
            (error, project) => {
              if (error != null) {
                return done(error)
              }
              const firstFile = project.rootFolder[0].fileRefs[0]
              expect(firstFile._id.toString()).to.equal(new_file_id.toString())
              expect(firstFile.linkedFileData).to.deep.equal({
                provider: 'project_file',
                source_project_id: this.project_two_id,
                source_entity_path: `/${this.source_doc_name}`
              })
              expect(firstFile.name).to.equal('test-link.txt')
              return done()
            }
          )
        }
      )
    })

    it('should refresh the file', function(done) {
      return this.owner.request.post(
        {
          url: `/project/${this.project_one_id}/linked_file/${
            this.existing_file_id
          }/refresh`,
          json: true
        },
        (error, response, body) => {
          expect(response.statusCode).to.equal(200)
          const { new_file_id } = body
          expect(new_file_id).to.exist
          expect(new_file_id).to.not.equal(this.existing_file_id)
          this.refreshed_file_id = new_file_id
          return this.owner.getProject(
            this.project_one_id,
            (error, project) => {
              if (error != null) {
                return done(error)
              }
              const firstFile = project.rootFolder[0].fileRefs[0]
              expect(firstFile._id.toString()).to.equal(new_file_id.toString())
              expect(firstFile.name).to.equal('test-link.txt')
              return done()
            }
          )
        }
      )
    })

    it('should not allow to create a linked-file with v1 id', function(done) {
      return this.owner.request.post(
        {
          url: `/project/${this.project_one_id}/linked_file`,
          json: {
            name: 'test-link-should-not-work.txt',
            parent_folder_id: this.project_one_root_folder_id,
            provider: 'project_file',
            data: {
              v1_source_doc_id: 1234,
              source_entity_path: `/${this.source_doc_name}`
            }
          }
        },
        (error, response, body) => {
          expect(response.statusCode).to.equal(403)
          expect(body).to.equal('You do not have access to this project')
          return done()
        }
      )
    })
  })

  describe('with a linked project_file from a v1 project that has not been imported', function() {
    before(function(done) {
      return async.series(
        [
          cb => {
            return this.owner.createProject(
              'plf-v1-test-one',
              { template: 'blank' },
              (error, project_id) => {
                this.project_one_id = project_id
                return cb(error)
              }
            )
          },
          cb => {
            return this.owner.getProject(
              this.project_one_id,
              (error, project) => {
                this.project_one = project
                this.project_one_root_folder_id = project.rootFolder[0]._id.toString()
                this.project_one.rootFolder[0].fileRefs.push({
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
                return this.owner.saveProject(this.project_one, cb)
              }
            )
          }
        ],
        done
      )
    })

    it('should refuse to refresh', function(done) {
      return this.owner.request.post(
        {
          url: `/project/${this.project_one_id}/linked_file/abcd/refresh`,
          json: true
        },
        (error, response, body) => {
          expect(response.statusCode).to.equal(409)
          expect(body).to.equal(
            'Sorry, the source project is not yet imported to Overleaf v2. Please import it to Overleaf v2 to refresh this file'
          )
          return done()
        }
      )
    })
  })

  describe('creating a URL based linked file', function() {
    before(function(done) {
      return this.owner.createProject(
        'url-linked-files-project',
        { template: 'blank' },
        (error, project_id) => {
          if (error != null) {
            throw error
          }
          this.project_id = project_id
          return this.owner.getProject(project_id, (error, project) => {
            if (error != null) {
              throw error
            }
            this.project = project
            this.root_folder_id = project.rootFolder[0]._id.toString()
            return done()
          })
        }
      )
    })

    it('should download the URL and create a file with the contents and linkedFileData', function(done) {
      return this.owner.request.post(
        {
          url: `/project/${this.project_id}/linked_file`,
          json: {
            provider: 'url',
            data: {
              url: 'http://example.com/foo'
            },
            parent_folder_id: this.root_folder_id,
            name: 'url-test-file-1'
          }
        },
        (error, response, body) => {
          if (error != null) {
            throw error
          }
          expect(response.statusCode).to.equal(200)
          return this.owner.getProject(this.project_id, (error, project) => {
            if (error != null) {
              throw error
            }
            const file = project.rootFolder[0].fileRefs[0]
            expect(file.linkedFileData).to.deep.equal({
              provider: 'url',
              url: 'http://example.com/foo'
            })
            return this.owner.request.get(
              `/project/${this.project_id}/file/${file._id}`,
              function(error, response, body) {
                if (error != null) {
                  throw error
                }
                expect(response.statusCode).to.equal(200)
                expect(body).to.equal('foo foo foo')
                return done()
              }
            )
          })
        }
      )
    })

    it('should replace and update a URL based linked file', function(done) {
      return this.owner.request.post(
        {
          url: `/project/${this.project_id}/linked_file`,
          json: {
            provider: 'url',
            data: {
              url: 'http://example.com/foo'
            },
            parent_folder_id: this.root_folder_id,
            name: 'url-test-file-2'
          }
        },
        (error, response, body) => {
          if (error != null) {
            throw error
          }
          expect(response.statusCode).to.equal(200)
          return this.owner.request.post(
            {
              url: `/project/${this.project_id}/linked_file`,
              json: {
                provider: 'url',
                data: {
                  url: 'http://example.com/bar'
                },
                parent_folder_id: this.root_folder_id,
                name: 'url-test-file-2'
              }
            },
            (error, response, body) => {
              if (error != null) {
                throw error
              }
              expect(response.statusCode).to.equal(200)
              return this.owner.getProject(
                this.project_id,
                (error, project) => {
                  if (error != null) {
                    throw error
                  }
                  const file = project.rootFolder[0].fileRefs[1]
                  expect(file.linkedFileData).to.deep.equal({
                    provider: 'url',
                    url: 'http://example.com/bar'
                  })
                  return this.owner.request.get(
                    `/project/${this.project_id}/file/${file._id}`,
                    function(error, response, body) {
                      if (error != null) {
                        throw error
                      }
                      expect(response.statusCode).to.equal(200)
                      expect(body).to.equal('bar bar bar')
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

    it('should return an error if the URL does not succeed', function(done) {
      return this.owner.request.post(
        {
          url: `/project/${this.project_id}/linked_file`,
          json: {
            provider: 'url',
            data: {
              url: 'http://example.com/does-not-exist'
            },
            parent_folder_id: this.root_folder_id,
            name: 'url-test-file-3'
          }
        },
        (error, response, body) => {
          if (error != null) {
            throw error
          }
          expect(response.statusCode).to.equal(422) // unprocessable
          expect(body).to.equal(
            'Your URL could not be reached (404 status code). Please check it and try again.'
          )
          return done()
        }
      )
    })

    it('should return an error if the URL is invalid', function(done) {
      return this.owner.request.post(
        {
          url: `/project/${this.project_id}/linked_file`,
          json: {
            provider: 'url',
            data: {
              url: '!^$%'
            },
            parent_folder_id: this.root_folder_id,
            name: 'url-test-file-4'
          }
        },
        (error, response, body) => {
          if (error != null) {
            throw error
          }
          expect(response.statusCode).to.equal(422) // unprocessable
          expect(body).to.equal(
            'Your URL is not valid. Please check it and try again.'
          )
          return done()
        }
      )
    })

    it('should return an error if the URL uses a non-http protocol', function(done) {
      return this.owner.request.post(
        {
          url: `/project/${this.project_id}/linked_file`,
          json: {
            provider: 'url',
            data: {
              url: 'ftp://localhost'
            },
            parent_folder_id: this.root_folder_id,
            name: 'url-test-file-5'
          }
        },
        (error, response, body) => {
          if (error != null) {
            throw error
          }
          expect(response.statusCode).to.equal(422) // unprocessable
          expect(body).to.equal(
            'Your URL is not valid. Please check it and try again.'
          )
          return done()
        }
      )
    })

    it('should accept a URL withuot a leading http://, and add it', function(done) {
      return this.owner.request.post(
        {
          url: `/project/${this.project_id}/linked_file`,
          json: {
            provider: 'url',
            data: {
              url: 'example.com/foo'
            },
            parent_folder_id: this.root_folder_id,
            name: 'url-test-file-6'
          }
        },
        (error, response, body) => {
          if (error != null) {
            throw error
          }
          expect(response.statusCode).to.equal(200)
          return this.owner.getProject(this.project_id, (error, project) => {
            if (error != null) {
              throw error
            }
            const file = _.find(
              project.rootFolder[0].fileRefs,
              file => file.name === 'url-test-file-6'
            )
            expect(file.linkedFileData).to.deep.equal({
              provider: 'url',
              url: 'http://example.com/foo'
            })
            return this.owner.request.get(
              `/project/${this.project_id}/file/${file._id}`,
              function(error, response, body) {
                if (error != null) {
                  throw error
                }
                expect(response.statusCode).to.equal(200)
                expect(body).to.equal('foo foo foo')
                return done()
              }
            )
          })
        }
      )
    })
  })

  // TODO: Add test for asking for host that return ENOTFOUND
  // (This will probably end up handled by the proxy)

  describe('creating a linked output file', function() {
    before(function(done) {
      return async.series(
        [
          cb => {
            return this.owner.createProject(
              'output-test-one',
              { template: 'blank' },
              (error, project_id) => {
                this.project_one_id = project_id
                return cb(error)
              }
            )
          },
          cb => {
            return this.owner.getProject(
              this.project_one_id,
              (error, project) => {
                this.project_one = project
                this.project_one_root_folder_id = project.rootFolder[0]._id.toString()
                return cb(error)
              }
            )
          },
          cb => {
            return this.owner.createProject(
              'output-test-two',
              { template: 'blank' },
              (error, project_id) => {
                this.project_two_id = project_id
                return cb(error)
              }
            )
          },
          cb => {
            return this.owner.getProject(
              this.project_two_id,
              (error, project) => {
                this.project_two = project
                this.project_two_root_folder_id = project.rootFolder[0]._id.toString()
                return cb(error)
              }
            )
          }
        ],
        done
      )
    })

    it('should import the project.pdf file from the source project', function(done) {
      return this.owner.request.post(
        {
          url: `/project/${this.project_one_id}/linked_file`,
          json: {
            name: 'test.pdf',
            parent_folder_id: this.project_one_root_folder_id,
            provider: 'project_output_file',
            data: {
              source_project_id: this.project_two_id,
              source_output_file_path: 'project.pdf',
              build_id: '1234-abcd'
            }
          }
        },
        (error, response, body) => {
          const { new_file_id } = body
          this.existing_file_id = new_file_id
          expect(new_file_id).to.exist
          return this.owner.getProject(
            this.project_one_id,
            (error, project) => {
              if (error != null) {
                return done(error)
              }
              const firstFile = project.rootFolder[0].fileRefs[0]
              expect(firstFile._id.toString()).to.equal(new_file_id.toString())
              expect(firstFile.linkedFileData).to.deep.equal({
                provider: 'project_output_file',
                source_project_id: this.project_two_id,
                source_output_file_path: 'project.pdf',
                build_id: '1234-abcd'
              })
              expect(firstFile.name).to.equal('test.pdf')
              return done()
            }
          )
        }
      )
    })

    it('should refresh the file', function(done) {
      return this.owner.request.post(
        {
          url: `/project/${this.project_one_id}/linked_file/${
            this.existing_file_id
          }/refresh`,
          json: true
        },
        (error, response, body) => {
          const { new_file_id } = body
          expect(new_file_id).to.exist
          expect(new_file_id).to.not.equal(this.existing_file_id)
          this.refreshed_file_id = new_file_id
          return this.owner.getProject(
            this.project_one_id,
            (error, project) => {
              if (error != null) {
                return done(error)
              }
              const firstFile = project.rootFolder[0].fileRefs[0]
              expect(firstFile._id.toString()).to.equal(new_file_id.toString())
              expect(firstFile.name).to.equal('test.pdf')
              return done()
            }
          )
        }
      )
    })
  })

  describe('with a linked project_output_file from a v1 project that has not been imported', function() {
    before(function(done) {
      return async.series(
        [
          cb => {
            return this.owner.createProject(
              'output-v1-test-one',
              { template: 'blank' },
              (error, project_id) => {
                this.project_one_id = project_id
                return cb(error)
              }
            )
          },
          cb => {
            return this.owner.getProject(
              this.project_one_id,
              (error, project) => {
                this.project_one = project
                this.project_one_root_folder_id = project.rootFolder[0]._id.toString()
                this.project_one.rootFolder[0].fileRefs.push({
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
                return this.owner.saveProject(this.project_one, cb)
              }
            )
          }
        ],
        done
      )
    })

    it('should refuse to refresh', function(done) {
      return this.owner.request.post(
        {
          url: `/project/${this.project_one_id}/linked_file/abcdef/refresh`,
          json: true
        },
        (error, response, body) => {
          expect(response.statusCode).to.equal(409)
          expect(body).to.equal(
            'Sorry, the source project is not yet imported to Overleaf v2. Please import it to Overleaf v2 to refresh this file'
          )
          return done()
        }
      )
    })
  })
})
