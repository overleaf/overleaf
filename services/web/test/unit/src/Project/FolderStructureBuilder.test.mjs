import { vi, expect } from 'vitest'
import mongodb from 'mongodb-legacy'
import sinon from 'sinon'

const { ObjectId } = mongodb

const MODULE_PATH =
  '../../../../app/src/Features/Project/FolderStructureBuilder'

describe('FolderStructureBuilder', function () {
  beforeEach(async function (ctx) {
    vi.doMock('mongodb-legacy', () => ({
      default: { ObjectId },
    }))

    ctx.FolderStructureBuilder = (await import(MODULE_PATH)).default
  })

  describe('buildFolderStructure', function () {
    describe('when given no documents at all', function () {
      beforeEach(function (ctx) {
        ctx.result = ctx.FolderStructureBuilder.buildFolderStructure([], [])
      })

      it('returns an empty root folder', function (ctx) {
        sinon.assert.match(ctx.result, {
          _id: sinon.match.instanceOf(ObjectId),
          name: 'rootFolder',
          folders: [],
          docs: [],
          fileRefs: [],
        })
      })
    })

    describe('when given documents and files', function () {
      beforeEach(function (ctx) {
        const docUploads = [
          { path: '/main.tex', doc: { _id: 'doc-1', name: 'main.tex' } },
          { path: '/foo/other.tex', doc: { _id: 'doc-2', name: 'other.tex' } },
          { path: '/foo/other.bib', doc: { _id: 'doc-3', name: 'other.bib' } },
          {
            path: '/foo/foo1/foo2/another.tex',
            doc: { _id: 'doc-4', name: 'another.tex' },
          },
        ]
        const fileUploads = [
          { path: '/aaa.jpg', file: { _id: 'file-1', name: 'aaa.jpg' } },
          { path: '/foo/bbb.jpg', file: { _id: 'file-2', name: 'bbb.jpg' } },
          { path: '/bar/ccc.jpg', file: { _id: 'file-3', name: 'ccc.jpg' } },
        ]
        ctx.result = ctx.FolderStructureBuilder.buildFolderStructure(
          docUploads,
          fileUploads
        )
      })

      it('returns a full folder structure', function (ctx) {
        sinon.assert.match(ctx.result, {
          _id: sinon.match.instanceOf(ObjectId),
          name: 'rootFolder',
          docs: [{ _id: 'doc-1', name: 'main.tex' }],
          fileRefs: [{ _id: 'file-1', name: 'aaa.jpg' }],
          folders: [
            {
              _id: sinon.match.instanceOf(ObjectId),
              name: 'foo',
              docs: [
                { _id: 'doc-2', name: 'other.tex' },
                { _id: 'doc-3', name: 'other.bib' },
              ],
              fileRefs: [{ _id: 'file-2', name: 'bbb.jpg' }],
              folders: [
                {
                  _id: sinon.match.instanceOf(ObjectId),
                  name: 'foo1',
                  docs: [],
                  fileRefs: [],
                  folders: [
                    {
                      _id: sinon.match.instanceOf(ObjectId),
                      name: 'foo2',
                      docs: [{ _id: 'doc-4', name: 'another.tex' }],
                      fileRefs: [],
                      folders: [],
                    },
                  ],
                },
              ],
            },
            {
              _id: sinon.match.instanceOf(ObjectId),
              name: 'bar',
              docs: [],
              fileRefs: [{ _id: 'file-3', name: 'ccc.jpg' }],
              folders: [],
            },
          ],
        })
      })
    })

    describe('when given duplicate files', function () {
      it('throws an error', function (ctx) {
        const docUploads = [
          { path: '/foo/doc.tex', doc: { _id: 'doc-1', name: 'doc.tex' } },
          { path: '/foo/doc.tex', doc: { _id: 'doc-2', name: 'doc.tex' } },
        ]
        expect(() =>
          ctx.FolderStructureBuilder.buildFolderStructure(docUploads, [])
        ).to.throw()
      })
    })
  })
})
