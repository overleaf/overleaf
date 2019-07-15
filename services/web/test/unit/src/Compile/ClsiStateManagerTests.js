/* eslint-disable
    handle-callback-err,
    max-len,
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
const chai = require('chai')
const should = chai.should()
const { expect } = chai
const modulePath = '../../../../app/src/Features/Compile/ClsiStateManager.js'
const SandboxedModule = require('sandboxed-module')

describe('ClsiStateManager', function() {
  beforeEach(function() {
    this.ClsiStateManager = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'settings-sharelatex': (this.settings = {}),
        '../Project/ProjectEntityHandler': (this.ProjectEntityHandler = {}),
        'logger-sharelatex': (this.logger = {
          log: sinon.stub(),
          error: sinon.stub(),
          warn: sinon.stub()
        })
      }
    })
    this.project = 'project'
    this.options = { draft: true, isAutoCompile: false }
    return (this.callback = sinon.stub())
  })

  describe('computeHash', function() {
    beforeEach(function(done) {
      this.docs = [
        { path: '/main.tex', doc: { _id: 'doc-id-1' } },
        { path: '/folder/sub.tex', doc: { _id: 'doc-id-2' } }
      ]
      this.files = [
        {
          path: '/figure.pdf',
          file: { _id: 'file-id-1', rev: 123, created: 'aaaaaa' }
        },
        {
          path: '/folder/fig2.pdf',
          file: { _id: 'file-id-2', rev: 456, created: 'bbbbbb' }
        }
      ]
      this.ProjectEntityHandler.getAllEntitiesFromProject = sinon
        .stub()
        .callsArgWith(1, null, this.docs, this.files)
      return this.ClsiStateManager.computeHash(
        this.project,
        this.options,
        (err, hash) => {
          this.hash0 = hash
          return done()
        }
      )
    })

    describe('with a sample project', function() {
      beforeEach(function() {
        return this.ClsiStateManager.computeHash(
          this.project,
          this.options,
          this.callback
        )
      })

      it('should call the callback with a hash value', function() {
        return this.callback
          .calledWith(null, '21b1ab73aa3892bec452baf8ffa0956179e1880f')
          .should.equal(true)
      })
    })

    describe('when the files and docs are in a different order', function() {
      beforeEach(function() {
        ;[this.docs[0], this.docs[1]] = Array.from([this.docs[1], this.docs[0]])
        ;[this.files[0], this.files[1]] = Array.from([
          this.files[1],
          this.files[0]
        ])
        return this.ClsiStateManager.computeHash(
          this.project,
          this.options,
          this.callback
        )
      })

      it('should call the callback with the same hash value', function() {
        return this.callback.calledWith(null, this.hash0).should.equal(true)
      })
    })

    describe('when a doc is renamed', function() {
      beforeEach(function(done) {
        this.docs[0].path = '/new.tex'
        return this.ClsiStateManager.computeHash(
          this.project,
          this.options,
          (err, hash) => {
            this.hash1 = hash
            return done()
          }
        )
      })

      it('should call the callback with a different hash value', function() {
        return this.callback
          .neverCalledWith(null, this.hash0)
          .should.equal(true)
      })
    })

    describe('when a file is renamed', function() {
      beforeEach(function(done) {
        this.files[0].path = '/newfigure.pdf'
        return this.ClsiStateManager.computeHash(
          this.project,
          this.options,
          (err, hash) => {
            this.hash1 = hash
            return done()
          }
        )
      })

      it('should call the callback with a different hash value', function() {
        return this.callback
          .neverCalledWith(null, this.hash0)
          .should.equal(true)
      })
    })

    describe('when a doc is added', function() {
      beforeEach(function(done) {
        this.docs.push({ path: '/newdoc.tex', doc: { _id: 'newdoc-id' } })
        return this.ClsiStateManager.computeHash(
          this.project,
          this.options,
          (err, hash) => {
            this.hash1 = hash
            return done()
          }
        )
      })

      it('should call the callback with a different hash value', function() {
        return this.callback
          .neverCalledWith(null, this.hash0)
          .should.equal(true)
      })
    })

    describe('when a file is added', function() {
      beforeEach(function(done) {
        this.files.push({
          path: '/newfile.tex',
          file: { _id: 'newfile-id', rev: 123 }
        })
        return this.ClsiStateManager.computeHash(
          this.project,
          this.options,
          (err, hash) => {
            this.hash1 = hash
            return done()
          }
        )
      })

      it('should call the callback with a different hash value', function() {
        return this.callback
          .neverCalledWith(null, this.hash0)
          .should.equal(true)
      })
    })

    describe('when a doc is removed', function() {
      beforeEach(function(done) {
        this.docs.pop()
        return this.ClsiStateManager.computeHash(
          this.project,
          this.options,
          (err, hash) => {
            this.hash1 = hash
            return done()
          }
        )
      })

      it('should call the callback with a different hash value', function() {
        return this.callback
          .neverCalledWith(null, this.hash0)
          .should.equal(true)
      })
    })

    describe('when a file is removed', function() {
      beforeEach(function(done) {
        this.files.pop()
        return this.ClsiStateManager.computeHash(
          this.project,
          this.options,
          (err, hash) => {
            this.hash1 = hash
            return done()
          }
        )
      })

      it('should call the callback with a different hash value', function() {
        return this.callback
          .neverCalledWith(null, this.hash0)
          .should.equal(true)
      })
    })

    describe("when a file's revision is updated", function() {
      beforeEach(function(done) {
        this.files[0].file.rev++
        return this.ClsiStateManager.computeHash(
          this.project,
          this.options,
          (err, hash) => {
            this.hash1 = hash
            return done()
          }
        )
      })

      it('should call the callback with a different hash value', function() {
        return this.callback
          .neverCalledWith(null, this.hash0)
          .should.equal(true)
      })
    })

    describe("when a file's date is updated", function() {
      beforeEach(function(done) {
        this.files[0].file.created = 'zzzzzz'
        return this.ClsiStateManager.computeHash(
          this.project,
          this.options,
          (err, hash) => {
            this.hash1 = hash
            return done()
          }
        )
      })

      it('should call the callback with a different hash value', function() {
        return this.callback
          .neverCalledWith(null, this.hash0)
          .should.equal(true)
      })
    })

    describe('when the compile options are changed', function() {
      beforeEach(function(done) {
        this.options.draft = !this.options.draft
        return this.ClsiStateManager.computeHash(
          this.project,
          this.options,
          (err, hash) => {
            this.hash1 = hash
            return done()
          }
        )
      })

      it('should call the callback with a different hash value', function() {
        return this.callback
          .neverCalledWith(null, this.hash0)
          .should.equal(true)
      })
    })

    describe('when the isAutoCompile option is changed', function() {
      beforeEach(function() {
        this.options.isAutoCompile = !this.options.isAutoCompile
        return this.ClsiStateManager.computeHash(
          this.project,
          this.options,
          this.callback
        )
      })

      it('should call the callback with the same hash value', function() {
        return this.callback.calledWith(null, this.hash0).should.equal(true)
      })
    })
  })
})
