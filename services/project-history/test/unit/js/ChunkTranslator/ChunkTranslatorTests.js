import sinon from 'sinon'
import { expect } from 'chai'
import { strict as esmock } from 'esmock'

const MODULE_PATH = '../../../../app/js/ChunkTranslator.js'

describe('ChunkTranslator', function () {
  beforeEach(async function () {
    this.projectId = '0123456789abc0123456789abc'
    this.historyId = 12345
    this.author1 = {
      id: 1,
      email: 'james.allen@overleaf.com',
      name: 'James Allen',
    }
    this.date = new Date()
    this.fileHash = 'some_hash'
    this.fileContents = 'Hello world, this is a test'
    this.HistoryStoreManager = {
      getProjectBlob: sinon.stub(),
    }
    this.HistoryStoreManager.getProjectBlob
      .withArgs(this.historyId, this.fileHash)
      .yields(null, this.fileContents)
    this.WebApiManager = {
      getHistoryId: sinon.stub().callsFake((projectId, cb) => {
        console.log({ projectId })
      }),
    }
    this.WebApiManager.getHistoryId
      .withArgs(this.projectId)
      .yields(null, this.historyId)
    this.ChunkTranslator = await esmock(MODULE_PATH, {
      '../../../../app/js/HistoryStoreManager.js': this.HistoryStoreManager,
      '../../../../app/js/WebApiManager.js': this.WebApiManager,
    })
    this.callback = sinon.stub()
  })

  describe('with changes to the text', function () {
    beforeEach(function () {
      this.chunk = {
        project_id: this.projectId,
        chunk: {
          startVersion: 0,
          history: {
            snapshot: {
              files: {
                'main.tex': {
                  hash: this.fileHash,
                  stringLength: 42,
                },
              },
            },
            changes: [
              {
                operations: [
                  { pathname: 'main.tex', textOperation: ['Hello test, ', -6] },
                ],
                timestamp: this.date.toISOString(),
                authors: [this.author1.id],
              },
              {
                operations: [
                  { pathname: 'main.tex', textOperation: [6, 'foo '] },
                ],
                timestamp: this.date.toISOString(),
                authors: [this.author1.id],
              },
              {
                operations: [{ pathname: 'main.tex', textOperation: [6, -4] }],
                timestamp: this.date.toISOString(),
                authors: [this.author1.id],
              },
              {
                origin: {
                  kind: 'file-restore',
                  version: 1,
                  path: 'main.tex',
                  timestamp: this.date.toISOString(),
                },
                operations: [
                  {
                    pathname: 'main.tex',
                    newPathname: '',
                  },
                ],
                timestamp: this.date.toISOString(),
                authors: [this.author1.id],
              },
              {
                origin: {
                  kind: 'file-restore',
                  version: 1,
                  path: 'main.tex',
                  timestamp: this.date.toISOString(),
                },
                operations: [
                  {
                    pathname: 'main.tex',
                    file: {
                      hash: this.fileHash,
                      stringLength: 42,
                    },
                  },
                ],
                timestamp: this.date.toISOString(),
                authors: [this.author1.id],
              },
              {
                operations: [
                  {
                    pathname: 'main.tex',
                    newPathname: 'main2.tex',
                  },
                ],
                timestamp: this.date.toISOString(),
                authors: [this.author1.id],
              },
            ],
          },
        },
        authors: [this.author1.id],
      }
    })

    describe('convertToDiffUpdates', function () {
      it('should convert them to insert and delete ops', function (done) {
        this.ChunkTranslator.convertToDiffUpdates(
          this.projectId,
          this.chunk,
          'main.tex',
          0,
          3,
          (error, param) => {
            if (param == null) {
              param = {}
            }
            const { initialContent, updates } = param
            expect(error).to.be.null
            expect(initialContent).to.equal(this.fileContents)
            expect(updates).to.deep.equal([
              {
                op: [
                  { i: 'Hello test, ', p: 0 },
                  { d: 'Hello ', p: 12 },
                ],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 0,
              },
              {
                op: [{ i: 'foo ', p: 6 }],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 1,
              },
              {
                op: [{ d: 'foo ', p: 6 }],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 2,
              },
            ])
            done()
          }
        )
      })

      it('should return the correct initial text if there are previous changes', function (done) {
        this.ChunkTranslator.convertToDiffUpdates(
          this.projectId,
          this.chunk,
          'main.tex',
          2,
          3,
          (error, param) => {
            if (param == null) {
              param = {}
            }
            const { initialContent, updates } = param
            expect(error).to.be.null
            expect(initialContent).to.equal(
              'Hello foo test, world, this is a test'
            )
            expect(updates).to.deep.equal([
              {
                op: [{ d: 'foo ', p: 6 }],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 2,
              },
            ])
            done()
          }
        )
      })

      it('should return the correct initial text in case of file restore', function (done) {
        this.ChunkTranslator.convertToDiffUpdates(
          this.projectId,
          this.chunk,
          'main.tex',
          3,
          5,
          (error, param) => {
            const { initialContent } = param
            expect(error).to.be.null
            expect(initialContent).to.equal('Hello world, this is a test')
            done()
          }
        )
      })

      it('should still find original file in case it was renamed', function (done) {
        this.ChunkTranslator.convertToDiffUpdates(
          this.projectId,
          this.chunk,
          'main.tex',
          5,
          6,
          (error, param) => {
            const { initialContent } = param
            expect(error).to.be.null
            expect(initialContent).to.equal('Hello world, this is a test')
            done()
          }
        )
      })
    })

    describe('convertToSummarizedUpdates', function () {
      it('should return a summary of which docs changes when', function (done) {
        const assertion = (error, updates) => {
          expect(error).to.be.null

          expect(updates).to.deep.equal([
            {
              pathnames: ['main.tex'],
              project_ops: [],
              meta: {
                users: [this.author1.id],
                start_ts: this.date.getTime(),
                end_ts: this.date.getTime(),
              },
              v: 0,
            },
            {
              pathnames: ['main.tex'],
              project_ops: [],
              meta: {
                users: [this.author1.id],
                start_ts: this.date.getTime(),
                end_ts: this.date.getTime(),
              },
              v: 1,
            },
            {
              pathnames: ['main.tex'],
              project_ops: [],
              meta: {
                users: [this.author1.id],
                start_ts: this.date.getTime(),
                end_ts: this.date.getTime(),
              },
              v: 2,
            },
            {
              pathnames: [],
              project_ops: [
                {
                  remove: {
                    pathname: 'main.tex',
                  },
                },
              ],
              meta: {
                users: [this.author1.id],
                start_ts: this.date.getTime(),
                end_ts: this.date.getTime(),
                origin: {
                  kind: 'file-restore',
                  version: 1,
                  path: 'main.tex',
                  timestamp: this.date.toISOString(),
                },
              },
              v: 3,
            },
            {
              pathnames: [],
              project_ops: [
                {
                  add: {
                    pathname: 'main.tex',
                  },
                },
              ],
              meta: {
                users: [this.author1.id],
                start_ts: this.date.getTime(),
                end_ts: this.date.getTime(),
                origin: {
                  kind: 'file-restore',
                  version: 1,
                  path: 'main.tex',
                  timestamp: this.date.toISOString(),
                },
              },
              v: 4,
            },
            {
              pathnames: [],
              project_ops: [
                {
                  rename: {
                    pathname: 'main.tex',
                    newPathname: 'main2.tex',
                  },
                },
              ],
              meta: {
                users: [this.author1.id],
                start_ts: this.date.getTime(),
                end_ts: this.date.getTime(),
              },
              v: 5,
            },
          ])
          done()
        }

        this.ChunkTranslator.convertToSummarizedUpdates(this.chunk, assertion)
      })
    })
  })

  describe('with a sequence of inserts and deletes', function () {
    beforeEach(function () {
      this.fileHash = 'some_other_hash'
      this.initialFileContents = 'aa bbbbb ccc '
      this.HistoryStoreManager.getProjectBlob
        .withArgs(this.historyId, this.fileHash)
        .yields(null, this.initialFileContents)

      this.chunk = {
        chunk: {
          startVersion: 0,
          history: {
            snapshot: {
              files: {
                'main.tex': {
                  hash: this.fileHash,
                  stringLength: 42,
                },
              },
            },
            changes: [
              {
                operations: [
                  {
                    pathname: 'main.tex',
                    textOperation: [
                      '111 ', // -> "111 aa bbbbb ccc "
                      -3, // -> "111 bbbbb ccc "
                      6, // -> "111 bbbbb ccc "
                      '2222 ', // -> "111 bbbbb 2222 ccc "
                      -1, // -> "111 bbbbb 2222 cc "
                      'd', // -> "111 bbbbb 2222 dcc "
                      3,
                    ],
                  },
                ],
                timestamp: this.date.toISOString(),
                authors: [this.author1.id],
              },
            ],
          },
        },
        authors: [this.author1.id],
      }
    })

    describe('convertToDiffUpdates', function () {
      it('should convert them to insert and delete ops', function (done) {
        this.ChunkTranslator.convertToDiffUpdates(
          this.projectId,
          this.chunk,
          'main.tex',
          0,
          1,
          (error, param) => {
            if (param == null) {
              param = {}
            }
            const { initialContent, updates } = param
            expect(error).to.be.null
            expect(initialContent).to.equal(this.initialFileContents)
            expect(updates).to.deep.equal([
              {
                op: [
                  { i: '111 ', p: 0 },
                  { d: 'aa ', p: 4 },
                  // NOTE: The construction of TextOperation can merge an
                  // insertion across a deletion operation, which is why this is
                  // ever so slightly different from the textOperation defined
                  // in the chunk. Both diffs represent the same change in
                  // content.
                  { i: '2222 d', p: 10 },
                  { d: 'c', p: 16 },
                ],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 0,
              },
            ])
            done()
          }
        )
      })

      it('should apply them to the text correctly', function (done) {
        this.ChunkTranslator.convertToDiffUpdates(
          this.projectId,
          this.chunk,
          'main.tex',
          1,
          1,
          (error, param) => {
            if (param == null) {
              param = {}
            }
            const { initialContent, updates } = param
            expect(error).to.be.null
            expect(initialContent).to.equal('111 bbbbb 2222 dcc ')
            expect(updates).to.deep.equal([])
            done()
          }
        )
      })
    })
  })

  describe('with unknown operations', function (done) {
    beforeEach(function () {
      this.chunk = {
        chunk: {
          startVersion: 0,
          history: {
            snapshot: {
              files: {
                'main.tex': {
                  hash: this.fileHash,
                  stringLength: 42,
                },
              },
            },
            changes: [
              {
                operations: [{ unknown: true }],
                timestamp: this.date.toISOString(),
                authors: [this.author1.id, undefined],
              },
              {
                operations: [
                  { pathname: 'main.tex', textOperation: [3, 'Hello world'] },
                ],
                timestamp: this.date.toISOString(),
                authors: [this.author1.id, undefined],
              },
            ],
          },
        },
        authors: [this.author1.id],
      }
    })

    describe('convertToDiffUpdates', function () {
      it('should ignore the unknown update', function (done) {
        this.ChunkTranslator.convertToDiffUpdates(
          this.projectId,
          this.chunk,
          'main.tex',
          0,
          2,
          (error, param) => {
            if (param == null) {
              param = {}
            }
            const { initialContent, updates } = param
            expect(error).to.be.null
            expect(initialContent).to.equal(this.fileContents)
            expect(updates).to.deep.equal([
              {
                op: [{ i: 'Hello world', p: 3 }],
                meta: {
                  users: [this.author1.id, null],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 1,
              },
            ])
            done()
          }
        )
      })
    })

    describe('convertToSummarizedUpdates', function () {
      it('should ignore the unknown update', function (done) {
        const assertion = (error, updates) => {
          expect(error).to.be.null
          expect(updates).to.deep.equal([
            {
              pathnames: [],
              project_ops: [],
              meta: {
                users: [this.author1.id, null],
                start_ts: this.date.getTime(),
                end_ts: this.date.getTime(),
              },
              v: 0,
            },
            {
              pathnames: ['main.tex'],
              project_ops: [],
              meta: {
                users: [this.author1.id, null],
                start_ts: this.date.getTime(),
                end_ts: this.date.getTime(),
              },
              v: 1,
            },
          ])
          done()
        }

        this.ChunkTranslator.convertToSummarizedUpdates(this.chunk, assertion)
      })
    })
  })

  describe('with changes to multiple files', function (done) {
    beforeEach(function () {
      this.chunk = {
        chunk: {
          startVersion: 0,
          history: {
            snapshot: {
              files: {
                'main.tex': {
                  hash: this.fileHash,
                  stringLength: 42,
                },
                'other.tex': {
                  hash: this.fileHash,
                  stringLength: 42,
                },
              },
            },
            changes: [
              {
                operations: [
                  { pathname: 'other.tex', textOperation: [0, 'foo'] },
                ],
                timestamp: this.date.toISOString(),
                authors: [this.author1.id],
              },
              {
                operations: [
                  { pathname: 'main.tex', textOperation: [6, 'bar'] },
                ],
                timestamp: this.date.toISOString(),
                authors: [this.author1.id],
              },
              {
                operations: [
                  { pathname: 'other.tex', textOperation: [9, 'baz'] },
                ],
                timestamp: this.date.toISOString(),
                authors: [this.author1.id],
              },
              {
                operations: [
                  { pathname: 'main.tex', textOperation: [12, 'qux'] },
                ],
                timestamp: this.date.toISOString(),
                authors: [this.author1.id],
              },
            ],
          },
        },
        authors: [this.author1.id],
      }
    })

    describe('convertToDiffUpdates', function () {
      it('should only return the changes to the requested file', function (done) {
        this.ChunkTranslator.convertToDiffUpdates(
          this.projectId,
          this.chunk,
          'main.tex',
          0,
          4,
          (error, param) => {
            if (param == null) {
              param = {}
            }
            const { initialContent, updates } = param
            expect(error).to.be.null
            expect(initialContent).to.equal('Hello world, this is a test')
            expect(updates).to.deep.equal([
              {
                op: [{ i: 'bar', p: 6 }],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 1,
              },
              {
                op: [{ i: 'qux', p: 12 }],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 3,
              },
            ])
            done()
          }
        )
      })
    })

    describe('convertToSummarizedUpdates', function () {
      it('should return a summary of which docs changes when', function (done) {
        const assertion = (error, updates) => {
          expect(error).to.be.null
          expect(updates).to.deep.equal([
            {
              pathnames: ['other.tex'],
              project_ops: [],
              meta: {
                users: [this.author1.id],
                start_ts: this.date.getTime(),
                end_ts: this.date.getTime(),
              },
              v: 0,
            },
            {
              pathnames: ['main.tex'],
              project_ops: [],
              meta: {
                users: [this.author1.id],
                start_ts: this.date.getTime(),
                end_ts: this.date.getTime(),
              },
              v: 1,
            },
            {
              pathnames: ['other.tex'],
              project_ops: [],
              meta: {
                users: [this.author1.id],
                start_ts: this.date.getTime(),
                end_ts: this.date.getTime(),
              },
              v: 2,
            },
            {
              pathnames: ['main.tex'],
              project_ops: [],
              meta: {
                users: [this.author1.id],
                start_ts: this.date.getTime(),
                end_ts: this.date.getTime(),
              },
              v: 3,
            },
          ])
          done()
        }

        this.ChunkTranslator.convertToSummarizedUpdates(this.chunk, assertion)
      })
    })
  })

  describe('when the file is created during the chunk', function () {
    beforeEach(function () {
      this.chunk = {
        chunk: {
          startVersion: 0,
          history: {
            snapshot: {
              files: {
                'main.tex': {
                  hash: this.fileHash,
                  stringLength: 42,
                },
              },
            },
            changes: [
              {
                operations: [
                  { pathname: 'main.tex', textOperation: [6, 'bar'] },
                ],
                timestamp: this.date.toISOString(),
                authors: [this.author1.id],
              },
              {
                operations: [
                  {
                    pathname: 'new.tex',
                    file: { hash: this.fileHash, stringLength: 10 },
                  },
                ],
                timestamp: this.date.toISOString(),
                authors: [this.author1.id],
              },
              {
                operations: [
                  { pathname: 'new.tex', textOperation: [6, 'bar'] },
                ],
                timestamp: this.date.toISOString(),
                authors: [this.author1.id],
              },
              {
                operations: [
                  { pathname: 'new.tex', textOperation: [9, 'baz'] },
                ],
                timestamp: this.date.toISOString(),
                authors: [this.author1.id],
              },
            ],
          },
        },
        authors: [this.author1],
      }
    })

    describe('convertToDiffUpdates', function () {
      it('returns changes after the file was created before the fromVersion', function (done) {
        this.ChunkTranslator.convertToDiffUpdates(
          this.projectId,
          this.chunk,
          'new.tex',
          2,
          4,
          (error, param) => {
            if (param == null) {
              param = {}
            }
            const { initialContent, updates } = param
            expect(error).to.be.null
            expect(initialContent).to.equal(this.fileContents)
            expect(updates).to.deep.equal([
              {
                op: [{ i: 'bar', p: 6 }],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 2,
              },
              {
                op: [{ i: 'baz', p: 9 }],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 3,
              },
            ])
            done()
          }
        )
      })

      it('returns changes when the file was created at the fromVersion', function (done) {
        this.ChunkTranslator.convertToDiffUpdates(
          this.projectId,
          this.chunk,
          'new.tex',
          1,
          4,
          (error, param) => {
            if (param == null) {
              param = {}
            }
            const { initialContent, updates } = param
            expect(error).to.be.null
            expect(initialContent).to.equal(this.fileContents)
            expect(updates).to.deep.equal([
              {
                op: [{ i: 'bar', p: 6 }],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 2,
              },
              {
                op: [{ i: 'baz', p: 9 }],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 3,
              },
            ])
            done()
          }
        )
      })

      it('returns changes when the file was created after the fromVersion', function (done) {
        this.ChunkTranslator.convertToDiffUpdates(
          this.projectId,
          this.chunk,
          'new.tex',
          0,
          4,
          (error, param) => {
            if (param == null) {
              param = {}
            }
            const { initialContent, updates } = param
            expect(error).to.be.null
            expect(initialContent).to.equal(this.fileContents)
            expect(updates).to.deep.equal([
              {
                op: [{ i: 'bar', p: 6 }],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 2,
              },
              {
                op: [{ i: 'baz', p: 9 }],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 3,
              },
            ])
            done()
          }
        )
      })
    })

    describe('convertToSummarizedUpdates', function () {
      it('should return a summary which includes the addition', function (done) {
        const assertion = (error, updates) => {
          expect(error).to.be.null
          expect(updates).to.deep.equal([
            {
              pathnames: ['main.tex'],
              project_ops: [],
              meta: {
                users: [this.author1.id],
                start_ts: this.date.getTime(),
                end_ts: this.date.getTime(),
              },
              v: 0,
            },
            {
              pathnames: [],
              project_ops: [
                {
                  add: {
                    pathname: 'new.tex',
                  },
                },
              ],
              meta: {
                users: [this.author1.id],
                start_ts: this.date.getTime(),
                end_ts: this.date.getTime(),
              },
              v: 1,
            },
            {
              pathnames: ['new.tex'],
              project_ops: [],
              meta: {
                users: [this.author1.id],
                start_ts: this.date.getTime(),
                end_ts: this.date.getTime(),
              },
              v: 2,
            },
            {
              pathnames: ['new.tex'],
              project_ops: [],
              meta: {
                users: [this.author1.id],
                start_ts: this.date.getTime(),
                end_ts: this.date.getTime(),
              },
              v: 3,
            },
          ])
          done()
        }

        this.ChunkTranslator.convertToSummarizedUpdates(this.chunk, assertion)
      })
    })
  })

  describe('when the file is renamed during the chunk', function () {
    beforeEach(function () {
      this.chunk = {
        chunk: {
          startVersion: 0,
          history: {
            snapshot: {
              files: {
                'main.tex': {
                  hash: this.fileHash,
                  stringLength: 42,
                },
              },
            },
            changes: [
              {
                operations: [{ pathname: 'main.tex', textOperation: ['foo'] }],
                timestamp: this.date.toISOString(),
                authors: [this.author1.id],
              },
              {
                operations: [
                  { pathname: 'main.tex', newPathname: 'moved.tex' },
                ],
                timestamp: this.date.toISOString(),
                authors: [this.author1.id],
              },
              {
                operations: [
                  { pathname: 'moved.tex', textOperation: [3, 'bar'] },
                ],
                timestamp: this.date.toISOString(),
                authors: [this.author1.id],
              },
              {
                operations: [
                  { pathname: 'moved.tex', newPathname: 'moved_again.tex' },
                ],
                timestamp: this.date.toISOString(),
                authors: [this.author1.id],
              },
              {
                operations: [
                  { pathname: 'moved_again.tex', textOperation: [6, 'baz'] },
                ],
                timestamp: this.date.toISOString(),
                authors: [this.author1.id],
              },
            ],
          },
        },
        authors: [this.author1],
      }
    })

    describe('convertToDiffUpdates', function () {
      it('uses the original pathname before it is moved', function (done) {
        this.ChunkTranslator.convertToDiffUpdates(
          this.projectId,
          this.chunk,
          'main.tex',
          0,
          5,
          (error, param) => {
            if (param == null) {
              param = {}
            }
            const { initialContent, updates } = param
            expect(error).to.be.null
            expect(initialContent).to.equal(this.fileContents)
            expect(updates).to.deep.equal([
              {
                op: [{ i: 'foo', p: 0 }],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 0,
              },
              {
                op: [{ i: 'bar', p: 3 }],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 2,
              },
              {
                op: [{ i: 'baz', p: 6 }],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 4,
              },
            ])
            done()
          }
        )
      })

      it('uses the original pathname for before the move change', function (done) {
        this.ChunkTranslator.convertToDiffUpdates(
          this.projectId,
          this.chunk,
          'main.tex',
          1,
          5,
          (error, param) => {
            if (param == null) {
              param = {}
            }
            const { initialContent, updates } = param
            expect(error).to.be.null
            expect(initialContent).to.equal('foo' + this.fileContents)
            expect(updates).to.deep.equal([
              {
                op: [{ i: 'bar', p: 3 }],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 2,
              },
              {
                op: [{ i: 'baz', p: 6 }],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 4,
              },
            ])
            done()
          }
        )
      })

      it('uses the new pathname for after the move change', function (done) {
        this.ChunkTranslator.convertToDiffUpdates(
          this.projectId,
          this.chunk,
          'moved.tex',
          2,
          5,
          (error, param) => {
            if (param == null) {
              param = {}
            }
            const { initialContent, updates } = param
            expect(error).to.be.null
            expect(initialContent).to.equal('foo' + this.fileContents)
            expect(updates).to.deep.equal([
              {
                op: [{ i: 'bar', p: 3 }],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 2,
              },
              {
                op: [{ i: 'baz', p: 6 }],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 4,
              },
            ])
            done()
          }
        )
      })

      it('tracks multiple renames', function (done) {
        this.ChunkTranslator.convertToDiffUpdates(
          this.projectId,
          this.chunk,
          'moved_again.tex',
          4,
          5,
          (error, param) => {
            if (param == null) {
              param = {}
            }
            const { initialContent, updates } = param
            expect(error).to.be.null
            expect(initialContent).to.equal('foobar' + this.fileContents)
            expect(updates).to.deep.equal([
              {
                op: [{ i: 'baz', p: 6 }],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 4,
              },
            ])
            done()
          }
        )
      })

      it('returns an error when referring to a file that is now moved', function (done) {
        this.ChunkTranslator.convertToDiffUpdates(
          this.projectId,
          this.chunk,
          'main.tex',
          4,
          5,
          error => {
            expect(error.message).to.equal(
              "pathname 'main.tex' not found in range"
            )
            done()
          }
        )
      })
    })

    describe('convertToSummarizedUpdates', function () {
      it('should return a summary which includes the rename', function (done) {
        const assertion = (error, updates) => {
          expect(error).to.be.null
          expect(updates).to.deep.equal([
            {
              pathnames: ['main.tex'],
              project_ops: [],
              meta: {
                users: [this.author1.id],
                start_ts: this.date.getTime(),
                end_ts: this.date.getTime(),
              },
              v: 0,
            },
            {
              pathnames: [],
              project_ops: [
                {
                  rename: {
                    pathname: 'main.tex',
                    newPathname: 'moved.tex',
                  },
                },
              ],
              meta: {
                users: [this.author1.id],
                start_ts: this.date.getTime(),
                end_ts: this.date.getTime(),
              },
              v: 1,
            },
            {
              pathnames: ['moved.tex'],
              project_ops: [],
              meta: {
                users: [this.author1.id],
                start_ts: this.date.getTime(),
                end_ts: this.date.getTime(),
              },
              v: 2,
            },
            {
              pathnames: [],
              project_ops: [
                {
                  rename: {
                    pathname: 'moved.tex',
                    newPathname: 'moved_again.tex',
                  },
                },
              ],
              meta: {
                users: [this.author1.id],
                start_ts: this.date.getTime(),
                end_ts: this.date.getTime(),
              },
              v: 3,
            },
            {
              pathnames: ['moved_again.tex'],
              project_ops: [],
              meta: {
                users: [this.author1.id],
                start_ts: this.date.getTime(),
                end_ts: this.date.getTime(),
              },
              v: 4,
            },
          ])
          done()
        }

        this.ChunkTranslator.convertToSummarizedUpdates(this.chunk, assertion)
      })
    })
  })

  describe('when the file is deleted during the chunk', function () {
    beforeEach(function () {
      this.chunk = {
        chunk: {
          startVersion: 0,
          history: {
            snapshot: {
              files: {
                'main.tex': {
                  hash: this.fileHash,
                  stringLength: 42,
                },
                'other.tex': {
                  hash: this.fileHash,
                  stringLength: 42,
                },
              },
            },
            changes: [
              {
                operations: [{ pathname: 'main.tex', textOperation: ['foo'] }],
                timestamp: this.date.toISOString(),
                authors: [this.author1.id],
              },
              {
                operations: [{ pathname: 'main.tex', newPathname: '' }],
                timestamp: this.date.toISOString(),
                authors: [this.author1.id],
              },
              {
                operations: [{ pathname: 'other.tex', textOperation: ['foo'] }],
                timestamp: this.date.toISOString(),
                authors: [this.author1.id],
              },
            ],
          },
        },
        authors: [this.author1],
      }
    })

    describe('convertToDiffUpdates', function () {
      it('returns updates up to when it is deleted', function (done) {
        this.ChunkTranslator.convertToDiffUpdates(
          this.projectId,
          this.chunk,
          'main.tex',
          0,
          3,
          (error, param) => {
            if (param == null) {
              param = {}
            }
            const { initialContent, updates } = param
            expect(error).to.be.null
            expect(initialContent).to.equal(this.fileContents)
            expect(updates).to.deep.equal([
              {
                op: [{ i: 'foo', p: 0 }],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 0,
              },
            ])
            done()
          }
        )
      })

      it('returns nothing if fromVersion is when is it was deleted', function (done) {
        this.ChunkTranslator.convertToDiffUpdates(
          this.projectId,
          this.chunk,
          'main.tex',
          1,
          3,
          (error, param) => {
            if (param == null) {
              param = {}
            }
            const { initialContent, updates } = param
            expect(error).to.be.null
            expect(initialContent).to.equal('foo' + this.fileContents)
            expect(updates).to.deep.equal([])
            done()
          }
        )
      })

      it('returns an error requesting changes after deleted', function (done) {
        this.ChunkTranslator.convertToDiffUpdates(
          this.projectId,
          this.chunk,
          'main.tex',
          2,
          3,
          error => {
            expect(error.message).to.equal(
              "pathname 'main.tex' not found in range"
            )
            done()
          }
        )
      })
    })

    describe('convertToSummarizedUpdates', function () {
      it('should return a summary which includes the delete', function (done) {
        const assertion = (error, updates) => {
          expect(error).to.be.null
          expect(updates).to.deep.equal([
            {
              pathnames: ['main.tex'],
              project_ops: [],
              meta: {
                users: [this.author1.id],
                start_ts: this.date.getTime(),
                end_ts: this.date.getTime(),
              },
              v: 0,
            },
            {
              pathnames: [],
              project_ops: [
                {
                  remove: {
                    pathname: 'main.tex',
                  },
                },
              ],
              meta: {
                users: [this.author1.id],
                start_ts: this.date.getTime(),
                end_ts: this.date.getTime(),
              },
              v: 1,
            },
            {
              pathnames: ['other.tex'],
              project_ops: [],
              meta: {
                users: [this.author1.id],
                start_ts: this.date.getTime(),
                end_ts: this.date.getTime(),
              },
              v: 2,
            },
          ])
          done()
        }

        this.ChunkTranslator.convertToSummarizedUpdates(this.chunk, assertion)
      })
    })
  })

  describe("with text operations applied to files that don't exist", function (done) {
    beforeEach(function () {
      this.chunk = {
        chunk: {
          startVersion: 0,
          history: {
            snapshot: {
              files: {
                'main.tex': {
                  hash: this.fileHash,
                  stringLength: 42,
                },
              },
            },
            changes: [
              {
                operations: [
                  {
                    pathname: 'not_here.tex',
                    textOperation: [3, 'Hello world'],
                  },
                ],
                timestamp: this.date.toISOString(),
                authors: [this.author1.id, undefined],
              },
            ],
          },
        },
        authors: [this.author1],
      }
    })

    describe('convertToSummarizedUpdates', function () {
      it('should return an empty diff instead of an error', function (done) {
        this.ChunkTranslator.convertToDiffUpdates(
          this.projectId,
          this.chunk,
          'not_here.tex',
          0,
          1,
          (error, result) => {
            expect(error).to.equal(null)
            expect(result.updates.length).to.equal(0)
            done()
          }
        )
      })
    })
  })

  describe("with rename operations applied to files that don't exist", function (done) {
    beforeEach(function () {
      this.chunk = {
        chunk: {
          startVersion: 0,
          history: {
            snapshot: {
              files: {
                'main.tex': {
                  hash: this.fileHash,
                  stringLength: 42,
                },
              },
            },
            changes: [
              {
                operations: [
                  { pathname: 'not_here.tex', newPathname: 'blah.tex' },
                ],
                timestamp: this.date.toISOString(),
                authors: [this.author1.id, undefined],
              },
            ],
          },
        },
        authors: [this.author1],
      }
    })

    describe('convertToSummarizedUpdates', function () {
      it('should return an empty diff instead of an error', function (done) {
        this.ChunkTranslator.convertToDiffUpdates(
          this.projectId,
          this.chunk,
          'not_here.tex',
          0,
          1,
          (error, result) => {
            expect(error).to.equal(null)
            expect(result.updates.length).to.equal(0)
            done()
          }
        )
      })
    })
  })

  describe("with remove operations applied to files that don't exist", function (done) {
    beforeEach(function () {
      this.chunk = {
        chunk: {
          startVersion: 0,
          history: {
            snapshot: {
              files: {
                'main.tex': {
                  hash: this.fileHash,
                  stringLength: 42,
                },
              },
            },
            changes: [
              {
                operations: [{ pathname: 'not_here.tex', newPathname: '' }],
                timestamp: this.date.toISOString(),
                authors: [this.author1.id, undefined],
              },
            ],
          },
        },
        authors: [this.author1],
      }
    })

    describe('convertToSummarizedUpdates', function () {
      it('should return an empty diff instead of an error', function (done) {
        this.ChunkTranslator.convertToDiffUpdates(
          this.projectId,
          this.chunk,
          'not_here.tex',
          0,
          1,
          (error, result) => {
            expect(error).to.equal(null)
            expect(result.updates.length).to.equal(0)
            done()
          }
        )
      })
    })
  })

  describe('with multiple operations in one change', function () {
    beforeEach(function () {
      this.chunk = {
        chunk: {
          startVersion: 0,
          history: {
            snapshot: {
              files: {
                'main.tex': {
                  hash: this.fileHash,
                  stringLength: 42,
                },
                'other.tex': {
                  hash: this.fileHash,
                  stringLength: 42,
                },
                'old.tex': {
                  hash: this.fileHash,
                  stringLength: 42,
                },
                'deleted.tex': {
                  hash: this.fileHash,
                  stringLength: 42,
                },
              },
            },

            changes: [
              {
                operations: [
                  { pathname: 'main.tex', textOperation: ['Hello test, ', -6] },
                  { pathname: 'main.tex', textOperation: [6, 'foo '] },
                  { pathname: 'other.tex', textOperation: [6, 'foo '] },
                  { pathname: 'old.tex', newPathname: 'new.tex' },
                  { pathname: 'deleted.tex', newPathname: '' },
                  {
                    pathname: 'created.tex',
                    file: { hash: this.fileHash, stringLength: 10 },
                  },
                ],
                timestamp: this.date.toISOString(),
                authors: [this.author1.id],
              },
              {
                operations: [{ pathname: 'main.tex', textOperation: [6, -4] }],
                timestamp: this.date.toISOString(),
                authors: [this.author1.id],
              },
            ],
          },
        },
        authors: [this.author1],
      }
    })

    describe('convertToDiffUpdates', function () {
      it('should can return multiple ops from the same version', function (done) {
        this.ChunkTranslator.convertToDiffUpdates(
          this.projectId,
          this.chunk,
          'main.tex',
          0,
          2,
          (error, param) => {
            if (param == null) {
              param = {}
            }
            const { initialContent, updates } = param
            expect(error).to.be.null
            expect(initialContent).to.equal(this.fileContents)
            expect(updates).to.deep.equal([
              {
                op: [
                  { i: 'Hello test, ', p: 0 },
                  { d: 'Hello ', p: 12 },
                ],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 0,
              },
              {
                op: [{ i: 'foo ', p: 6 }],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 0,
              },
              {
                op: [{ d: 'foo ', p: 6 }],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 1,
              },
            ])
            done()
          }
        )
      })

      it('should return the correct initial text if there are previous changes', function (done) {
        this.ChunkTranslator.convertToDiffUpdates(
          this.projectId,
          this.chunk,
          'main.tex',
          1,
          2,
          (error, param) => {
            if (param == null) {
              param = {}
            }
            const { initialContent, updates } = param
            expect(error).to.be.null
            expect(initialContent).to.equal(
              'Hello foo test, world, this is a test'
            )
            expect(updates).to.deep.equal([
              {
                op: [{ d: 'foo ', p: 6 }],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 1,
              },
            ])
            done()
          }
        )
      })
    })

    describe('convertToSummarizedUpdates', function () {
      it('should return a summary of containing multiple changes', function (done) {
        const assertion = (error, updates) => {
          expect(error).to.be.null
          expect(updates).to.deep.equal([
            {
              pathnames: ['main.tex', 'other.tex'],
              project_ops: [
                {
                  rename: {
                    pathname: 'old.tex',
                    newPathname: 'new.tex',
                  },
                },
                {
                  remove: {
                    pathname: 'deleted.tex',
                  },
                },
                {
                  add: {
                    pathname: 'created.tex',
                  },
                },
              ],
              meta: {
                users: [this.author1.id],
                start_ts: this.date.getTime(),
                end_ts: this.date.getTime(),
              },
              v: 0,
            },
            {
              pathnames: ['main.tex'],
              project_ops: [],
              meta: {
                users: [this.author1.id],
                start_ts: this.date.getTime(),
                end_ts: this.date.getTime(),
              },
              v: 1,
            },
          ])
          done()
        }

        this.ChunkTranslator.convertToSummarizedUpdates(this.chunk, assertion)
      })
    })
  })

  describe('with a binary file', function () {
    beforeEach(function () {
      this.chunk = {
        chunk: {
          startVersion: 0,
          history: {
            snapshot: {
              files: {
                'main.tex': {
                  hash: this.fileHash,
                  stringLength: 42,
                },
                'binary.tex': {
                  hash: this.fileHash,
                  byteLength: 42,
                },
              },
            },
            changes: [
              {
                operations: [
                  { pathname: 'main.tex', textOperation: ['Hello test, ', -6] },
                ],
                timestamp: this.date.toISOString(),
                authors: [this.author1.id],
              },
            ],
          },
        },
        authors: [this.author1.id],
      }
    })

    describe('convertToDiffUpdates', function () {
      it('should convert them to a binary diff', function (done) {
        this.ChunkTranslator.convertToDiffUpdates(
          this.projectId,
          this.chunk,
          'binary.tex',
          0,
          1,
          (error, diff) => {
            expect(error).to.be.null
            expect(diff).to.deep.equal({ binary: true })
            done()
          }
        )
      })
    })
  })

  describe('with v2 author ids', function () {
    beforeEach(function () {
      this.chunk = {
        chunk: {
          startVersion: 0,
          history: {
            snapshot: {
              files: {
                'main.tex': {
                  hash: this.fileHash,
                  stringLength: 42,
                },
              },
            },
            changes: [
              {
                operations: [
                  { pathname: 'main.tex', textOperation: ['Hello test, ', -6] },
                ],
                timestamp: this.date.toISOString(),
                v2Authors: [(this.v2AuthorId = '123456789')],
              },
            ],
          },
        },
      }
    })

    describe('convertToDiffUpdates', function () {
      it('should return the v2 author id in the users array', function (done) {
        this.ChunkTranslator.convertToDiffUpdates(
          this.projectId,
          this.chunk,
          'main.tex',
          0,
          1,
          (error, diff) => {
            expect(error).to.be.null
            expect(diff.updates).to.deep.equal([
              {
                op: [
                  { i: 'Hello test, ', p: 0 },
                  { d: 'Hello ', p: 12 },
                ],
                meta: {
                  users: [this.v2AuthorId],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 0,
              },
            ])
            done()
          }
        )
      })
    })

    describe('convertToSummarizedUpdates', function () {
      it('should return the v2 author id in the users array', function (done) {
        const assertion = (error, updateSet) => {
          expect(error).to.be.null
          expect(updateSet).to.deep.equal([
            {
              pathnames: ['main.tex'],
              project_ops: [],
              meta: {
                users: [this.v2AuthorId],
                start_ts: this.date.getTime(),
                end_ts: this.date.getTime(),
              },
              v: 0,
            },
          ])
          done()
        }
        this.ChunkTranslator.convertToSummarizedUpdates(this.chunk, assertion)
      })
    })
  })

  describe('with tracked changes in a file', function () {
    describe('convertToDiffUpdates', function () {
      beforeEach(function () {
        this.rangesHash = 'some_ranges_hash'
        this.fileContents = 'Hello planet world, this is a test'
        this.ranges = JSON.stringify({
          trackedChanges: [
            {
              range: { pos: 6, length: 7 },
              tracking: {
                type: 'delete',
                userId: this.author1.id,
                ts: '2024-01-01T00:00:00.000Z',
              },
            },
          ],
        })
        this.HistoryStoreManager.getProjectBlob
          .withArgs(this.historyId, this.rangesHash)
          .yields(null, this.ranges)
        this.HistoryStoreManager.getProjectBlob
          .withArgs(this.historyId, this.fileHash)
          .yields(null, this.fileContents)
      })

      it('should filter out the tracked deletes that were present in the chunk', function (done) {
        this.chunk = {
          chunk: {
            startVersion: 0,
            history: {
              snapshot: {
                files: {
                  'main.tex': {
                    hash: this.fileHash,
                    rangesHash: this.rangesHash,
                    stringLength: 42,
                  },
                },
              },
              changes: [
                {
                  operations: [
                    {
                      pathname: 'main.tex',
                      textOperation: [
                        // [...] is a tracked delete
                        28, //    Hello [planet ]world, this is |a test
                        -1, //    Hello [planet ]world, this is | test
                        'the', // Hello [planet ]world, this is the| test
                        5, //     Hello [planet ]world, this is the test|
                      ],
                    },
                  ],
                  timestamp: this.date.toISOString(),
                  authors: [this.author1.id],
                },
              ],
            },
          },
          authors: [this.author1.id],
        }

        this.ChunkTranslator.convertToDiffUpdates(
          this.projectId,
          this.chunk,
          'main.tex',
          0,
          1,
          (error, diff) => {
            expect(error).to.be.null
            expect(diff.initialContent).to.equal('Hello world, this is a test')
            expect(diff.updates).to.deep.equal([
              {
                op: [
                  { i: 'the', p: 21 },
                  { d: 'a', p: 24 },
                ],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 0,
              },
            ])
            done()
          }
        )
      })

      it('should filter out tracked deletes across multiple changes', function (done) {
        this.chunk = {
          chunk: {
            startVersion: 0,
            history: {
              snapshot: {
                files: {
                  'main.tex': {
                    hash: this.fileHash,
                    rangesHash: this.rangesHash,
                    stringLength: 42,
                  },
                },
              },
              changes: [
                {
                  operations: [
                    {
                      pathname: 'main.tex',
                      textOperation: [
                        // [...] is a tracked delete
                        28, //    Hello [planet ]world, this is |a test
                        -1, //    Hello [planet ]world, this is | test
                        'the', // Hello [planet ]world, this is the| test
                        5, //     Hello [planet ]world, this is the test|
                      ],
                    },
                    {
                      pathname: 'main.tex',
                      textOperation: [
                        // [...] is a tracked delete
                        22, //    Hello [planet ]world, th|is is the test
                        -2, //    Hello [planet ]world, th| is the test
                        'at', //  Hello [planet ]world, that| is the test
                        12, //    Hello [planet ]world, that is the test|
                      ],
                    },
                  ],
                  timestamp: this.date.toISOString(),
                  authors: [this.author1.id],
                },
              ],
            },
          },
          authors: [this.author1.id],
        }

        this.ChunkTranslator.convertToDiffUpdates(
          this.projectId,
          this.chunk,
          'main.tex',
          0,
          1,
          (error, diff) => {
            expect(error).to.be.null
            expect(diff.initialContent).to.equal('Hello world, this is a test')
            expect(diff.updates).to.deep.equal([
              {
                op: [
                  { i: 'the', p: 21 },
                  { d: 'a', p: 24 },
                ],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 0,
              },
              {
                op: [
                  { i: 'at', p: 15 },
                  { d: 'is', p: 17 },
                ],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 0,
              },
            ])
            done()
          }
        )
      })

      it('should handle tracked delete in the operation', function (done) {
        this.chunk = {
          chunk: {
            startVersion: 0,
            history: {
              snapshot: {
                files: {
                  'main.tex': {
                    hash: this.fileHash,
                    rangesHash: this.rangesHash,
                    stringLength: 42,
                  },
                },
              },
              changes: [
                {
                  operations: [
                    {
                      pathname: 'main.tex',
                      textOperation: [
                        // [...] is a tracked delete
                        5, //  Hello| [planet ]world, this is a test
                        {
                          r: 1,
                          tracking: {
                            type: 'delete',
                            userId: this.author1.id,
                            ts: '2024-01-01T00:00:00.000Z',
                          },
                        }, //  Hello[ ]|[planet ]world, this is test
                        7, //  Hello[ ][planet ]|world, this is the test
                        {
                          r: 5,
                          tracking: {
                            type: 'delete',
                            userId: this.author1.id,
                            ts: '2024-01-01T00:00:00.000Z',
                          },
                        }, //  Hello[ ][planet ][world]|, this is the test
                        18, // Hello[ ][planet ][world], this is the test|
                      ],
                    },
                  ],
                  timestamp: this.date.toISOString(),
                  authors: [this.author1.id],
                },
              ],
            },
          },
          authors: [this.author1.id],
        }

        this.ChunkTranslator.convertToDiffUpdates(
          this.projectId,
          this.chunk,
          'main.tex',
          0,
          1,
          (error, diff) => {
            expect(error).to.be.null
            expect(diff.initialContent).to.equal('Hello world, this is a test')
            expect(diff.updates).to.deep.equal([
              {
                op: [
                  { d: ' ', p: 5 },
                  { d: 'world', p: 5 },
                ],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 0,
              },
            ])
            done()
          }
        )
      })

      it('should filter out tracked deletes in insert operations', function (done) {
        this.chunk = {
          chunk: {
            startVersion: 0,
            history: {
              snapshot: {
                files: {
                  'main.tex': {
                    hash: this.fileHash,
                    rangesHash: this.rangesHash,
                    stringLength: 42,
                  },
                },
              },
              changes: [
                {
                  operations: [
                    {
                      pathname: 'main.tex',
                      textOperation: [
                        // [...] is a tracked delete
                        13, //  Hello [planet ]|world, this is a test
                        {
                          i: 'pluto',
                          tracking: {
                            type: 'delete',
                            userId: this.author1.id,
                            ts: '2024-01-01T00:00:00.000Z',
                          },
                        }, //  Hello [planet pluto]|world, this is a test
                        21, // Hello [planet pluto]world, this is a test|
                      ],
                    },
                  ],
                  timestamp: this.date.toISOString(),
                  authors: [this.author1.id],
                },
              ],
            },
          },
          authors: [this.author1.id],
        }

        this.ChunkTranslator.convertToDiffUpdates(
          this.projectId,
          this.chunk,
          'main.tex',
          0,
          1,
          (error, diff) => {
            expect(error).to.be.null
            expect(diff.initialContent).to.equal('Hello world, this is a test')
            expect(diff.updates).to.deep.equal([
              {
                op: [],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 0,
              },
            ])
            done()
          }
        )
      })

      it('should filter out tracked deletes in delete operations', function (done) {
        this.chunk = {
          chunk: {
            startVersion: 0,
            history: {
              snapshot: {
                files: {
                  'main.tex': {
                    hash: this.fileHash,
                    rangesHash: this.rangesHash,
                    stringLength: 42,
                  },
                },
              },
              changes: [
                {
                  operations: [
                    {
                      pathname: 'main.tex',
                      textOperation: [
                        // [...] is a tracked delete
                        6, //  Hello |[planet ]world, this is a test
                        -3, // Hello [|net ]world, this is a test
                        6, //  Hello [net ]wo|rld, this is a test
                        -3, // Hello [net ]wo|, this is a test
                        16, // Hello [net ]wo, this is a test|
                      ],
                    },
                  ],
                  timestamp: this.date.toISOString(),
                  authors: [this.author1.id],
                },
              ],
            },
          },
          authors: [this.author1.id],
        }

        this.ChunkTranslator.convertToDiffUpdates(
          this.projectId,
          this.chunk,
          'main.tex',
          0,
          1,
          (error, diff) => {
            expect(error).to.be.null
            expect(diff.initialContent).to.equal('Hello world, this is a test')
            expect(diff.updates).to.deep.equal([
              {
                op: [{ d: 'rld', p: 8 }],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 0,
              },
            ])
            done()
          }
        )
      })

      it('should filter out tracked deletes in retain operations', function (done) {
        this.chunk = {
          chunk: {
            startVersion: 0,
            history: {
              snapshot: {
                files: {
                  'main.tex': {
                    hash: this.fileHash,
                    rangesHash: this.rangesHash,
                    stringLength: 42,
                  },
                },
              },
              changes: [
                {
                  operations: [
                    {
                      pathname: 'main.tex',
                      textOperation: [
                        // [...] is a tracked delete
                        4, //  Hell|o [planet ]world, this is a test
                        {
                          r: 4,
                          tracking: { type: 'none' },
                        }, //  Hello pl|[anet ]world, this is a test
                        {
                          r: 3,
                          tracking: {
                            type: 'insert',
                            userId: this.author1.id,
                            ts: '2024-01-01T00:00:00.000Z',
                          },
                        }, //  Hello plane|[t ]world, this is a test
                        23, // Hello plane[t ]world, this is a test|
                      ],
                    },
                  ],
                  timestamp: this.date.toISOString(),
                  authors: [this.author1.id],
                },
              ],
            },
          },
          authors: [this.author1.id],
        }

        this.ChunkTranslator.convertToDiffUpdates(
          this.projectId,
          this.chunk,
          'main.tex',
          0,
          1,
          (error, diff) => {
            expect(error).to.be.null
            expect(diff.initialContent).to.equal('Hello world, this is a test')
            expect(diff.updates).to.deep.equal([
              {
                op: [
                  {
                    i: 'pl',
                    p: 6,
                  },
                  {
                    i: 'ane',
                    p: 8,
                  },
                ],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 0,
              },
            ])
            done()
          }
        )
      })

      it('should report tracked deletion (retains) as deletions', function (done) {
        this.chunk = {
          chunk: {
            startVersion: 0,
            history: {
              snapshot: {
                files: {
                  'main.tex': {
                    hash: this.fileHash,
                    rangesHash: this.rangesHash,
                    stringLength: 42,
                  },
                },
              },
              changes: [
                {
                  operations: [
                    {
                      pathname: 'main.tex',
                      textOperation: [
                        // [...] is a tracked delete
                        {
                          r: 34,
                          tracking: {
                            type: 'delete',
                            userId: this.author1.id,
                            ts: '2024-01-01T00:00:00.000Z',
                          },
                        }, //  [Hello planet world, this is a test]|
                      ],
                    },
                  ],
                  timestamp: this.date.toISOString(),
                  authors: [this.author1.id],
                },
              ],
            },
          },
          authors: [this.author1.id],
        }

        this.ChunkTranslator.convertToDiffUpdates(
          this.projectId,
          this.chunk,
          'main.tex',
          0,
          1,
          (error, diff) => {
            expect(error).to.be.null
            expect(diff.initialContent).to.equal('Hello world, this is a test')
            expect(diff.updates).to.deep.equal([
              {
                op: [
                  {
                    d: 'Hello ',
                    p: 0,
                  },
                  {
                    d: 'world, this is a test',
                    p: 0,
                  },
                ],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 0,
              },
            ])
            done()
          }
        )
      })

      it('should properly create changes when deleting after moved track deletes', function (done) {
        this.chunk = {
          chunk: {
            startVersion: 0,
            history: {
              snapshot: {
                files: {
                  'main.tex': {
                    hash: this.fileHash,
                    stringLength: 34,
                  },
                },
              },
              changes: [
                {
                  operations: [
                    {
                      pathname: 'main.tex',
                      textOperation: [
                        // [...] is a tracked delete
                        // // He[ll]o planet world, this is a test
                        2,
                        {
                          r: 2,
                          tracking: {
                            type: 'delete',
                            userId: this.author1.id,
                            ts: this.date.toISOString(),
                          },
                        },
                        30,
                      ],
                    },
                  ],
                  timestamp: this.date.toISOString(),
                  authors: [this.author1.id],
                },
                {
                  operations: [
                    {
                      pathname: 'main.tex',
                      textOperation: [
                        // [...] is a tracked delete
                        // {...} is a tracked insert
                        // He[ll]o {TEST }planet world, this is a test
                        6,
                        {
                          i: 'TEST ',
                          tracking: {
                            type: 'insert',
                            userId: this.author1.id,
                            ts: this.date.toISOString(),
                          },
                        },
                        28,
                      ],
                    },
                  ],
                  timestamp: this.date.toISOString(),
                  authors: [this.author1.id],
                },
                {
                  operations: [
                    {
                      pathname: 'main.tex',
                      textOperation: [
                        // [...] is a tracked delete
                        // {...} is a tracked insert
                        // He[ll]o {TEST }planet world, [this] is a test
                        25,
                        {
                          r: 4,
                          tracking: {
                            type: 'delete',
                            userId: this.author1.id,
                            ts: this.date.toISOString(),
                          },
                        },
                        10,
                      ],
                    },
                  ],
                  timestamp: this.date.toISOString(),
                  authors: [this.author1.id],
                },
                {
                  operations: [
                    {
                      pathname: 'main.tex',
                      textOperation: [
                        // [...] is a tracked delete
                        // {...} is a tracked insert
                        2, // He|[ll]o {TEST }planet world, [this] is a test
                        -2, // He|o {TEST }planet world, [this] is a test
                        2, // Heo |{TEST }planet world, [this] is a test
                        {
                          r: 5,
                          tracking: { type: 'none' },
                        }, // Heo TEST| planet world, [this] is a test
                        14, // Heo TEST planet world, |[this] is a test
                        -4, // Heo TEST planet world, | is a test
                        10, // Heo TEST planet world,  is a test|
                      ],
                    },
                  ],
                  timestamp: this.date.toISOString(),
                  authors: [this.author1.id],
                },
              ],
            },
          },
          authors: [this.author1.id],
        }

        this.ChunkTranslator.convertToDiffUpdates(
          this.projectId,
          this.chunk,
          'main.tex',
          0,
          4,
          (error, diff) => {
            expect(error).to.be.null
            expect(diff.updates).to.deep.equal([
              {
                op: [
                  {
                    d: 'll',
                    p: 2,
                  },
                ],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 0,
              },
              {
                op: [
                  {
                    i: 'TEST ',
                    p: 4,
                  },
                ],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 1,
              },
              {
                op: [
                  {
                    d: 'this',
                    p: 23,
                  },
                ],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 2,
              },
              {
                op: [],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 3,
              },
            ])
            done()
          }
        )
      })

      it('should properly create changes when retaining after moved track deletes', function (done) {
        this.chunk = {
          chunk: {
            startVersion: 0,
            history: {
              snapshot: {
                files: {
                  'main.tex': {
                    hash: this.fileHash,
                    stringLength: 34,
                  },
                },
              },
              changes: [
                {
                  operations: [
                    {
                      pathname: 'main.tex',
                      textOperation: [
                        // [...] is a tracked delete
                        // // He[ll]o planet world, this is a test
                        2,
                        {
                          r: 2,
                          tracking: {
                            type: 'delete',
                            userId: this.author1.id,
                            ts: this.date.toISOString(),
                          },
                        },
                        30,
                      ],
                    },
                  ],
                  timestamp: this.date.toISOString(),
                  authors: [this.author1.id],
                },
                {
                  operations: [
                    {
                      pathname: 'main.tex',
                      textOperation: [
                        // [...] is a tracked delete
                        // He[ll]o planet world, [this] is a test
                        20,
                        {
                          r: 4,
                          tracking: {
                            type: 'delete',
                            userId: this.author1.id,
                            ts: this.date.toISOString(),
                          },
                        },
                        10,
                      ],
                    },
                  ],
                  timestamp: this.date.toISOString(),
                  authors: [this.author1.id],
                },
                {
                  operations: [
                    {
                      pathname: 'main.tex',
                      textOperation: [
                        // [...] is a tracked delete
                        // {...} is a tracked insert
                        // He[ll]o planet world, [this] {TEST }is a test
                        25,
                        {
                          i: 'TEST ',
                          tracking: {
                            type: 'insert',
                            userId: this.author1.id,
                            ts: this.date.toISOString(),
                          },
                        },
                        9,
                      ],
                    },
                  ],
                  timestamp: this.date.toISOString(),
                  authors: [this.author1.id],
                },
                {
                  operations: [
                    {
                      pathname: 'main.tex',
                      textOperation: [
                        // [...] is a tracked delete
                        // {...} is a tracked insert
                        2, // He|[ll]o planet world, [this] {TEST }is a test
                        -2, // He|o planet world, [this] {TEST }is a test
                        {
                          r: 39,
                          tracking: { type: 'none' },
                        },
                      ], // He|o planet world, this TEST is a test
                    },
                  ],
                  timestamp: this.date.toISOString(),
                  authors: [this.author1.id],
                },
              ],
            },
          },
          authors: [this.author1.id],
        }

        this.ChunkTranslator.convertToDiffUpdates(
          this.projectId,
          this.chunk,
          'main.tex',
          0,
          4,
          (error, diff) => {
            expect(error).to.be.null
            expect(diff.updates).to.deep.equal([
              {
                op: [
                  {
                    d: 'll',
                    p: 2,
                  },
                ],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 0,
              },
              {
                op: [
                  {
                    d: 'this',
                    p: 18,
                  },
                ],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 1,
              },
              {
                op: [
                  {
                    i: 'TEST ',
                    p: 19,
                  },
                ],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 2,
              },
              {
                op: [
                  {
                    i: 'this',
                    p: 18,
                  },
                ],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 3,
              },
            ])
            done()
          }
        )
      })

      it('should handle deletion that starts before tracked delete', function (done) {
        this.chunk = {
          chunk: {
            startVersion: 0,
            history: {
              snapshot: {
                files: {
                  'main.tex': {
                    hash: this.fileHash,
                    stringLength: 34,
                  },
                },
              },
              changes: [
                {
                  operations: [
                    {
                      pathname: 'main.tex',
                      textOperation: [
                        // [...] is a tracked delete
                        // Hello planet world, [this] is a test
                        20,
                        {
                          r: 4,
                          tracking: {
                            type: 'delete',
                            userId: this.author1.id,
                            ts: this.date.toISOString(),
                          },
                        },
                        10,
                      ],
                    },
                  ],
                  timestamp: this.date.toISOString(),
                  authors: [this.author1.id],
                },
                {
                  operations: [
                    {
                      pathname: 'main.tex',
                      textOperation: [
                        // [...] is a tracked delete
                        5, // Hello| planet world, [this] is a test
                        -25, // Hellotest
                        4,
                      ],
                    },
                  ],
                  timestamp: this.date.toISOString(),
                  authors: [this.author1.id],
                },
              ],
            },
          },
          authors: [this.author1.id],
        }

        this.ChunkTranslator.convertToDiffUpdates(
          this.projectId,
          this.chunk,
          'main.tex',
          0,
          2,
          (error, diff) => {
            expect(error).to.be.null
            expect(diff.updates).to.deep.equal([
              {
                op: [
                  {
                    d: 'this',
                    p: 20,
                  },
                ],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 0,
              },
              {
                op: [
                  {
                    d: ' planet world, ',
                    p: 5,
                  },
                  {
                    d: ' is a ',
                    p: 5,
                  },
                ],
                meta: {
                  users: [this.author1.id],
                  start_ts: this.date.getTime(),
                  end_ts: this.date.getTime(),
                },
                v: 1,
              },
            ])
            done()
          }
        )
      })

      describe('whith multiple tracked deletes', function () {
        beforeEach(function () {
          this.fileContents = 'Hello planet world universe, this is a test'
          this.ranges = JSON.stringify({
            trackedChanges: [
              {
                range: { pos: 6, length: 7 },
                tracking: {
                  type: 'delete',
                  userId: this.author1.id,
                  ts: '2024-01-01T00:00:00.000Z',
                },
              },
              {
                range: { pos: 18, length: 9 },
                tracking: {
                  type: 'delete',
                  userId: this.author1.id,
                  ts: '2024-01-01T00:00:00.000Z',
                },
              },
            ],
          })
          this.HistoryStoreManager.getProjectBlob
            .withArgs(this.historyId, this.rangesHash)
            .yields(null, this.ranges)
          this.HistoryStoreManager.getProjectBlob
            .withArgs(this.historyId, this.fileHash)
            .yields(null, this.fileContents)
        })

        it('should handle a deletion that spans multiple tracked deletes', function (done) {
          this.chunk = {
            chunk: {
              startVersion: 0,
              history: {
                snapshot: {
                  files: {
                    'main.tex': {
                      hash: this.fileHash,
                      rangesHash: this.rangesHash,
                      stringLength: this.fileContents.length,
                    },
                  },
                },
                changes: [
                  {
                    operations: [
                      {
                        pathname: 'main.tex',
                        textOperation: [
                          // [...] is a tracked delete
                          6, // Hello |[planet ]world[ universe], this is a test
                          -21, // Hello|, this is a test
                          16,
                        ],
                      },
                    ],
                    timestamp: this.date.toISOString(),
                    authors: [this.author1.id],
                  },
                ],
              },
            },
            authors: [this.author1.id],
          }

          this.ChunkTranslator.convertToDiffUpdates(
            this.projectId,
            this.chunk,
            'main.tex',
            0,
            1,
            (error, diff) => {
              expect(error).to.be.null
              expect(diff.updates).to.deep.equal([
                {
                  op: [
                    {
                      d: 'world',
                      p: 6,
                    },
                  ],
                  meta: {
                    users: [this.author1.id],
                    start_ts: this.date.getTime(),
                    end_ts: this.date.getTime(),
                  },
                  v: 0,
                },
              ])
              done()
            }
          )
        })

        it('should handle a tracked deletion that spans multiple tracked deletes', function (done) {
          this.chunk = {
            chunk: {
              startVersion: 0,
              history: {
                snapshot: {
                  files: {
                    'main.tex': {
                      hash: this.fileHash,
                      rangesHash: this.rangesHash,
                      stringLength: this.fileContents.length,
                    },
                  },
                },
                changes: [
                  {
                    operations: [
                      {
                        pathname: 'main.tex',
                        textOperation: [
                          // [...] is a tracked delete
                          6, // Hello |[planet ]world[ universe], this is a test
                          {
                            r: 21,
                            tracking: {
                              type: 'delete',
                              userId: this.author1.id,
                              ts: '2024-01-01T00:00:00.000Z',
                            },
                          }, // Hello [planet world universe]|, this is a test
                          16,
                        ],
                      },
                    ],
                    timestamp: this.date.toISOString(),
                    authors: [this.author1.id],
                  },
                ],
              },
            },
            authors: [this.author1.id],
          }

          this.ChunkTranslator.convertToDiffUpdates(
            this.projectId,
            this.chunk,
            'main.tex',
            0,
            1,
            (error, diff) => {
              expect(error).to.be.null
              expect(diff.updates).to.deep.equal([
                {
                  op: [
                    {
                      d: 'world',
                      p: 6,
                    },
                  ],
                  meta: {
                    users: [this.author1.id],
                    start_ts: this.date.getTime(),
                    end_ts: this.date.getTime(),
                  },
                  v: 0,
                },
              ])
              done()
            }
          )
        })
      })
    })
  })
})
