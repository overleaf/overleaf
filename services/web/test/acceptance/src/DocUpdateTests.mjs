import User from './helpers/User.mjs'
import request from './helpers/request.js'
import { expect } from 'chai'
import settings from '@overleaf/settings'
import mongodb from 'mongodb-legacy'

const ObjectId = mongodb.ObjectId

describe('DocUpdate', function () {
  beforeEach(function (done) {
    this.user = new User()
    this.projectName = 'wombat'
    this.user.ensureUserExists(() => {
      this.user.login(() => {
        this.user.createProject(this.projectName, (error, projectId) => {
          if (error) return done(error)
          this.projectId = projectId

          this.user.getProject(this.projectId, (error, project) => {
            if (error) return done(error)
            this.project = project
            this.user.createDocInProject(
              this.projectId,
              this.project.rootFolder[0]._id,
              'potato',
              (error, docId) => {
                this.docId = docId
                done(error)
              }
            )
          })
        })
      })
    })
  })

  function writeContent(
    { projectId, docId, lines, version, ranges, lastUpdatedAt, lastUpdatedBy },
    callback
  ) {
    request(
      {
        method: 'POST',
        url: `/project/${projectId}/doc/${docId}`,
        auth: {
          user: settings.apis.web.user,
          pass: settings.apis.web.pass,
          sendImmediately: true,
        },
        json: { lines, version, ranges, lastUpdatedAt, lastUpdatedBy },
      },
      (error, res) => {
        if (error) return callback(error)
        if (res.statusCode !== 200)
          return callback(
            new Error(`non-success statusCode: ${res.statusCode}`)
          )
        callback()
      }
    )
  }

  function updateContent(options, callback) {
    writeContent(options, err => {
      if (err) return callback(err)

      options.lines.push('foo')
      options.version++
      writeContent(options, callback)
    })
  }

  function writeContentTwice(options, callback) {
    writeContent(options, err => {
      if (err) return callback(err)

      writeContent(options, callback)
    })
  }

  let writeOptions
  beforeEach(function () {
    writeOptions = {
      projectId: this.projectId,
      docId: this.docId,
      lines: ['a'],
      version: 1,
      ranges: {},
      lastUpdatedAt: new Date(),
      lastUpdatedBy: this.user.id,
    }
  })

  function shouldAcceptChanges() {
    it('should accept writes', function (done) {
      writeContent(writeOptions, done)
    })

    it('should accept updates', function (done) {
      updateContent(writeOptions, done)
    })

    it('should accept same write twice', function (done) {
      writeContentTwice(writeOptions, done)
    })
  }

  function shouldBlockChanges() {
    it('should block writes', function (done) {
      writeContent(writeOptions, err => {
        expect(err).to.exist
        expect(err.message).to.equal('non-success statusCode: 404')
        done()
      })
    })

    it('should block updates', function (done) {
      updateContent(writeOptions, err => {
        expect(err).to.exist
        expect(err.message).to.equal('non-success statusCode: 404')
        done()
      })
    })
  }

  describe('a regular doc', function () {
    shouldAcceptChanges()
  })

  describe('after deleting the doc', function () {
    beforeEach(function (done) {
      this.user.deleteItemInProject(this.projectId, 'doc', this.docId, done)
    })

    shouldAcceptChanges()
  })

  describe('unknown doc', function () {
    beforeEach(function () {
      writeOptions.docId = new ObjectId()
    })

    shouldBlockChanges()
  })

  describe('doc in another project', function () {
    beforeEach(function (done) {
      this.user.createProject('foo', (error, projectId) => {
        if (error) return done(error)
        writeOptions.projectId = projectId
        done()
      })
    })

    shouldBlockChanges()
  })
})
