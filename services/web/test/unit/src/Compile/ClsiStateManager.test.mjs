import { vi, expect } from 'vitest'
import sinon from 'sinon'

const modulePath = '../../../../app/src/Features/Compile/ClsiStateManager.mjs'

describe('ClsiStateManager', function () {
  beforeEach(async function (ctx) {
    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.settings = {}),
    }))

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectEntityHandler',
      () => ({
        default: (ctx.ProjectEntityHandler = {}),
      })
    )

    ctx.ClsiStateManager = (await import(modulePath)).default
    ctx.project = 'project'
    ctx.options = {
      draft: true,
      isAutoCompile: false,
      buildId: 'original-build-id',
    }
    ctx.callback = sinon.stub()
  })

  describe('computeHash', function () {
    beforeEach(function (ctx) {
      ctx.docs = [
        { path: '/main.tex', doc: { _id: 'doc-id-1' } },
        { path: '/folder/sub.tex', doc: { _id: 'doc-id-2' } },
      ]
      ctx.files = [
        {
          path: '/figure.pdf',
          file: { _id: 'file-id-1', rev: 123, created: 'aaaaaa' },
        },
        {
          path: '/folder/fig2.pdf',
          file: { _id: 'file-id-2', rev: 456, created: 'bbbbbb' },
        },
      ]
      ctx.ProjectEntityHandler.getAllEntitiesFromProject = sinon
        .stub()
        .returns({ docs: ctx.docs, files: ctx.files })
      ctx.hash0 = ctx.ClsiStateManager.computeHash(ctx.project, ctx.options)
    })

    describe('with a sample project', function () {
      beforeEach(function () {})

      it('should return a hash value', function (ctx) {
        expect(
          ctx.ClsiStateManager.computeHash(ctx.project, ctx.options)
        ).to.equal('21b1ab73aa3892bec452baf8ffa0956179e1880f')
      })
    })

    describe('when the files and docs are in a different order', function () {
      beforeEach(function (ctx) {
        ;[ctx.docs[0], ctx.docs[1]] = [ctx.docs[1], ctx.docs[0]]
        ;[ctx.files[0], ctx.files[1]] = [ctx.files[1], ctx.files[0]]
      })

      it('should return the same hash value', function (ctx) {
        expect(
          ctx.ClsiStateManager.computeHash(ctx.project, ctx.options)
        ).to.equal(ctx.hash0)
      })
    })

    describe('when a doc is renamed', function () {
      beforeEach(function (ctx) {
        ctx.docs[0].path = '/new.tex'
      })

      it('should return a different hash value', function (ctx) {
        expect(
          ctx.ClsiStateManager.computeHash(ctx.project, ctx.options)
        ).not.to.equal(ctx.hash0)
      })
    })

    describe('when a file is renamed', function () {
      beforeEach(function (ctx) {
        ctx.files[0].path = '/newfigure.pdf'
      })

      it('should return a different hash value', function (ctx) {
        expect(
          ctx.ClsiStateManager.computeHash(ctx.project, ctx.options)
        ).not.to.equal(ctx.hash0)
      })
    })

    describe('when a doc is added', function () {
      beforeEach(function (ctx) {
        ctx.docs.push({ path: '/newdoc.tex', doc: { _id: 'newdoc-id' } })
      })

      it('should return a different hash value', function (ctx) {
        expect(
          ctx.ClsiStateManager.computeHash(ctx.project, ctx.options)
        ).not.to.equal(ctx.hash0)
      })
    })

    describe('when a file is added', function () {
      beforeEach(function (ctx) {
        ctx.files.push({
          path: '/newfile.tex',
          file: { _id: 'newfile-id', rev: 123 },
        })
      })

      it('should return a different hash value', function (ctx) {
        expect(
          ctx.ClsiStateManager.computeHash(ctx.project, ctx.options)
        ).not.to.equal(ctx.hash0)
      })
    })

    describe('when a doc is removed', function () {
      beforeEach(function (ctx) {
        ctx.docs.pop()
      })

      it('should return a different hash value', function (ctx) {
        expect(
          ctx.ClsiStateManager.computeHash(ctx.project, ctx.options)
        ).not.to.equal(ctx.hash0)
      })
    })

    describe('when a file is removed', function () {
      beforeEach(function (ctx) {
        ctx.files.pop()
      })

      it('should return a different hash value', function (ctx) {
        expect(
          ctx.ClsiStateManager.computeHash(ctx.project, ctx.options)
        ).not.to.equal(ctx.hash0)
      })
    })

    describe("when a file's revision is updated", function () {
      beforeEach(function (ctx) {
        ctx.files[0].file.rev++
      })

      it('should return a different hash value', function (ctx) {
        expect(
          ctx.ClsiStateManager.computeHash(ctx.project, ctx.options)
        ).not.to.equal(ctx.hash0)
      })
    })

    describe("when a file's date is updated", function () {
      beforeEach(function (ctx) {
        ctx.files[0].file.created = 'zzzzzz'
      })

      it('should return a different hash value', function (ctx) {
        expect(
          ctx.ClsiStateManager.computeHash(ctx.project, ctx.options)
        ).not.to.equal(ctx.hash0)
      })
    })

    describe('when the compile options are changed', function () {
      beforeEach(function (ctx) {
        ctx.options.draft = !ctx.options.draft
      })

      it('should return a different hash value', function (ctx) {
        expect(
          ctx.ClsiStateManager.computeHash(ctx.project, ctx.options)
        ).not.to.equal(ctx.hash0)
      })
    })

    describe('when the isAutoCompile option is changed', function () {
      beforeEach(function (ctx) {
        ctx.options.isAutoCompile = !ctx.options.isAutoCompile
      })

      it('should return the same hash value', function (ctx) {
        expect(
          ctx.ClsiStateManager.computeHash(ctx.project, ctx.options)
        ).to.equal(ctx.hash0)
      })
    })

    describe('when the buildId option is changed', function () {
      beforeEach(function (ctx) {
        ctx.options.buildId = 'new-build-id'
      })

      it('should return the same hash value', function (ctx) {
        expect(
          ctx.ClsiStateManager.computeHash(ctx.project, ctx.options)
        ).to.equal(ctx.hash0)
      })
    })
  })
})
