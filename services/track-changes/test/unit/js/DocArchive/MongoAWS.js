/* eslint-disable
    handle-callback-err,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const chai = require('chai')
chai.should()
const sinon = require('sinon')
const modulePath = '../../../../app/js/MongoAWS.js'
const SandboxedModule = require('sandboxed-module')
const { ObjectId } = require('mongojs')
const MemoryStream = require('memorystream')
const zlib = require('zlib')

describe('MongoAWS', function () {
  beforeEach(function () {
    this.MongoAWS = SandboxedModule.require(modulePath, {
      singleOnly: true,
      requires: {
        'settings-sharelatex': (this.settings = {
          trackchanges: {
            s3: {
              secret: 's3-secret',
              key: 's3-key'
            },
            stores: {
              doc_history: 's3-bucket'
            }
          }
        }),
        child_process: (this.child_process = {}),
        'mongo-uri': (this.mongouri = {}),
        'logger-sharelatex': (this.logger = {
          log: sinon.stub(),
          error: sinon.stub(),
          err() {}
        }),
        'aws-sdk': (this.awssdk = {}),
        fs: (this.fs = {}),
        's3-streams': (this.S3S = {}),
        './mongojs': { db: (this.db = {}), ObjectId },
        JSONStream: (this.JSONStream = {}),
        'readline-stream': (this.readline = sinon.stub()),
        'metrics-sharelatex': { inc() {} }
      }
    })

    this.project_id = ObjectId().toString()
    this.doc_id = ObjectId().toString()
    this.pack_id = ObjectId()
    this.update = { v: 123 }
    return (this.callback = sinon.stub())
  })

  describe('archivePack', function () {
    beforeEach(function (done) {
      this.awssdk.config = { update: sinon.stub() }
      this.awssdk.S3 = sinon.stub()
      this.S3S.WriteStream = () => MemoryStream.createWriteStream()
      this.db.docHistory = {}
      this.db.docHistory.findOne = sinon
        .stub()
        .callsArgWith(1, null, { pack: 'hello' })

      return this.MongoAWS.archivePack(
        this.project_id,
        this.doc_id,
        this.pack_id,
        (err, result) => {
          this.callback()
          return done()
        }
      )
    })

    return it('should call the callback', function () {
      return this.callback.called.should.equal(true)
    })
  })

  return describe('unArchivePack', function () {
    beforeEach(function (done) {
      return zlib.gzip('{"pack":"123"}', (err, zbuf) => {
        this.awssdk.config = { update: sinon.stub() }
        this.awssdk.S3 = sinon.stub()
        this.S3S.ReadStream = () =>
          MemoryStream.createReadStream(zbuf, { readable: true })
        this.db.docHistory = {}
        this.db.docHistory.insert = sinon.stub().callsArgWith(1, null, 'pack')

        return this.MongoAWS.unArchivePack(
          this.project_id,
          this.doc_id,
          this.pack_id,
          (err, result) => {
            this.callback()
            return done()
          }
        )
      })
    })

    return it('should call db.docHistory.insert', function () {
      return this.db.docHistory.insert.called.should.equal(true)
    })
  })
})
