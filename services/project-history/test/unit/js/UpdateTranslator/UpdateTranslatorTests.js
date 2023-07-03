import sinon from 'sinon'
import { expect } from 'chai'
import { strict as esmock } from 'esmock'
import Core from 'overleaf-editor-core'

const MODULE_PATH = '../../../../app/js/UpdateTranslator.js'

describe('UpdateTranslator', function () {
  beforeEach(async function () {
    this.UpdateTranslator = await esmock(MODULE_PATH, {
      'overleaf-editor-core': Core,
    })
    this.callback = sinon.stub()

    this.project_id = '59bfd450e3028c4d40a1e9aa'
    this.doc_id = '59bfd450e3028c4d40a1e9ab'
    this.file_id = '59bfd450e3028c4d40a1easd'
    this.user_id = '59bb9051abf6e8682a269b64'
    this.version = 0
    this.timestamp = new Date().toJSON()
    this.mockBlobHash = '12345abc12345abc12345abc12345abc12345abc'
  })

  describe('convertToChanges', function () {
    it('can translate doc additions', function (done) {
      const updates = [
        {
          update: {
            doc: this.doc_id,
            pathname: '/main.tex',
            docLines: 'a\nb',
            meta: {
              user_id: this.user_id,
              ts: this.timestamp,
            },
          },
          blobHash: this.mockBlobHash,
        },
      ]
      const assertion = (error, changes) => {
        changes = changes.map(change => change.toRaw())
        expect(error).to.be.null
        expect(changes).to.deep.equal([
          {
            authors: [],
            operations: [
              {
                pathname: 'main.tex',
                file: {
                  hash: this.mockBlobHash,
                },
              },
            ],
            v2Authors: [this.user_id],
            timestamp: this.timestamp,
          },
        ])
        done()
      }

      this.UpdateTranslator.convertToChanges(
        this.project_id,
        updates,
        assertion
      )
    })

    it('can translate file additions', function (done) {
      const updates = [
        {
          update: {
            file: this.file_id,
            pathname: '/test.png',
            url: 'filestore.example.com/test.png',
            meta: {
              user_id: this.user_id,
              ts: this.timestamp,
            },
          },
          blobHash: this.mockBlobHash,
        },
      ]
      const assertion = (error, changes) => {
        changes = changes.map(change => change.toRaw())
        expect(error).to.be.null
        expect(changes).to.deep.equal([
          {
            authors: [],
            operations: [
              {
                pathname: 'test.png',
                file: {
                  hash: this.mockBlobHash,
                },
              },
            ],
            v2Authors: [this.user_id],
            timestamp: this.timestamp,
          },
        ])
        done()
      }

      this.UpdateTranslator.convertToChanges(
        this.project_id,
        updates,
        assertion
      )
    })

    it('can translate doc renames', function (done) {
      const updates = [
        {
          update: {
            doc: this.doc_id,
            pathname: '/main.tex',
            new_pathname: '/new_main.tex',
            meta: {
              user_id: this.user_id,
              ts: this.timestamp,
            },
          },
        },
      ]
      const assertion = (error, changes) => {
        changes = changes.map(change => change.toRaw())
        expect(error).to.be.null
        expect(changes).to.deep.equal([
          {
            authors: [],
            operations: [
              {
                pathname: 'main.tex',
                newPathname: 'new_main.tex',
              },
            ],
            v2Authors: [this.user_id],
            timestamp: this.timestamp,
          },
        ])
        done()
      }

      this.UpdateTranslator.convertToChanges(
        this.project_id,
        updates,
        assertion
      )
    })

    it('can translate file renames', function (done) {
      const updates = [
        {
          update: {
            file: this.file_id,
            pathname: '/test.png',
            new_pathname: '/new_test.png',
            meta: {
              user_id: this.user_id,
              ts: this.timestamp,
            },
          },
        },
      ]
      const assertion = (error, changes) => {
        changes = changes.map(change => change.toRaw())
        expect(error).to.be.null
        expect(changes).to.deep.equal([
          {
            authors: [],
            operations: [
              {
                pathname: 'test.png',
                newPathname: 'new_test.png',
              },
            ],
            v2Authors: [this.user_id],
            timestamp: this.timestamp,
          },
        ])
        done()
      }

      this.UpdateTranslator.convertToChanges(
        this.project_id,
        updates,
        assertion
      )
    })

    it('can translate multiple updates with the correct versions', function (done) {
      const updates = [
        {
          update: {
            doc: this.doc_id,
            pathname: '/main.tex',
            docLines: 'a\nb',
            meta: {
              user_id: this.user_id,
              ts: this.timestamp,
            },
          },
          blobHash: this.mockBlobHash,
        },
        {
          update: {
            file: this.file_id,
            pathname: '/test.png',
            url: 'filestore.example.com/test.png',
            meta: {
              user_id: this.user_id,
              ts: this.timestamp,
            },
          },
          blobHash: this.mockBlobHash,
        },
      ]
      const assertion = (error, changes) => {
        changes = changes.map(change => change.toRaw())
        expect(error).to.be.null
        expect(changes).to.deep.equal([
          {
            authors: [],
            operations: [
              {
                pathname: 'main.tex',
                file: {
                  hash: this.mockBlobHash,
                },
              },
            ],
            v2Authors: [this.user_id],
            timestamp: this.timestamp,
          },
          {
            authors: [],
            operations: [
              {
                pathname: 'test.png',
                file: {
                  hash: this.mockBlobHash,
                },
              },
            ],
            v2Authors: [this.user_id],
            timestamp: this.timestamp,
          },
        ])
        done()
      }

      this.UpdateTranslator.convertToChanges(
        this.project_id,
        updates,
        assertion
      )
    })

    it('returns an error if the update has an unknown format', function (done) {
      const updates = [
        {
          update: {
            foo: 'bar',
          },
        },
      ]
      const assertion = (error, changes) => {
        expect(error)
          .to.exist.and.be.instanceof(Error)
          .and.have.property('message', 'update with unknown format')
        done()
      }

      this.UpdateTranslator.convertToChanges(
        this.project_id,
        updates,
        assertion
      )
    })

    it('replaces backslashes with underscores in pathnames', function (done) {
      const updates = [
        {
          update: {
            doc: this.doc_id,
            pathname: '/\\main\\foo.tex',
            new_pathname: '/\\new_main\\foo\\bar.tex',
            meta: {
              user_id: this.user_id,
              ts: this.timestamp,
            },
          },
        },
      ]
      const assertion = (error, changes) => {
        changes = changes.map(change => change.toRaw())
        expect(error).to.be.null
        expect(changes).to.deep.equal([
          {
            authors: [],
            operations: [
              {
                pathname: '_main_foo.tex',
                newPathname: '_new_main_foo_bar.tex',
              },
            ],
            v2Authors: [this.user_id],
            timestamp: this.timestamp,
          },
        ])
        done()
      }

      this.UpdateTranslator.convertToChanges(
        this.project_id,
        updates,
        assertion
      )
    })

    it('replaces leading asterisks with __ASTERISK__ in pathnames', function (done) {
      const updates = [
        {
          update: {
            file: this.file_id,
            pathname: '/test*test.png',
            meta: {
              user_id: this.user_id,
              ts: this.timestamp,
            },
            url: 'filestore.example.com/test*test.png',
          },
          blobHash: this.mockBlobHash,
        },
      ]
      const assertion = (error, changes) => {
        changes = changes.map(change => change.toRaw())
        expect(error).to.be.null
        expect(changes).to.deep.equal([
          {
            authors: [],
            operations: [
              {
                pathname: 'test__ASTERISK__test.png',
                file: {
                  hash: this.mockBlobHash,
                },
              },
            ],
            v2Authors: [this.user_id],
            timestamp: this.timestamp,
          },
        ])
        done()
      }

      this.UpdateTranslator.convertToChanges(
        this.project_id,
        updates,
        assertion
      )
    })

    it('replaces a leading space for top-level files with __SPACE__', function (done) {
      const updates = [
        {
          update: {
            file: this.file_id,
            pathname: '/ test.png',
            meta: {
              user_id: this.user_id,
              ts: this.timestamp,
            },
            url: 'filestore.example.com/test.png',
          },
          blobHash: this.mockBlobHash,
        },
      ]
      const assertion = (error, changes) => {
        changes = changes.map(change => change.toRaw())
        expect(error).to.be.null
        expect(changes).to.deep.equal([
          {
            authors: [],
            operations: [
              {
                pathname: '__SPACE__test.png',
                file: {
                  hash: this.mockBlobHash,
                },
              },
            ],
            v2Authors: [this.user_id],
            timestamp: this.timestamp,
          },
        ])
        done()
      }

      this.UpdateTranslator.convertToChanges(
        this.project_id,
        updates,
        assertion
      )
    })

    it('replaces leading spaces of files in subfolders with __SPACE__', function (done) {
      const updates = [
        {
          update: {
            file: this.file_id,
            pathname: '/folder/ test.png',
            meta: {
              user_id: this.user_id,
              ts: this.timestamp,
            },
            url: 'filestore.example.com/folder/test.png',
          },
          blobHash: this.mockBlobHash,
        },
      ]
      const assertion = (error, changes) => {
        changes = changes.map(change => change.toRaw())
        expect(error).to.be.null
        expect(changes).to.deep.equal([
          {
            authors: [],
            operations: [
              {
                pathname: 'folder/__SPACE__test.png',
                file: {
                  hash: this.mockBlobHash,
                },
              },
            ],
            v2Authors: [this.user_id],
            timestamp: this.timestamp,
          },
        ])
        done()
      }

      this.UpdateTranslator.convertToChanges(
        this.project_id,
        updates,
        assertion
      )
    })

    it('sets a null author when user_id is "anonymous-user"', function (done) {
      const updates = [
        {
          update: {
            doc: this.doc_id,
            pathname: '/main.tex',
            docLines: 'a\nb',
            meta: {
              user_id: 'anonymous-user',
              ts: this.timestamp,
            },
          },
          blobHash: this.mockBlobHash,
        },
      ]
      const assertion = (error, changes) => {
        changes = changes.map(change => change.toRaw())
        expect(error).to.be.null
        expect(changes).to.deep.equal([
          {
            authors: [],
            operations: [
              {
                pathname: 'main.tex',
                file: {
                  hash: this.mockBlobHash,
                },
              },
            ],
            v2Authors: [null],
            timestamp: this.timestamp,
          },
        ])
        done()
      }

      this.UpdateTranslator.convertToChanges(
        this.project_id,
        updates,
        assertion
      )
    })

    it('sets an empty array as author when there is no meta.user_id', function (done) {
      const updates = [
        {
          update: {
            doc: this.doc_id,
            pathname: '/main.tex',
            docLines: 'a\nb',
            meta: {
              ts: this.timestamp,
            },
          },
          blobHash: this.mockBlobHash,
        },
      ]
      const assertion = (error, changes) => {
        changes = changes.map(change => change.toRaw())
        expect(error).to.be.null
        expect(changes).to.deep.equal([
          {
            authors: [],
            operations: [
              {
                pathname: 'main.tex',
                file: {
                  hash: this.mockBlobHash,
                },
              },
            ],
            v2Authors: [],
            timestamp: this.timestamp,
          },
        ])
        done()
      }

      this.UpdateTranslator.convertToChanges(
        this.project_id,
        updates,
        assertion
      )
    })

    describe('text updates', function () {
      it('can translate insertions', function (done) {
        const updates = [
          {
            update: {
              doc: this.doc_id,
              op: [
                { p: 3, i: 'foo' },
                { p: 15, i: 'bar' },
              ],
              v: this.version,
              meta: {
                user_id: this.user_id,
                ts: new Date(this.timestamp).getTime(),
                pathname: '/main.tex',
                doc_length: 20,
                source: 'some-editor-id',
              },
            },
          },
        ]
        const assertion = (error, changes) => {
          changes = changes.map(change => change.toRaw())
          expect(error).to.be.null
          expect(changes).to.deep.equal([
            {
              authors: [],
              operations: [
                {
                  pathname: 'main.tex',
                  textOperation: [3, 'foo', 9, 'bar', 8],
                },
              ],
              v2Authors: [this.user_id],
              timestamp: this.timestamp,
              v2DocVersions: {
                '59bfd450e3028c4d40a1e9ab': {
                  pathname: 'main.tex',
                  v: 0,
                },
              },
            },
          ])
          done()
        }

        this.UpdateTranslator.convertToChanges(
          this.project_id,
          updates,
          assertion
        )
      })

      it('can translate deletions', function (done) {
        const updates = [
          {
            update: {
              doc: this.doc_id,
              op: [
                { p: 3, d: 'lo' },
                { p: 10, d: 'bar' },
              ],
              v: this.version,
              meta: {
                user_id: this.user_id,
                ts: new Date(this.timestamp).getTime(),
                pathname: '/main.tex',
                doc_length: 20,
              },
            },
          },
        ]
        const assertion = (error, changes) => {
          changes = changes.map(change => change.toRaw())
          expect(error).to.be.null
          expect(changes).to.deep.equal([
            {
              authors: [],
              operations: [
                {
                  pathname: 'main.tex',
                  textOperation: [3, -2, 7, -3, 5],
                },
              ],
              v2Authors: [this.user_id],
              timestamp: this.timestamp,
              v2DocVersions: {
                '59bfd450e3028c4d40a1e9ab': {
                  pathname: 'main.tex',
                  v: 0,
                },
              },
            },
          ])
          done()
        }

        this.UpdateTranslator.convertToChanges(
          this.project_id,
          updates,
          assertion
        )
      })

      it('can translate insertions at the start and end (with zero retained)', function (done) {
        const updates = [
          {
            update: {
              doc: this.doc_id,
              op: [
                { p: 0, i: 'foo' },
                { p: 23, i: 'bar' },
                { p: 0, d: 'foo' },
                { p: 20, d: 'bar' },
              ],
              v: this.version,
              meta: {
                user_id: this.user_id,
                ts: new Date(this.timestamp).getTime(),
                pathname: '/main.tex',
                doc_length: 20,
              },
            },
          },
        ]
        const assertion = (error, changes) => {
          changes = changes.map(change => change.toRaw())
          expect(error).to.be.null
          expect(changes).to.deep.equal([
            {
              authors: [],
              operations: [
                {
                  pathname: 'main.tex',
                  textOperation: [20],
                },
              ],
              v2Authors: [this.user_id],
              timestamp: this.timestamp,
              v2DocVersions: {
                '59bfd450e3028c4d40a1e9ab': {
                  pathname: 'main.tex',
                  v: 0,
                },
              },
            },
          ])
          done()
        }

        this.UpdateTranslator.convertToChanges(
          this.project_id,
          updates,
          assertion
        )
      })

      it('can handle operations in non-linear offset order', function (done) {
        const updates = [
          {
            update: {
              doc: this.doc_id,
              op: [
                { p: 15, i: 'foo' },
                { p: 3, i: 'bar' },
              ],
              v: this.version,
              meta: {
                user_id: this.user_id,
                ts: this.timestamp,
                pathname: '/main.tex',
                doc_length: 20,
              },
            },
          },
        ]
        const assertion = (error, changes) => {
          changes = changes.map(change => change.toRaw())
          expect(error).to.be.null
          expect(changes).to.deep.equal([
            {
              authors: [],
              operations: [
                {
                  pathname: 'main.tex',
                  textOperation: [3, 'bar', 12, 'foo', 5],
                },
              ],
              v2Authors: [this.user_id],
              timestamp: this.timestamp,
              v2DocVersions: {
                '59bfd450e3028c4d40a1e9ab': {
                  pathname: 'main.tex',
                  v: 0,
                },
              },
            },
          ])
          done()
        }

        this.UpdateTranslator.convertToChanges(
          this.project_id,
          updates,
          assertion
        )
      })

      it('can ignore comment ops', function (done) {
        const updates = [
          {
            update: {
              doc: this.doc_id,
              op: [
                { p: 0, i: 'foo' },
                { p: 5, c: 'bar' },
                { p: 10, i: 'baz' },
              ],
              v: this.version,
              meta: {
                user_id: this.user_id,
                ts: new Date(this.timestamp).getTime(),
                pathname: '/main.tex',
                doc_length: 20,
              },
            },
          },
        ]
        const assertion = (error, changes) => {
          changes = changes.map(change => change.toRaw())
          expect(error).to.be.null
          expect(changes).to.deep.equal([
            {
              authors: [],
              operations: [
                {
                  pathname: 'main.tex',
                  textOperation: ['foo', 7, 'baz', 13],
                },
              ],
              v2Authors: [this.user_id],
              timestamp: this.timestamp,
              v2DocVersions: {
                '59bfd450e3028c4d40a1e9ab': {
                  pathname: 'main.tex',
                  v: 0,
                },
              },
            },
          ])
          done()
        }

        this.UpdateTranslator.convertToChanges(
          this.project_id,
          updates,
          assertion
        )
      })

      it('handles insertions after the end of the document', function (done) {
        const updates = [
          {
            update: {
              doc: this.doc_id,
              op: [{ p: 3, i: '\\' }],
              v: this.version,
              meta: {
                user_id: this.user_id,
                ts: new Date(this.timestamp).getTime(),
                pathname: '/main.tex',
                doc_length: 2,
              },
            },
          },
        ]
        const assertion = (error, changes) => {
          changes = changes.map(change => change.toRaw())
          expect(error).to.be.null
          expect(changes).to.deep.equal([
            {
              authors: [],
              operations: [
                {
                  pathname: 'main.tex',
                  textOperation: [2, '\\'],
                },
              ],
              v2Authors: [this.user_id],
              timestamp: this.timestamp,
              v2DocVersions: {
                '59bfd450e3028c4d40a1e9ab': {
                  pathname: 'main.tex',
                  v: 0,
                },
              },
            },
          ])
          done()
        }

        this.UpdateTranslator.convertToChanges(
          this.project_id,
          updates,
          assertion
        )
      })

      it('translates external source metadata into an origin', function (done) {
        const updates = [
          {
            update: {
              doc: this.doc_id,
              op: [{ p: 3, i: 'foo' }],
              v: this.version,
              meta: {
                user_id: this.user_id,
                ts: new Date(this.timestamp).getTime(),
                pathname: '/main.tex',
                doc_length: 20,
                type: 'external',
                source: 'dropbox',
              },
            },
          },
        ]
        const assertion = (error, changes) => {
          changes = changes.map(change => change.toRaw())
          expect(error).to.be.null
          expect(changes).to.deep.equal([
            {
              authors: [],
              operations: [
                {
                  pathname: 'main.tex',
                  textOperation: [3, 'foo', 17],
                },
              ],
              v2Authors: [this.user_id],
              timestamp: this.timestamp,
              v2DocVersions: {
                '59bfd450e3028c4d40a1e9ab': {
                  pathname: 'main.tex',
                  v: 0,
                },
              },
              origin: { kind: 'dropbox' },
            },
          ])
          done()
        }

        this.UpdateTranslator.convertToChanges(
          this.project_id,
          updates,
          assertion
        )
      })

      it('errors on unexpected ops', function (done) {
        const updates = [
          {
            update: {
              doc: this.doc_id,
              op: [{ p: 5, z: 'bar' }],
              v: this.version,
              meta: {
                user_id: this.user_id,
                ts: new Date(this.timestamp).getTime(),
                pathname: '/main.tex',
                doc_length: 20,
              },
            },
          },
        ]
        const assertion = (error, changes) => {
          expect(error.message).to.equal('unexpected op type')
          done()
        }

        this.UpdateTranslator.convertToChanges(
          this.project_id,
          updates,
          assertion
        )
      })
    })
  })
})
