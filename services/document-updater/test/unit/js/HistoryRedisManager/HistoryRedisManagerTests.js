/* eslint-disable
    camelcase,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const modulePath = '../../../../app/js/HistoryRedisManager.js'
const SandboxedModule = require('sandboxed-module')
const Errors = require('../../../../app/js/Errors')

describe('HistoryRedisManager', function () {
  beforeEach(function () {
    this.rclient = {
      auth() {},
      exec: sinon.stub(),
    }
    this.rclient.multi = () => this.rclient
    this.HistoryRedisManager = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/redis-wrapper': { createClient: () => this.rclient },
        '@overleaf/settings': {
          redis: {
            history: (this.settings = {
              key_schema: {
                uncompressedHistoryOps({ doc_id }) {
                  return `UncompressedHistoryOps:${doc_id}`
                },
                docsWithHistoryOps({ project_id }) {
                  return `DocsWithHistoryOps:${project_id}`
                },
              },
            }),
          },
        },
      },
    })
    this.doc_id = 'doc-id-123'
    this.project_id = 'project-id-123'
    return (this.callback = sinon.stub())
  })

  return describe('recordDocHasHistoryOps', function () {
    beforeEach(function () {
      this.ops = [{ op: [{ i: 'foo', p: 4 }] }, { op: [{ i: 'bar', p: 56 }] }]
      return (this.rclient.sadd = sinon.stub().yields())
    })

    describe('with ops', function () {
      beforeEach(function (done) {
        return this.HistoryRedisManager.recordDocHasHistoryOps(
          this.project_id,
          this.doc_id,
          this.ops,
          (...args) => {
            this.callback(...Array.from(args || []))
            return done()
          }
        )
      })

      return it('should add the doc_id to the set of which records the project docs', function () {
        return this.rclient.sadd
          .calledWith(`DocsWithHistoryOps:${this.project_id}`, this.doc_id)
          .should.equal(true)
      })
    })

    return describe('with no ops', function () {
      beforeEach(function (done) {
        return this.HistoryRedisManager.recordDocHasHistoryOps(
          this.project_id,
          this.doc_id,
          [],
          (...args) => {
            this.callback(...Array.from(args || []))
            return done()
          }
        )
      })

      it('should not add the doc_id to the set of which records the project docs', function () {
        return this.rclient.sadd.called.should.equal(false)
      })

      return it('should call the callback with an error', function () {
        return this.callback
          .calledWith(sinon.match.instanceOf(Error))
          .should.equal(true)
      })
    })
  })
})
