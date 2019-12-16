/* eslint-disable
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { assert } = require('chai')
const sinon = require('sinon')
const chai = require('chai')
const should = chai.should()
const { expect } = chai
const modulePath = '../../../app/js/BucketController.js'
const SandboxedModule = require('sandboxed-module')

describe('BucketController', function() {
  beforeEach(function() {
    this.PersistorManager = {
      sendStream: sinon.stub(),
      copyFile: sinon.stub(),
      deleteFile: sinon.stub()
    }

    this.settings = {
      s3: {
        buckets: {
          user_files: 'user_files'
        }
      },
      filestore: {
        backend: 's3',
        s3: {
          secret: 'secret',
          key: 'this_key'
        }
      }
    }

    this.FileHandler = {
      getFile: sinon.stub(),
      deleteFile: sinon.stub(),
      insertFile: sinon.stub(),
      getDirectorySize: sinon.stub()
    }
    this.LocalFileWriter = {}
    this.controller = SandboxedModule.require(modulePath, {
      requires: {
        './LocalFileWriter': this.LocalFileWriter,
        './FileHandler': this.FileHandler,
        './PersistorManager': this.PersistorManager,
        'settings-sharelatex': this.settings,
        'metrics-sharelatex': {
          inc() {}
        },
        'logger-sharelatex': {
          log() {},
          err() {}
        }
      }
    })
    this.project_id = 'project_id'
    this.file_id = 'file_id'
    this.bucket = 'user_files'
    this.key = `${this.project_id}/${this.file_id}`
    this.req = {
      query: {},
      params: {
        bucket: this.bucket,
        0: this.key
      },
      headers: {}
    }
    this.res = { setHeader() {} }
    return (this.fileStream = {})
  })

  return describe('getFile', function() {
    it('should pipe the stream', function(done) {
      this.FileHandler.getFile.callsArgWith(3, null, this.fileStream)
      this.fileStream.pipe = res => {
        res.should.equal(this.res)
        return done()
      }
      return this.controller.getFile(this.req, this.res)
    })

    return it('should send a 500 if there is a problem', function(done) {
      this.FileHandler.getFile.callsArgWith(3, 'error')
      this.res.send = code => {
        code.should.equal(500)
        return done()
      }
      return this.controller.getFile(this.req, this.res)
    })
  })
})
