/* eslint-disable
    no-undef,
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
import sinon from 'sinon'
import { expect } from 'chai'
import Settings from '@overleaf/settings'
import request from 'request'
import assert from 'node:assert'
import Path from 'node:path'
import crypto from 'node:crypto'
import mongodb from 'mongodb-legacy'
import nock from 'nock'
import * as ProjectHistoryClient from './helpers/ProjectHistoryClient.js'
import * as ProjectHistoryApp from './helpers/ProjectHistoryApp.js'
import * as HistoryId from './helpers/HistoryId.js'
const { ObjectId } = mongodb

const MockHistoryStore = () => nock('http://127.0.0.1:3100')
const MockFileStore = () => nock('http://127.0.0.1:3009')
const MockWeb = () => nock('http://127.0.0.1:3000')

const sha = data => crypto.createHash('sha1').update(data).digest('hex')

describe('FileTree Diffs', function () {
  beforeEach(function (done) {
    return ProjectHistoryApp.ensureRunning(error => {
      if (error != null) {
        throw error
      }

      this.historyId = new ObjectId().toString()
      this.projectId = new ObjectId().toString()

      MockHistoryStore().post('/api/projects').reply(200, {
        projectId: this.historyId,
      })
      MockWeb()
        .get(`/project/${this.projectId}/details`)
        .reply(200, {
          name: 'Test Project',
          overleaf: { history: { id: this.historyId } },
        })

      return ProjectHistoryClient.initializeProject(
        this.historyId,
        (error, olProject) => {
          if (error != null) {
            throw error
          }
          return done()
        }
      )
    })
  })

  afterEach(function () {
    return nock.cleanAll()
  })

  it('should return a diff of the updates to a doc from a single chunk', function (done) {
    MockHistoryStore()
      .get(`/api/projects/${this.historyId}/versions/7/history`)
      .reply(200, {
        chunk: {
          history: {
            snapshot: {
              files: {
                'foo.tex': {
                  hash: sha('mock-sha-foo'),
                  stringLength: 42,
                },
                'renamed.tex': {
                  hash: sha('mock-sha-renamed'),
                  stringLength: 42,
                },
                'deleted.tex': {
                  hash: sha('mock-sha-deleted'),
                  stringLength: 42,
                },
              },
            },
            changes: [
              {
                operations: [
                  {
                    pathname: 'renamed.tex',
                    newPathname: 'newName.tex',
                  },
                ],
                timestamp: '2017-12-04T10:29:17.786Z',
                authors: [31],
              },
              {
                operations: [
                  {
                    pathname: 'foo.tex',
                    textOperation: ['lorem ipsum'],
                  },
                ],
                timestamp: '2017-12-04T10:29:17.786Z',
                authors: [31],
              },
              {
                operations: [
                  {
                    pathname: 'deleted.tex',
                    newPathname: '',
                  },
                ],
                timestamp: '2017-12-04T10:29:22.905Z',
                authors: [31],
              },
              {
                operations: [
                  {
                    file: {
                      hash: sha('new-sha'),
                      stringLength: 42,
                    },
                    pathname: 'added.tex',
                  },
                ],
                timestamp: '2017-12-04T10:29:22.905Z',
                authors: [31],
              },
            ],
          },
          startVersion: 3,
        },
        authors: [{ id: 31, email: 'james.allen@overleaf.com', name: 'James' }],
      })

    return ProjectHistoryClient.getFileTreeDiff(
      this.projectId,
      3,
      7,
      (error, diff) => {
        if (error != null) {
          throw error
        }
        expect(diff).to.deep.equal({
          diff: [
            {
              pathname: 'foo.tex',
              operation: 'edited',
            },
            {
              pathname: 'deleted.tex',
              operation: 'removed',
              deletedAtV: 5,
              editable: true,
            },
            {
              newPathname: 'newName.tex',
              pathname: 'renamed.tex',
              operation: 'renamed',
              editable: true,
            },
            {
              pathname: 'added.tex',
              operation: 'added',
              editable: true,
            },
          ],
        })
        return done()
      }
    )
  })

  it('should return a diff of the updates to a doc across multiple chunks', function (done) {
    MockHistoryStore()
      .get(`/api/projects/${this.historyId}/versions/5/history`)
      .reply(200, {
        chunk: {
          history: {
            snapshot: {
              files: {
                'foo.tex': {
                  // Updated in this chunk
                  hash: sha('mock-sha-foo'),
                  stringLength: 42,
                },
                'bar.tex': {
                  // Updated in the next chunk
                  hash: sha('mock-sha-bar'),
                  stringLength: 42,
                },
                'baz.tex': {
                  // Not updated
                  hash: sha('mock-sha-bar'),
                  stringLength: 42,
                },
                'renamed.tex': {
                  hash: sha('mock-sha-renamed'),
                  stringLength: 42,
                },
                'deleted.tex': {
                  hash: sha('mock-sha-deleted'),
                  stringLength: 42,
                },
              },
            },
            changes: [
              {
                operations: [
                  {
                    pathname: 'renamed.tex',
                    newPathname: 'newName.tex',
                  },
                ],
                timestamp: '2017-12-04T10:29:17.786Z',
                authors: [31],
              },
              {
                operations: [
                  {
                    pathname: 'foo.tex',
                    textOperation: ['lorem ipsum'],
                  },
                ],
                timestamp: '2017-12-04T10:29:19.786Z',
                authors: [31],
              },
              {
                operations: [
                  {
                    pathname: 'deleted.tex',
                    newPathname: '',
                  },
                ],
                timestamp: '2017-12-04T10:29:22.905Z',
                authors: [31],
              },
            ],
          },
          startVersion: 2,
        },
        authors: [{ id: 31, email: 'james.allen@overleaf.com', name: 'James' }],
      })
    MockHistoryStore()
      .get(`/api/projects/${this.historyId}/versions/7/history`)
      .reply(200, {
        chunk: {
          history: {
            snapshot: {
              files: {
                'foo.tex': {
                  hash: sha('mock-sha-foo'),
                  stringLength: 42,
                },
                'baz.tex': {
                  hash: sha('mock-sha-bar'),
                  stringLength: 42,
                },
                'newName.tex': {
                  hash: sha('mock-sha-renamed'),
                  stringLength: 42,
                },
              },
            },
            changes: [
              {
                operations: [
                  {
                    file: {
                      hash: sha('new-sha'),
                      stringLength: 42,
                    },
                    pathname: 'added.tex',
                  },
                ],
                timestamp: '2017-12-04T10:29:22.905Z',
                authors: [31],
              },
              {
                operations: [
                  {
                    pathname: 'bar.tex',
                    textOperation: ['lorem ipsum'],
                  },
                ],
                timestamp: '2017-12-04T10:29:23.786Z',
                authors: [31],
              },
            ],
          },
          startVersion: 5,
        },
        authors: [{ id: 31, email: 'james.allen@overleaf.com', name: 'James' }],
      })

    return ProjectHistoryClient.getFileTreeDiff(
      this.projectId,
      2,
      7,
      (error, diff) => {
        if (error != null) {
          throw error
        }
        expect(diff).to.deep.equal({
          diff: [
            {
              pathname: 'foo.tex',
              operation: 'edited',
            },
            {
              pathname: 'bar.tex',
              operation: 'edited',
            },
            {
              pathname: 'baz.tex',
              editable: true,
            },
            {
              pathname: 'deleted.tex',
              operation: 'removed',
              deletedAtV: 4,
              editable: true,
            },
            {
              newPathname: 'newName.tex',
              pathname: 'renamed.tex',
              operation: 'renamed',
              editable: true,
            },
            {
              pathname: 'added.tex',
              operation: 'added',
              editable: true,
            },
          ],
        })
        return done()
      }
    )
  })

  it('should return a diff that includes multiple renames', function (done) {
    MockHistoryStore()
      .get(`/api/projects/${this.historyId}/versions/5/history`)
      .reply(200, {
        chunk: {
          history: {
            snapshot: {
              files: {
                'one.tex': {
                  hash: sha('mock-sha'),
                  stringLength: 42,
                },
              },
            },
            changes: [
              {
                operations: [
                  {
                    pathname: 'one.tex',
                    newPathname: 'two.tex',
                  },
                ],
                timestamp: '2017-12-04T10:29:17.786Z',
                authors: [31],
              },
              {
                operations: [
                  {
                    pathname: 'two.tex',
                    newPathname: 'three.tex',
                  },
                ],
                timestamp: '2017-12-04T10:29:22.905Z',
                authors: [31],
              },
            ],
          },
          startVersion: 3,
        },
        authors: [{ id: 31, email: 'james.allen@overleaf.com', name: 'James' }],
      })

    return ProjectHistoryClient.getFileTreeDiff(
      this.projectId,
      3,
      5,
      (error, diff) => {
        if (error != null) {
          throw error
        }
        expect(diff).to.deep.equal({
          diff: [
            {
              newPathname: 'three.tex',
              pathname: 'one.tex',
              operation: 'renamed',
              editable: true,
            },
          ],
        })
        return done()
      }
    )
  })

  it('should handle deleting then re-adding a file', function (done) {
    MockHistoryStore()
      .get(`/api/projects/${this.historyId}/versions/5/history`)
      .reply(200, {
        chunk: {
          history: {
            snapshot: {
              files: {
                'one.tex': {
                  hash: sha('mock-sha'),
                  stringLength: 42,
                },
              },
            },
            changes: [
              {
                operations: [
                  {
                    pathname: 'one.tex',
                    newPathname: '',
                  },
                ],
                timestamp: '2017-12-04T10:29:17.786Z',
                authors: [31],
              },
              {
                operations: [
                  {
                    pathname: 'one.tex',
                    file: {
                      hash: sha('mock-sha'),
                    },
                  },
                ],
                timestamp: '2017-12-04T10:29:22.905Z',
                authors: [31],
              },
            ],
          },
          startVersion: 3,
        },
        authors: [{ id: 31, email: 'james.allen@overleaf.com', name: 'James' }],
      })

    return ProjectHistoryClient.getFileTreeDiff(
      this.projectId,
      3,
      5,
      (error, diff) => {
        if (error != null) {
          throw error
        }
        expect(diff).to.deep.equal({
          diff: [
            {
              pathname: 'one.tex',
              operation: 'added',
              editable: null,
            },
          ],
        })
        return done()
      }
    )
  })

  it('should handle deleting the renaming a file to the same place', function (done) {
    MockHistoryStore()
      .get(`/api/projects/${this.historyId}/versions/5/history`)
      .reply(200, {
        chunk: {
          history: {
            snapshot: {
              files: {
                'one.tex': {
                  hash: sha('mock-sha-one'),
                  stringLength: 42,
                },
                'two.tex': {
                  hash: sha('mock-sha-two'),
                  stringLength: 42,
                },
              },
            },
            changes: [
              {
                operations: [
                  {
                    pathname: 'one.tex',
                    newPathname: '',
                  },
                ],
                timestamp: '2017-12-04T10:29:17.786Z',
                authors: [31],
              },
              {
                operations: [
                  {
                    pathname: 'two.tex',
                    newPathname: 'one.tex',
                  },
                ],
                timestamp: '2017-12-04T10:29:22.905Z',
                authors: [31],
              },
            ],
          },
          startVersion: 3,
        },
        authors: [{ id: 31, email: 'james.allen@overleaf.com', name: 'James' }],
      })

    return ProjectHistoryClient.getFileTreeDiff(
      this.projectId,
      3,
      5,
      (error, diff) => {
        if (error != null) {
          throw error
        }
        expect(diff).to.deep.equal({
          diff: [
            {
              pathname: 'two.tex',
              newPathname: 'one.tex',
              operation: 'renamed',
              editable: true,
            },
          ],
        })
        return done()
      }
    )
  })

  it('should handle adding then renaming a file', function (done) {
    MockHistoryStore()
      .get(`/api/projects/${this.historyId}/versions/5/history`)
      .reply(200, {
        chunk: {
          history: {
            snapshot: {
              files: {},
            },
            changes: [
              {
                operations: [
                  {
                    pathname: 'one.tex',
                    file: {
                      hash: sha('mock-sha'),
                      stringLength: 42,
                    },
                  },
                ],
                timestamp: '2017-12-04T10:29:17.786Z',
                authors: [31],
              },
              {
                operations: [
                  {
                    pathname: 'one.tex',
                    newPathname: 'two.tex',
                  },
                ],
                timestamp: '2017-12-04T10:29:22.905Z',
                authors: [31],
              },
            ],
          },
          startVersion: 3,
        },
        authors: [{ id: 31, email: 'james.allen@overleaf.com', name: 'James' }],
      })

    return ProjectHistoryClient.getFileTreeDiff(
      this.projectId,
      3,
      5,
      (error, diff) => {
        if (error != null) {
          throw error
        }
        expect(diff).to.deep.equal({
          diff: [
            {
              pathname: 'two.tex',
              operation: 'added',
              editable: true,
            },
          ],
        })
        return done()
      }
    )
  })

  it('should return 422 with a chunk with an invalid rename', function (done) {
    MockHistoryStore()
      .get(`/api/projects/${this.historyId}/versions/6/history`)
      .reply(200, {
        chunk: {
          history: {
            snapshot: {
              files: {
                'foo.tex': {
                  hash: sha('mock-sha-foo'),
                  stringLength: 42,
                },
                'bar.tex': {
                  hash: sha('mock-sha-bar'),
                  stringLength: 42,
                },
              },
            },
            changes: [
              {
                operations: [
                  {
                    pathname: 'foo.tex',
                    newPathname: 'bar.tex',
                  },
                ],
                timestamp: '2017-12-04T10:29:17.786Z',
                authors: [31],
              },
            ],
          },
          startVersion: 5,
        },
        authors: [{ id: 31, email: 'james.allen@overleaf.com', name: 'James' }],
      })

    return ProjectHistoryClient.getFileTreeDiff(
      this.projectId,
      5,
      6,
      (error, diff, statusCode) => {
        if (error != null) {
          throw error
        }
        expect(statusCode).to.equal(422)
        return done()
      }
    )
  })

  it('should return 200 with a chunk with an invalid add', function (done) {
    MockHistoryStore()
      .get(`/api/projects/${this.historyId}/versions/6/history`)
      .reply(200, {
        chunk: {
          history: {
            snapshot: {
              files: {
                'foo.tex': {
                  hash: sha('mock-sha-foo'),
                  stringLength: 42,
                },
              },
            },
            changes: [
              {
                operations: [
                  {
                    file: {
                      hash: sha('new-sha'),
                    },
                    pathname: 'foo.tex',
                  },
                ],
                timestamp: '2017-12-04T10:29:17.786Z',
                authors: [31],
              },
            ],
          },
          startVersion: 5,
        },
        authors: [{ id: 31, email: 'james.allen@overleaf.com', name: 'James' }],
      })

    return ProjectHistoryClient.getFileTreeDiff(
      this.projectId,
      5,
      6,
      (error, diff, statusCode) => {
        if (error != null) {
          throw error
        }
        expect(diff).to.deep.equal({
          diff: [
            {
              pathname: 'foo.tex',
              operation: 'added',
              editable: null,
            },
          ],
        })
        expect(statusCode).to.equal(200)
        return done()
      }
    )
  })

  it('should handle edits of missing/invalid files ', function (done) {
    MockHistoryStore()
      .get(`/api/projects/${this.historyId}/versions/5/history`)
      .reply(200, {
        chunk: {
          history: {
            snapshot: {
              files: {},
            },
            changes: [
              {
                operations: [
                  {
                    pathname: 'new.tex',
                    textOperation: ['lorem ipsum'],
                  },
                ],
                timestamp: '2017-12-04T10:29:18.786Z',
                authors: [31],
              },
              {
                operations: [
                  {
                    pathname: '',
                    textOperation: ['lorem ipsum'],
                  },
                ],
                timestamp: '2017-12-04T10:29:17.786Z',
                authors: [31],
              },
            ],
          },
          startVersion: 3,
        },
        authors: [{ id: 31, email: 'james.allen@overleaf.com', name: 'James' }],
      })

    return ProjectHistoryClient.getFileTreeDiff(
      this.projectId,
      3,
      5,
      (error, diff) => {
        if (error != null) {
          throw error
        }
        expect(diff).to.deep.equal({
          diff: [
            {
              operation: 'edited',
              pathname: 'new.tex',
            },
          ],
        })
        return done()
      }
    )
  })

  it('should handle deletions of missing/invalid files ', function (done) {
    MockHistoryStore()
      .get(`/api/projects/${this.historyId}/versions/5/history`)
      .reply(200, {
        chunk: {
          history: {
            snapshot: {
              files: {},
            },
            changes: [
              {
                operations: [
                  {
                    pathname: 'missing.tex',
                    newPathname: '',
                  },
                ],
                timestamp: '2017-12-04T10:29:17.786Z',
                authors: [31],
              },
              {
                operations: [
                  {
                    pathname: '',
                    newPathname: '',
                  },
                ],
                timestamp: '2017-12-04T10:29:17.786Z',
                authors: [31],
              },
            ],
          },
          startVersion: 3,
        },
        authors: [{ id: 31, email: 'james.allen@overleaf.com', name: 'James' }],
      })

    return ProjectHistoryClient.getFileTreeDiff(
      this.projectId,
      3,
      5,
      (error, diff) => {
        if (error != null) {
          throw error
        }
        expect(diff).to.deep.equal({
          diff: [],
        })
        return done()
      }
    )
  })

  return it('should handle renames of missing/invalid files ', function (done) {
    MockHistoryStore()
      .get(`/api/projects/${this.historyId}/versions/5/history`)
      .reply(200, {
        chunk: {
          history: {
            snapshot: {
              files: {},
            },
            changes: [
              {
                operations: [
                  {
                    pathname: 'missing.tex',
                    newPathname: 'missing-renamed.tex',
                  },
                ],
                timestamp: '2017-12-04T10:29:17.786Z',
                authors: [31],
              },
              {
                operations: [
                  {
                    pathname: '',
                    newPathname: 'missing-renamed-other.tex',
                  },
                ],
                timestamp: '2017-12-04T10:29:17.786Z',
                authors: [31],
              },
            ],
          },
          startVersion: 3,
        },
        authors: [{ id: 31, email: 'james.allen@overleaf.com', name: 'James' }],
      })

    return ProjectHistoryClient.getFileTreeDiff(
      this.projectId,
      3,
      5,
      (error, diff) => {
        if (error != null) {
          throw error
        }
        expect(diff).to.deep.equal({
          diff: [],
        })
        return done()
      }
    )
  })
})
