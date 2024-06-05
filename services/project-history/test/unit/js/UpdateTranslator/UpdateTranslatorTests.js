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
    it('can translate doc additions', function () {
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
          blobHashes: { file: this.mockBlobHash },
        },
      ]

      const changes = this.UpdateTranslator.convertToChanges(
        this.project_id,
        updates
      ).map(change => change.toRaw())

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
    })

    it('can translate file additions', function () {
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
          blobHashes: { file: this.mockBlobHash },
        },
      ]

      const changes = this.UpdateTranslator.convertToChanges(
        this.project_id,
        updates
      ).map(change => change.toRaw())

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
    })

    it('can translate doc renames', function () {
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

      const changes = this.UpdateTranslator.convertToChanges(
        this.project_id,
        updates
      ).map(change => change.toRaw())

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
    })

    it('can translate file renames', function () {
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

      const changes = this.UpdateTranslator.convertToChanges(
        this.project_id,
        updates
      ).map(change => change.toRaw())

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
    })

    it('can translate multiple updates with the correct versions', function () {
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
          blobHashes: { file: this.mockBlobHash },
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
          blobHashes: { file: this.mockBlobHash },
        },
      ]

      const changes = this.UpdateTranslator.convertToChanges(
        this.project_id,
        updates
      ).map(change => change.toRaw())

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
    })

    it('returns an error if the update has an unknown format', function () {
      const updates = [
        {
          update: {
            foo: 'bar',
          },
        },
      ]
      expect(() =>
        this.UpdateTranslator.convertToChanges(this.project_id, updates)
      ).to.throw('update with unknown format')
    })

    it('replaces backslashes with underscores in pathnames', function () {
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

      const changes = this.UpdateTranslator.convertToChanges(
        this.project_id,
        updates
      ).map(change => change.toRaw())

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
    })

    it('replaces leading asterisks with __ASTERISK__ in pathnames', function () {
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
          blobHashes: { file: this.mockBlobHash },
        },
      ]

      const changes = this.UpdateTranslator.convertToChanges(
        this.project_id,
        updates
      ).map(change => change.toRaw())

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
    })

    it('replaces a leading space for top-level files with __SPACE__', function () {
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
          blobHashes: { file: this.mockBlobHash },
        },
      ]

      const changes = this.UpdateTranslator.convertToChanges(
        this.project_id,
        updates
      ).map(change => change.toRaw())

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
    })

    it('replaces leading spaces of files in subfolders with __SPACE__', function () {
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
          blobHashes: { file: this.mockBlobHash },
        },
      ]

      const changes = this.UpdateTranslator.convertToChanges(
        this.project_id,
        updates
      ).map(change => change.toRaw())

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
    })

    it('sets a null author when user_id is "anonymous-user"', function () {
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
          blobHashes: { file: this.mockBlobHash },
        },
      ]

      const changes = this.UpdateTranslator.convertToChanges(
        this.project_id,
        updates
      ).map(change => change.toRaw())

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
    })

    it('sets an empty array as author when there is no meta.user_id', function () {
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
          blobHashes: { file: this.mockBlobHash },
        },
      ]

      const changes = this.UpdateTranslator.convertToChanges(
        this.project_id,
        updates
      ).map(change => change.toRaw())

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
    })

    describe('text updates', function () {
      it('can translate insertions', function () {
        const updates = [
          {
            update: {
              doc: this.doc_id,
              op: [
                { p: 3, i: 'foo' },
                { p: 15, i: 'bar', commentIds: ['comment1'] },
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

        const changes = this.UpdateTranslator.convertToChanges(
          this.project_id,
          updates
        ).map(change => change.toRaw())

        expect(changes).to.deep.equal([
          {
            authors: [],
            operations: [
              {
                pathname: 'main.tex',
                textOperation: [
                  3,
                  'foo',
                  9,
                  { i: 'bar', commentIds: ['comment1'] },
                  8,
                ],
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
      })

      it('can translate deletions', function () {
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

        const changes = this.UpdateTranslator.convertToChanges(
          this.project_id,
          updates
        ).map(change => change.toRaw())

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
      })

      it('should translate retains without tracking data', function () {
        const updates = [
          {
            update: {
              doc: this.doc_id,
              op: [
                {
                  p: 3,
                  r: 'lo',
                },
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

        const changes = this.UpdateTranslator.convertToChanges(
          this.project_id,
          updates
        ).map(change => change.toRaw())

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
              [this.doc_id]: {
                pathname: 'main.tex',
                v: 0,
              },
            },
          },
        ])
      })

      it('can translate retains with tracking data', function () {
        const updates = [
          {
            update: {
              doc: this.doc_id,
              op: [
                {
                  p: 3,
                  r: 'lo',
                  tracking: { type: 'none' },
                },
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

        const changes = this.UpdateTranslator.convertToChanges(
          this.project_id,
          updates
        ).map(change => change.toRaw())

        expect(changes).to.deep.equal([
          {
            authors: [],
            operations: [
              {
                pathname: 'main.tex',
                textOperation: [
                  3,
                  {
                    r: 2,
                    tracking: { type: 'none' },
                  },
                  15,
                ],
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
      })

      it('can translate insertions at the start and end (with zero retained)', function () {
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

        const changes = this.UpdateTranslator.convertToChanges(
          this.project_id,
          updates
        ).map(change => change.toRaw())

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
      })

      it('can handle operations in non-linear offset order', function () {
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

        const changes = this.UpdateTranslator.convertToChanges(
          this.project_id,
          updates
        ).map(change => change.toRaw())

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
      })

      it('handles comment ops', function () {
        const updates = [
          {
            update: {
              doc: this.doc_id,
              op: [
                { p: 0, i: 'foo' },
                { p: 3, d: 'bar' },
                { p: 5, c: 'comment this', t: 'comment-id-1' },
                { p: 7, c: 'another comment', t: 'comment-id-2' },
                { p: 9, c: '', t: 'comment-id-3' },
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

        const changes = this.UpdateTranslator.convertToChanges(
          this.project_id,
          updates
        ).map(change => change.toRaw())

        expect(changes).to.deep.equal([
          {
            authors: [],
            operations: [
              {
                pathname: 'main.tex',
                textOperation: ['foo', -3, 17],
              },
              {
                pathname: 'main.tex',
                commentId: 'comment-id-1',
                ranges: [{ pos: 5, length: 12 }],
              },
              {
                pathname: 'main.tex',
                commentId: 'comment-id-2',
                ranges: [{ pos: 7, length: 15 }],
              },
              {
                pathname: 'main.tex',
                commentId: 'comment-id-3',
                ranges: [],
              },
              {
                pathname: 'main.tex',
                textOperation: [10, 'baz', 10],
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
      })

      it('handles insertions after the end of the document', function () {
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

        const changes = this.UpdateTranslator.convertToChanges(
          this.project_id,
          updates
        ).map(change => change.toRaw())

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
      })

      it('translates external source metadata into an origin', function () {
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

        const changes = this.UpdateTranslator.convertToChanges(
          this.project_id,
          updates
        ).map(change => change.toRaw())

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
      })

      it('errors on unexpected ops', function () {
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
        expect(() => {
          this.UpdateTranslator.convertToChanges(this.project_id, updates)
        }).to.throw('unexpected op type')
      })
    })

    describe('text updates with history metadata', function () {
      it('handles deletes over tracked deletes', function () {
        const updates = [
          {
            update: {
              doc: this.doc_id,
              op: [
                { i: 'foo', p: 3, hpos: 5 },
                {
                  d: 'quux',
                  p: 10,
                  hpos: 15,
                  trackedChanges: [
                    { type: 'delete', offset: 2, length: 3 },
                    { type: 'delete', offset: 3, length: 1 },
                  ],
                },
                { c: 'noteworthy', p: 8, t: 'comment-id', hpos: 11, hlen: 14 },
              ],
              v: this.version,
              meta: {
                user_id: this.user_id,
                ts: new Date(this.timestamp).getTime(),
                pathname: '/main.tex',
                doc_length: 20,
                history_doc_length: 30,
                source: 'some-editor-id',
              },
            },
          },
        ]

        const changes = this.UpdateTranslator.convertToChanges(
          this.project_id,
          updates
        ).map(change => change.toRaw())

        expect(changes).to.deep.equal([
          {
            authors: [],
            operations: [
              {
                pathname: 'main.tex',
                textOperation: [5, 'foo', 7, -2, 3, -1, 1, -1, 10],
              },
              {
                pathname: 'main.tex',
                commentId: 'comment-id',
                ranges: [{ pos: 11, length: 14 }],
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
      })

      it('handles tracked delete rejections specially', function () {
        const updates = [
          {
            update: {
              doc: this.doc_id,
              op: [{ i: 'foo', p: 3, trackedDeleteRejection: true }],
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

        const changes = this.UpdateTranslator.convertToChanges(
          this.project_id,
          updates
        ).map(change => change.toRaw())

        expect(changes).to.deep.equal([
          {
            authors: [],
            operations: [
              {
                pathname: 'main.tex',
                textOperation: [
                  3,
                  {
                    r: 3,
                    tracking: { type: 'none' },
                  },
                  14,
                ],
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
      })

      it('handles tracked changes', function () {
        const updates = [
          {
            update: {
              doc: this.doc_id,
              op: [
                { i: 'inserted', p: 5 },
                { d: 'deleted', p: 20 },
                { i: 'rejected deletion', p: 30, trackedDeleteRejection: true },
                {
                  d: 'rejected insertion',
                  p: 50,
                  trackedChanges: [{ type: 'insert', offset: 0, length: 18 }],
                },
              ],
              v: this.version,
              meta: {
                tc: 'tracked-change-id',
                user_id: this.user_id,
                ts: new Date(this.timestamp).getTime(),
                pathname: '/main.tex',
                doc_length: 70,
                source: 'some-editor-id',
              },
            },
          },
        ]

        const changes = this.UpdateTranslator.convertToChanges(
          this.project_id,
          updates
        ).map(change => change.toRaw())

        expect(changes).to.deep.equal([
          {
            authors: [],
            operations: [
              {
                pathname: 'main.tex',
                textOperation: [
                  5,
                  {
                    i: 'inserted',
                    tracking: {
                      type: 'insert',
                      userId: this.user_id,
                      ts: new Date(this.timestamp).toISOString(),
                    },
                  },
                  7,
                  {
                    r: 7,
                    tracking: {
                      type: 'delete',
                      userId: this.user_id,
                      ts: new Date(this.timestamp).toISOString(),
                    },
                  },
                  3,
                  {
                    r: 17,
                    tracking: { type: 'none' },
                  },
                  3,
                  -18,
                  10,
                ],
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
      })

      it('handles a delete over a mix of tracked inserts and tracked deletes', function () {
        const updates = [
          {
            update: {
              doc: this.doc_id,
              op: [
                {
                  d: 'abcdef',
                  p: 10,
                  trackedChanges: [
                    { type: 'insert', offset: 0, length: 3 },
                    { type: 'delete', offset: 2, length: 10 },
                    { type: 'insert', offset: 2, length: 2 },
                  ],
                },
              ],
              v: this.version,
              meta: {
                tc: 'tracking-id',
                user_id: this.user_id,
                ts: new Date(this.timestamp).getTime(),
                pathname: '/main.tex',
                doc_length: 20,
                history_doc_length: 30,
                source: 'some-editor-id',
              },
            },
          },
        ]

        const changes = this.UpdateTranslator.convertToChanges(
          this.project_id,
          updates
        ).map(change => change.toRaw())

        expect(changes).to.deep.equal([
          {
            authors: [],
            operations: [
              {
                pathname: 'main.tex',
                textOperation: [
                  10,
                  -3,
                  10,
                  -2,
                  {
                    r: 1,
                    tracking: {
                      type: 'delete',
                      userId: this.user_id,
                      ts: this.timestamp,
                    },
                  },
                  4,
                ],
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
      })
    })
  })
})
