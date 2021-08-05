/* eslint-disable
    handle-callback-err,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const { expect } = require('chai')
const async = require('async')

const { db, ObjectId } = require('../../../app/js/mongodb')
const MockWebApi = require('./helpers/MockWebApi')
const DocUpdaterClient = require('./helpers/DocUpdaterClient')
const DocUpdaterApp = require('./helpers/DocUpdaterApp')

describe('Ranges', function () {
  before(function (done) {
    return DocUpdaterApp.ensureRunning(done)
  })

  describe('tracking changes from ops', function () {
    before(function (done) {
      this.project_id = DocUpdaterClient.randomId()
      this.user_id = DocUpdaterClient.randomId()
      this.id_seed = '587357bd35e64f6157'
      this.doc = {
        id: DocUpdaterClient.randomId(),
        lines: ['aaa'],
      }
      this.updates = [
        {
          doc: this.doc.id,
          op: [{ i: '123', p: 1 }],
          v: 0,
          meta: { user_id: this.user_id },
        },
        {
          doc: this.doc.id,
          op: [{ i: '456', p: 5 }],
          v: 1,
          meta: { user_id: this.user_id, tc: this.id_seed },
        },
        {
          doc: this.doc.id,
          op: [{ d: '12', p: 1 }],
          v: 2,
          meta: { user_id: this.user_id },
        },
      ]
      MockWebApi.insertDoc(this.project_id, this.doc.id, {
        lines: this.doc.lines,
        version: 0,
      })
      const jobs = []
      for (const update of Array.from(this.updates)) {
        ;(update => {
          return jobs.push(callback =>
            DocUpdaterClient.sendUpdate(
              this.project_id,
              this.doc.id,
              update,
              callback
            )
          )
        })(update)
      }

      return DocUpdaterApp.ensureRunning(error => {
        if (error != null) {
          throw error
        }
        return DocUpdaterClient.preloadDoc(
          this.project_id,
          this.doc.id,
          error => {
            if (error != null) {
              throw error
            }
            return async.series(jobs, error => {
              if (error != null) {
                throw error
              }
              return done()
            })
          }
        )
      })
    })

    it('should update the ranges', function (done) {
      return DocUpdaterClient.getDoc(
        this.project_id,
        this.doc.id,
        (error, res, data) => {
          if (error != null) {
            throw error
          }
          const { ranges } = data
          const change = ranges.changes[0]
          change.op.should.deep.equal({ i: '456', p: 3 })
          change.id.should.equal(this.id_seed + '000001')
          change.metadata.user_id.should.equal(this.user_id)
          return done()
        }
      )
    })

    return describe('Adding comments', function () {
      describe('standalone', function () {
        before(function (done) {
          this.project_id = DocUpdaterClient.randomId()
          this.user_id = DocUpdaterClient.randomId()
          this.doc = {
            id: DocUpdaterClient.randomId(),
            lines: ['foo bar baz'],
          }
          this.updates = [
            {
              doc: this.doc.id,
              op: [
                { c: 'bar', p: 4, t: (this.tid = DocUpdaterClient.randomId()) },
              ],
              v: 0,
            },
          ]
          MockWebApi.insertDoc(this.project_id, this.doc.id, {
            lines: this.doc.lines,
            version: 0,
          })
          const jobs = []
          for (const update of Array.from(this.updates)) {
            ;(update => {
              return jobs.push(callback =>
                DocUpdaterClient.sendUpdate(
                  this.project_id,
                  this.doc.id,
                  update,
                  callback
                )
              )
            })(update)
          }
          return DocUpdaterClient.preloadDoc(
            this.project_id,
            this.doc.id,
            error => {
              if (error != null) {
                throw error
              }
              return async.series(jobs, error => {
                if (error != null) {
                  throw error
                }
                return setTimeout(done, 200)
              })
            }
          )
        })

        return it('should update the ranges', function (done) {
          return DocUpdaterClient.getDoc(
            this.project_id,
            this.doc.id,
            (error, res, data) => {
              if (error != null) {
                throw error
              }
              const { ranges } = data
              const comment = ranges.comments[0]
              comment.op.should.deep.equal({ c: 'bar', p: 4, t: this.tid })
              comment.id.should.equal(this.tid)
              return done()
            }
          )
        })
      })

      return describe('with conflicting ops needing OT', function () {
        before(function (done) {
          this.project_id = DocUpdaterClient.randomId()
          this.user_id = DocUpdaterClient.randomId()
          this.doc = {
            id: DocUpdaterClient.randomId(),
            lines: ['foo bar baz'],
          }
          this.updates = [
            {
              doc: this.doc.id,
              op: [{ i: 'ABC', p: 3 }],
              v: 0,
              meta: { user_id: this.user_id },
            },
            {
              doc: this.doc.id,
              op: [
                { c: 'bar', p: 4, t: (this.tid = DocUpdaterClient.randomId()) },
              ],
              v: 0,
            },
          ]
          MockWebApi.insertDoc(this.project_id, this.doc.id, {
            lines: this.doc.lines,
            version: 0,
          })
          const jobs = []
          for (const update of Array.from(this.updates)) {
            ;(update => {
              return jobs.push(callback =>
                DocUpdaterClient.sendUpdate(
                  this.project_id,
                  this.doc.id,
                  update,
                  callback
                )
              )
            })(update)
          }
          return DocUpdaterClient.preloadDoc(
            this.project_id,
            this.doc.id,
            error => {
              if (error != null) {
                throw error
              }
              return async.series(jobs, error => {
                if (error != null) {
                  throw error
                }
                return setTimeout(done, 200)
              })
            }
          )
        })

        return it('should update the comments with the OT shifted comment', function (done) {
          return DocUpdaterClient.getDoc(
            this.project_id,
            this.doc.id,
            (error, res, data) => {
              if (error != null) {
                throw error
              }
              const { ranges } = data
              const comment = ranges.comments[0]
              comment.op.should.deep.equal({ c: 'bar', p: 7, t: this.tid })
              return done()
            }
          )
        })
      })
    })
  })

  describe('Loading ranges from persistence layer', function () {
    before(function (done) {
      this.project_id = DocUpdaterClient.randomId()
      this.user_id = DocUpdaterClient.randomId()
      this.id_seed = '587357bd35e64f6157'
      this.doc = {
        id: DocUpdaterClient.randomId(),
        lines: ['a123aa'],
      }
      this.update = {
        doc: this.doc.id,
        op: [{ i: '456', p: 5 }],
        v: 0,
        meta: { user_id: this.user_id, tc: this.id_seed },
      }
      MockWebApi.insertDoc(this.project_id, this.doc.id, {
        lines: this.doc.lines,
        version: 0,
        ranges: {
          changes: [
            {
              op: { i: '123', p: 1 },
              metadata: {
                user_id: this.user_id,
                ts: new Date(),
              },
            },
          ],
        },
      })
      return DocUpdaterClient.preloadDoc(
        this.project_id,
        this.doc.id,
        error => {
          if (error != null) {
            throw error
          }
          return DocUpdaterClient.sendUpdate(
            this.project_id,
            this.doc.id,
            this.update,
            error => {
              if (error != null) {
                throw error
              }
              return setTimeout(done, 200)
            }
          )
        }
      )
    })

    it('should have preloaded the existing ranges', function (done) {
      return DocUpdaterClient.getDoc(
        this.project_id,
        this.doc.id,
        (error, res, data) => {
          if (error != null) {
            throw error
          }
          const { changes } = data.ranges
          changes[0].op.should.deep.equal({ i: '123', p: 1 })
          changes[1].op.should.deep.equal({ i: '456', p: 5 })
          return done()
        }
      )
    })

    return it('should flush the ranges to the persistence layer again', function (done) {
      return DocUpdaterClient.flushDoc(this.project_id, this.doc.id, error => {
        if (error != null) {
          throw error
        }
        return MockWebApi.getDocument(
          this.project_id,
          this.doc.id,
          (error, doc) => {
            const { changes } = doc.ranges
            changes[0].op.should.deep.equal({ i: '123', p: 1 })
            changes[1].op.should.deep.equal({ i: '456', p: 5 })
            return done()
          }
        )
      })
    })
  })

  describe('accepting a change', function () {
    before(function (done) {
      this.project_id = DocUpdaterClient.randomId()
      this.user_id = DocUpdaterClient.randomId()
      this.id_seed = '587357bd35e64f6157'
      this.doc = {
        id: DocUpdaterClient.randomId(),
        lines: ['aaa'],
      }
      this.update = {
        doc: this.doc.id,
        op: [{ i: '456', p: 1 }],
        v: 0,
        meta: { user_id: this.user_id, tc: this.id_seed },
      }
      MockWebApi.insertDoc(this.project_id, this.doc.id, {
        lines: this.doc.lines,
        version: 0,
      })
      return DocUpdaterClient.preloadDoc(
        this.project_id,
        this.doc.id,
        error => {
          if (error != null) {
            throw error
          }
          return DocUpdaterClient.sendUpdate(
            this.project_id,
            this.doc.id,
            this.update,
            error => {
              if (error != null) {
                throw error
              }
              return setTimeout(() => {
                return DocUpdaterClient.getDoc(
                  this.project_id,
                  this.doc.id,
                  (error, res, data) => {
                    if (error != null) {
                      throw error
                    }
                    const { ranges } = data
                    const change = ranges.changes[0]
                    change.op.should.deep.equal({ i: '456', p: 1 })
                    change.id.should.equal(this.id_seed + '000001')
                    change.metadata.user_id.should.equal(this.user_id)
                    return done()
                  }
                )
              }, 200)
            }
          )
        }
      )
    })

    return it('should remove the change after accepting', function (done) {
      return DocUpdaterClient.acceptChange(
        this.project_id,
        this.doc.id,
        this.id_seed + '000001',
        error => {
          if (error != null) {
            throw error
          }
          return DocUpdaterClient.getDoc(
            this.project_id,
            this.doc.id,
            (error, res, data) => {
              if (error != null) {
                throw error
              }
              expect(data.ranges.changes).to.be.undefined
              return done()
            }
          )
        }
      )
    })
  })

  describe('deleting a comment range', function () {
    before(function (done) {
      this.project_id = DocUpdaterClient.randomId()
      this.user_id = DocUpdaterClient.randomId()
      this.doc = {
        id: DocUpdaterClient.randomId(),
        lines: ['foo bar'],
      }
      this.update = {
        doc: this.doc.id,
        op: [{ c: 'bar', p: 4, t: (this.tid = DocUpdaterClient.randomId()) }],
        v: 0,
      }
      MockWebApi.insertDoc(this.project_id, this.doc.id, {
        lines: this.doc.lines,
        version: 0,
      })
      return DocUpdaterClient.preloadDoc(
        this.project_id,
        this.doc.id,
        error => {
          if (error != null) {
            throw error
          }
          return DocUpdaterClient.sendUpdate(
            this.project_id,
            this.doc.id,
            this.update,
            error => {
              if (error != null) {
                throw error
              }
              return setTimeout(() => {
                return DocUpdaterClient.getDoc(
                  this.project_id,
                  this.doc.id,
                  (error, res, data) => {
                    if (error != null) {
                      throw error
                    }
                    const { ranges } = data
                    const change = ranges.comments[0]
                    change.op.should.deep.equal({ c: 'bar', p: 4, t: this.tid })
                    change.id.should.equal(this.tid)
                    return done()
                  }
                )
              }, 200)
            }
          )
        }
      )
    })

    return it('should remove the comment range', function (done) {
      return DocUpdaterClient.removeComment(
        this.project_id,
        this.doc.id,
        this.tid,
        (error, res) => {
          if (error != null) {
            throw error
          }
          expect(res.statusCode).to.equal(204)
          return DocUpdaterClient.getDoc(
            this.project_id,
            this.doc.id,
            (error, res, data) => {
              if (error != null) {
                throw error
              }
              expect(data.ranges.comments).to.be.undefined
              return done()
            }
          )
        }
      )
    })
  })

  describe('tripping range size limit', function () {
    before(function (done) {
      this.project_id = DocUpdaterClient.randomId()
      this.user_id = DocUpdaterClient.randomId()
      this.id_seed = DocUpdaterClient.randomId()
      this.doc = {
        id: DocUpdaterClient.randomId(),
        lines: ['aaa'],
      }
      this.i = new Array(3 * 1024 * 1024).join('a')
      this.updates = [
        {
          doc: this.doc.id,
          op: [{ i: this.i, p: 1 }],
          v: 0,
          meta: { user_id: this.user_id, tc: this.id_seed },
        },
      ]
      MockWebApi.insertDoc(this.project_id, this.doc.id, {
        lines: this.doc.lines,
        version: 0,
      })
      const jobs = []
      for (const update of Array.from(this.updates)) {
        ;(update => {
          return jobs.push(callback =>
            DocUpdaterClient.sendUpdate(
              this.project_id,
              this.doc.id,
              update,
              callback
            )
          )
        })(update)
      }
      return DocUpdaterClient.preloadDoc(
        this.project_id,
        this.doc.id,
        error => {
          if (error != null) {
            throw error
          }
          return async.series(jobs, error => {
            if (error != null) {
              throw error
            }
            return setTimeout(done, 200)
          })
        }
      )
    })

    return it('should not update the ranges', function (done) {
      return DocUpdaterClient.getDoc(
        this.project_id,
        this.doc.id,
        (error, res, data) => {
          if (error != null) {
            throw error
          }
          const { ranges } = data
          expect(ranges.changes).to.be.undefined
          return done()
        }
      )
    })
  })

  return describe('deleting text surrounding a comment', function () {
    before(function (done) {
      this.project_id = DocUpdaterClient.randomId()
      this.user_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: ['foo bar baz'],
        version: 0,
        ranges: {
          comments: [
            {
              op: {
                c: 'a',
                p: 5,
                tid: (this.tid = DocUpdaterClient.randomId()),
              },
              metadata: {
                user_id: this.user_id,
                ts: new Date(),
              },
            },
          ],
        },
      })
      this.updates = [
        {
          doc: this.doc_id,
          op: [{ d: 'foo ', p: 0 }],
          v: 0,
          meta: { user_id: this.user_id },
        },
        {
          doc: this.doc_id,
          op: [{ d: 'bar ', p: 0 }],
          v: 1,
          meta: { user_id: this.user_id },
        },
      ]
      const jobs = []
      for (const update of Array.from(this.updates)) {
        ;(update => {
          return jobs.push(callback =>
            DocUpdaterClient.sendUpdate(
              this.project_id,
              this.doc_id,
              update,
              callback
            )
          )
        })(update)
      }
      return DocUpdaterClient.preloadDoc(
        this.project_id,
        this.doc_id,
        error => {
          if (error != null) {
            throw error
          }
          return async.series(jobs, function (error) {
            if (error != null) {
              throw error
            }
            return setTimeout(() => {
              return DocUpdaterClient.getDoc(
                this.project_id,
                this.doc_id,
                (error, res, data) => {
                  if (error != null) {
                    throw error
                  }
                  return done()
                }
              )
            }, 200)
          })
        }
      )
    })

    return it('should write a snapshot from before the destructive change', function (done) {
      return DocUpdaterClient.getDoc(
        this.project_id,
        this.doc_id,
        (error, res, data) => {
          if (error != null) {
            return done(error)
          }
          db.docSnapshots
            .find({
              project_id: ObjectId(this.project_id),
              doc_id: ObjectId(this.doc_id),
            })
            .toArray((error, docSnapshots) => {
              if (error != null) {
                return done(error)
              }
              expect(docSnapshots.length).to.equal(1)
              expect(docSnapshots[0].version).to.equal(1)
              expect(docSnapshots[0].lines).to.deep.equal(['bar baz'])
              expect(docSnapshots[0].ranges.comments[0].op).to.deep.equal({
                c: 'a',
                p: 1,
                tid: this.tid,
              })
              return done()
            })
        }
      )
    })
  })
})
