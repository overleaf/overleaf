/* eslint-disable
    n/handle-callback-err,
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
const { expect } = require('chai')
const modulePath = '../../../../app/src/Features/Compile/ClsiStateManager.js'
const SandboxedModule = require('sandboxed-module')

describe('ClsiStateManager', function () {
  beforeEach(function () {
    this.ClsiStateManager = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': (this.settings = {}),
        '../Project/ProjectEntityHandler': (this.ProjectEntityHandler = {}),
      },
    })
    this.project = 'project'
    this.options = { draft: true, isAutoCompile: false }
    return (this.callback = sinon.stub())
  })

  describe('computeHash', function () {
    beforeEach(function () {
      this.docs = [
        { path: '/main.tex', doc: { _id: 'doc-id-1' } },
        { path: '/folder/sub.tex', doc: { _id: 'doc-id-2' } },
      ]
      this.files = [
        {
          path: '/figure.pdf',
          file: { _id: 'file-id-1', rev: 123, created: 'aaaaaa' },
        },
        {
          path: '/folder/fig2.pdf',
          file: { _id: 'file-id-2', rev: 456, created: 'bbbbbb' },
        },
      ]
      this.ProjectEntityHandler.getAllEntitiesFromProject = sinon
        .stub()
        .returns({ docs: this.docs, files: this.files })
      this.hash0 = this.ClsiStateManager.computeHash(this.project, this.options)
    })

    describe('with a sample project', function () {
      beforeEach(function () {})

      it('should return a hash value', function () {
        expect(
          this.ClsiStateManager.computeHash(this.project, this.options)
        ).to.equal('21b1ab73aa3892bec452baf8ffa0956179e1880f')
      })
    })

    describe('when the files and docs are in a different order', function () {
      beforeEach(function () {
        ;[this.docs[0], this.docs[1]] = Array.from([this.docs[1], this.docs[0]])
        ;[this.files[0], this.files[1]] = Array.from([
          this.files[1],
          this.files[0],
        ])
      })

      it('should return the same hash value', function () {
        expect(
          this.ClsiStateManager.computeHash(this.project, this.options)
        ).to.equal(this.hash0)
      })
    })

    describe('when a doc is renamed', function () {
      beforeEach(function () {
        this.docs[0].path = '/new.tex'
      })

      it('should return a different hash value', function () {
        expect(
          this.ClsiStateManager.computeHash(this.project, this.options)
        ).not.to.equal(this.hash0)
      })
    })

    describe('when a file is renamed', function () {
      beforeEach(function () {
        this.files[0].path = '/newfigure.pdf'
      })

      it('should return a different hash value', function () {
        expect(
          this.ClsiStateManager.computeHash(this.project, this.options)
        ).not.to.equal(this.hash0)
      })
    })

    describe('when a doc is added', function () {
      beforeEach(function () {
        this.docs.push({ path: '/newdoc.tex', doc: { _id: 'newdoc-id' } })
      })

      it('should return a different hash value', function () {
        expect(
          this.ClsiStateManager.computeHash(this.project, this.options)
        ).not.to.equal(this.hash0)
      })
    })

    describe('when a file is added', function () {
      beforeEach(function () {
        this.files.push({
          path: '/newfile.tex',
          file: { _id: 'newfile-id', rev: 123 },
        })
      })

      it('should return a different hash value', function () {
        expect(
          this.ClsiStateManager.computeHash(this.project, this.options)
        ).not.to.equal(this.hash0)
      })
    })

    describe('when a doc is removed', function () {
      beforeEach(function () {
        this.docs.pop()
      })

      it('should return a different hash value', function () {
        expect(
          this.ClsiStateManager.computeHash(this.project, this.options)
        ).not.to.equal(this.hash0)
      })
    })

    describe('when a file is removed', function () {
      beforeEach(function () {
        this.files.pop()
      })

      it('should return a different hash value', function () {
        expect(
          this.ClsiStateManager.computeHash(this.project, this.options)
        ).not.to.equal(this.hash0)
      })
    })

    describe("when a file's revision is updated", function () {
      beforeEach(function () {
        this.files[0].file.rev++
      })

      it('should return a different hash value', function () {
        expect(
          this.ClsiStateManager.computeHash(this.project, this.options)
        ).not.to.equal(this.hash0)
      })
    })

    describe("when a file's date is updated", function () {
      beforeEach(function () {
        this.files[0].file.created = 'zzzzzz'
      })

      it('should return a different hash value', function () {
        expect(
          this.ClsiStateManager.computeHash(this.project, this.options)
        ).not.to.equal(this.hash0)
      })
    })

    describe('when the compile options are changed', function () {
      beforeEach(function () {
        this.options.draft = !this.options.draft
      })

      it('should return a different hash value', function () {
        expect(
          this.ClsiStateManager.computeHash(this.project, this.options)
        ).not.to.equal(this.hash0)
      })
    })

    describe('when the isAutoCompile option is changed', function () {
      beforeEach(function () {
        this.options.isAutoCompile = !this.options.isAutoCompile
      })

      it('should return the same hash value', function () {
        expect(
          this.ClsiStateManager.computeHash(this.project, this.options)
        ).to.equal(this.hash0)
      })
    })
  })
})
