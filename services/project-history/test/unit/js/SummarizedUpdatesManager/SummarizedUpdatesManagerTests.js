import sinon from 'sinon'
import { expect } from 'chai'
import { strict as esmock } from 'esmock'

const MODULE_PATH = '../../../../app/js/SummarizedUpdatesManager.js'

// A sufficiently large amount of time to make the algorithm process updates
// separately
const LATER = 1000000

describe('SummarizedUpdatesManager', function () {
  beforeEach(async function () {
    this.historyId = 'history-id-123'
    this.projectId = 'project-id-123'
    this.firstChunk = { chunk: { startVersion: 0 } }
    this.secondChunk = { chunk: { startVersion: 1 } }

    this.ChunkTranslator = {
      convertToSummarizedUpdates: sinon.stub(),
    }
    this.HistoryApiManager = {
      shouldUseProjectHistory: sinon.stub().yields(null, true),
    }
    this.HistoryStoreManager = {
      getMostRecentChunk: sinon.stub(),
      getChunkAtVersion: sinon.stub(),
    }
    this.UpdatesProcessor = {
      processUpdatesForProject: sinon.stub().withArgs(this.projectId).yields(),
    }
    this.WebApiManager = {
      getHistoryId: sinon.stub().yields(null, this.historyId),
    }
    this.LabelsManager = {
      getLabels: sinon.stub().yields(null, []),
    }
    this.SummarizedUpdatesManager = await esmock(MODULE_PATH, {
      '../../../../app/js/ChunkTranslator.js': this.ChunkTranslator,
      '../../../../app/js/HistoryApiManager.js': this.HistoryApiManager,
      '../../../../app/js/HistoryStoreManager.js': this.HistoryStoreManager,
      '../../../../app/js/UpdatesProcessor.js': this.UpdatesProcessor,
      '../../../../app/js/WebApiManager.js': this.WebApiManager,
      '../../../../app/js/LabelsManager.js': this.LabelsManager,
    })
    this.callback = sinon.stub()
  })

  describe('getSummarizedProjectUpdates', function () {
    describe('chunk management', function () {
      describe('when there is a single empty chunk', function () {
        setupChunks([[]])
        expectSummaries('returns an empty list of updates', {}, [])
      })

      describe('when there is a single non-empty chunk', function () {
        setupChunks([[makeUpdate()]])
        expectSummaries('returns summarized updates', {}, [makeSummary()])
      })

      describe('when there are multiple chunks', function () {
        setupChunks([
          [makeUpdate({ startTs: 0, v: 1 })],
          [makeUpdate({ startTs: LATER, v: 2 })],
        ])

        describe('and requesting many summaries', function () {
          expectSummaries('returns many update summaries', {}, [
            makeSummary({ startTs: LATER, fromV: 2 }),
            makeSummary({ startTs: 0, fromV: 1 }),
          ])
        })

        describe('and requesting a single summary', function () {
          expectSummaries('returns a single update summary', { min_count: 1 }, [
            makeSummary({ startTs: LATER, fromV: 2 }),
          ])
        })
      })

      describe('when there are too many chunks', function () {
        // Set up 10 chunks
        const chunks = []
        for (let v = 1; v <= 10; v++) {
          chunks.push([
            makeUpdate({
              startTs: v * 100, // values: 100 - 1000
              v, // values: 1 - 10
            }),
          ])
        }
        setupChunks(chunks)

        // Verify that we stop summarizing after 5 chunks
        expectSummaries('summarizes the 5 latest chunks', {}, [
          makeSummary({ startTs: 600, endTs: 1010, fromV: 6, toV: 11 }),
        ])
      })

      describe('when requesting updates before a specific version', function () {
        // Chunk 1 contains 5 updates that were made close to each other and 5
        // other updates that were made later.
        const chunk1 = []
        for (let v = 1; v <= 5; v++) {
          chunk1.push(
            makeUpdate({
              startTs: v * 100, // values: 100 - 500
              v, // values: 1 - 5
            })
          )
        }
        for (let v = 6; v <= 10; v++) {
          chunk1.push(
            makeUpdate({
              startTs: LATER + v * 100, // values: 1000600 - 1001000
              v, // values: 6 - 10
            })
          )
        }

        // Chunk 2 contains 5 updates that were made close to the latest updates in
        // chunk 1.
        const chunk2 = []
        for (let v = 11; v <= 15; v++) {
          chunk2.push(
            makeUpdate({
              startTs: LATER + v * 100, // values: 1001100 - 1001500
              v, // values: 11 - 15
            })
          )
        }
        setupChunks([chunk1, chunk2])

        expectSummaries(
          'summarizes the updates in a single chunk if the chunk is sufficient',
          { before: 14, min_count: 1 },
          [
            makeSummary({
              startTs: LATER + 1100,
              endTs: LATER + 1310,
              fromV: 11,
              toV: 14,
            }),
          ]
        )

        expectSummaries(
          'summarizes the updates in many chunks otherwise',
          { before: 14, min_count: 2 },
          [
            makeSummary({
              startTs: LATER + 600,
              endTs: LATER + 1310,
              fromV: 6,
              toV: 14,
            }),
            makeSummary({
              startTs: 100,
              endTs: 510,
              fromV: 1,
              toV: 6,
            }),
          ]
        )
      })
    })

    describe('update summarization', function () {
      describe('updates that are close in time', function () {
        setupChunks([
          [
            makeUpdate({
              users: ['user1'],
              startTs: 0,
              v: 4,
            }),
            makeUpdate({
              users: ['user2'],
              startTs: 20,
              v: 5,
            }),
          ],
        ])

        expectSummaries('should merge the updates', {}, [
          makeSummary({
            users: ['user1', 'user2'],
            startTs: 0,
            endTs: 30,
            fromV: 4,
            toV: 6,
          }),
        ])
      })

      describe('updates that are far apart in time', function () {
        setupChunks([
          [
            makeUpdate({
              users: ['user1'],
              startTs: 100,
              v: 4,
            }),
            makeUpdate({
              users: ['user2'],
              startTs: LATER,
              v: 5,
            }),
          ],
        ])

        expectSummaries('should not merge the updates', {}, [
          makeSummary({
            users: ['user2'],
            startTs: LATER,
            endTs: LATER + 10,
            fromV: 5,
            toV: 6,
          }),
          makeSummary({
            users: ['user1'],
            startTs: 100,
            endTs: 110,
            fromV: 4,
            toV: 5,
          }),
        ])
      })

      describe('mergeable updates in different chunks', function () {
        setupChunks([
          [
            makeUpdate({
              pathnames: ['main.tex'],
              users: ['user1'],
              startTs: 10,
              v: 4,
            }),
            makeUpdate({
              pathnames: ['main.tex'],
              users: ['user2'],
              startTs: 30,
              v: 5,
            }),
          ],
          [
            makeUpdate({
              pathnames: ['chapter.tex'],
              users: ['user1'],
              startTs: 40,
              v: 6,
            }),
            makeUpdate({
              pathnames: ['chapter.tex'],
              users: ['user1'],
              startTs: 50,
              v: 7,
            }),
          ],
        ])

        expectSummaries('should merge the updates', {}, [
          makeSummary({
            pathnames: ['main.tex', 'chapter.tex'],
            users: ['user1', 'user2'],
            startTs: 10,
            endTs: 60,
            fromV: 4,
            toV: 8,
          }),
        ])
      })

      describe('null user values after regular users', function () {
        setupChunks([
          [
            makeUpdate({
              users: ['user1'],
              startTs: 0,
              v: 4,
            }),
            makeUpdate({
              users: [null],
              startTs: 20,
              v: 5,
            }),
          ],
        ])
        expectSummaries('should include the null values', {}, [
          makeSummary({
            users: [null, 'user1'],
            startTs: 0,
            endTs: 30,
            fromV: 4,
            toV: 6,
          }),
        ])
      })

      describe('null user values before regular users', function () {
        setupChunks([
          [
            makeUpdate({
              users: [null],
              startTs: 0,
              v: 4,
            }),
            makeUpdate({
              users: ['user1'],
              startTs: 20,
              v: 5,
            }),
          ],
        ])
        expectSummaries('should include the null values', {}, [
          makeSummary({
            users: [null, 'user1'],
            startTs: 0,
            endTs: 30,
            fromV: 4,
            toV: 6,
          }),
        ])
      })

      describe('multiple null user values', function () {
        setupChunks([
          [
            makeUpdate({
              users: ['user1'],
              startTs: 10,
              v: 4,
            }),
            makeUpdate({
              users: [null],
              startTs: 20,
              v: 5,
            }),
            makeUpdate({
              users: [null],
              startTs: 70,
              v: 6,
            }),
          ],
        ])
        expectSummaries('should merge the null values', {}, [
          makeSummary({
            users: [null, 'user1'],
            startTs: 10,
            endTs: 80,
            fromV: 4,
            toV: 7,
          }),
        ])
      })

      describe('multiple users', function () {
        setupChunks([
          [
            makeUpdate({
              users: ['user1'],
              startTs: 0,
              v: 4,
            }),
            makeUpdate({
              users: ['user2'],
              startTs: 20,
              v: 5,
            }),
          ],
        ])
        expectSummaries('should merge the users', {}, [
          makeSummary({
            users: ['user1', 'user2'],
            startTs: 0,
            endTs: 30,
            fromV: 4,
            toV: 6,
          }),
        ])
      })

      describe('duplicate updates with the same v1 user', function () {
        setupChunks([
          [
            makeUpdate({
              users: [{ id: 'user1' }],
              startTs: 0,
              v: 4,
            }),
            makeUpdate({
              users: [{ id: 'user1' }],
              startTs: 20,
              v: 5,
            }),
          ],
        ])
        expectSummaries('should deduplicate the users', {}, [
          makeSummary({
            users: [{ id: 'user1' }],
            startTs: 0,
            endTs: 30,
            fromV: 4,
            toV: 6,
          }),
        ])
      })

      describe('duplicate updates with the same v2 user', function () {
        setupChunks([
          [
            makeUpdate({
              users: ['user1'],
              startTs: 0,
              v: 4,
            }),
            makeUpdate({
              users: ['user1'],
              startTs: 20,
              v: 5,
            }),
          ],
        ])
        expectSummaries('should deduplicate the users', {}, [
          makeSummary({
            users: ['user1'],
            startTs: 0,
            endTs: 30,
            fromV: 4,
            toV: 6,
          }),
        ])
      })

      describe('mixed v1 and v2 users with the same id', function () {
        setupChunks([
          [
            makeUpdate({
              users: ['user1'],
              startTs: 0,
              v: 4,
            }),
            makeUpdate({
              users: [{ id: 'user1' }],
              startTs: 20,
              v: 5,
            }),
          ],
        ])
        expectSummaries('should deduplicate the users', {}, [
          makeSummary({
            users: [{ id: 'user1' }],
            startTs: 0,
            endTs: 30,
            fromV: 4,
            toV: 6,
          }),
        ])
      })

      describe('project ops in mergeable updates', function () {
        setupChunks([
          [
            makeUpdate({
              pathnames: [],
              projectOps: [
                { rename: { pathname: 'C.tex', newPathname: 'D.tex' } },
              ],
              users: ['user2'],
              startTs: 0,
              v: 4,
            }),
            makeUpdate({
              pathnames: [],
              projectOps: [
                { rename: { pathname: 'A.tex', newPathname: 'B.tex' } },
              ],
              users: ['user1'],
              startTs: 20,
              v: 5,
            }),
          ],
        ])
        expectSummaries('should merge project ops', {}, [
          makeSummary({
            pathnames: [],
            projectOps: [
              {
                atV: 5,
                rename: {
                  pathname: 'A.tex',
                  newPathname: 'B.tex',
                },
              },
              {
                atV: 4,
                rename: {
                  pathname: 'C.tex',
                  newPathname: 'D.tex',
                },
              },
            ],
            users: ['user1', 'user2'],
            startTs: 0,
            endTs: 30,
            fromV: 4,
            toV: 6,
          }),
        ])
      })

      describe('mergable updates with a mix of project ops and doc ops', function () {
        setupChunks([
          [
            makeUpdate({
              pathnames: ['main.tex'],
              users: ['user1'],
              startTs: 0,
              v: 4,
            }),
            makeUpdate({
              pathnames: [],
              users: ['user2'],
              projectOps: [
                { rename: { pathname: 'A.tex', newPathname: 'B.tex' } },
              ],
              startTs: 20,
              v: 5,
            }),
            makeUpdate({
              pathnames: ['chapter.tex'],
              users: ['user2'],
              startTs: 40,
              v: 6,
            }),
          ],
        ])
        expectSummaries('should keep updates separate', {}, [
          makeSummary({
            pathnames: ['chapter.tex'],
            users: ['user2'],
            startTs: 40,
            fromV: 6,
          }),
          makeSummary({
            pathnames: [],
            users: ['user2'],
            projectOps: [
              { atV: 5, rename: { pathname: 'A.tex', newPathname: 'B.tex' } },
            ],
            startTs: 20,
            fromV: 5,
          }),
          makeSummary({
            pathnames: ['main.tex'],
            users: ['user1'],
            startTs: 0,
            fromV: 4,
          }),
        ])
      })

      describe('label on an update', function () {
        const label = {
          id: 'mock-id',
          comment: 'an example comment',
          version: 5,
        }
        setupChunks([
          [
            makeUpdate({ startTs: 0, v: 3 }),
            makeUpdate({ startTs: 20, v: 4 }),
            makeUpdate({ startTs: 40, v: 5 }),
            makeUpdate({ startTs: 60, v: 6 }),
          ],
        ])
        setupLabels([label])

        expectSummaries('should split the updates at the label', {}, [
          makeSummary({ startTs: 40, endTs: 70, fromV: 5, toV: 7 }),
          makeSummary({
            startTs: 0,
            endTs: 30,
            fromV: 3,
            toV: 5,
            labels: [label],
          }),
        ])
      })

      describe('updates with origin', function () {
        setupChunks([
          [
            makeUpdate({ startTs: 0, v: 1 }),
            makeUpdate({ startTs: 10, v: 2 }),
            makeUpdate({
              startTs: 20,
              v: 3,
              origin: { kind: 'history-resync' },
            }),
            makeUpdate({
              startTs: 30,
              v: 4,
              origin: { kind: 'history-resync' },
            }),
            makeUpdate({ startTs: 40, v: 5 }),
            makeUpdate({ startTs: 50, v: 6 }),
          ],
        ])

        expectSummaries(
          'should split the updates where the origin appears or disappears',
          {},
          [
            makeSummary({ startTs: 40, endTs: 60, fromV: 5, toV: 7 }),
            makeSummary({
              startTs: 20,
              endTs: 40,
              fromV: 3,
              toV: 5,
              origin: { kind: 'history-resync' },
            }),
            makeSummary({ startTs: 0, endTs: 20, fromV: 1, toV: 3 }),
          ]
        )
      })

      describe('updates with different origins', function () {
        setupChunks([
          [
            makeUpdate({ startTs: 0, v: 1, origin: { kind: 'origin-a' } }),
            makeUpdate({ startTs: 10, v: 2, origin: { kind: 'origin-a' } }),
            makeUpdate({ startTs: 20, v: 3, origin: { kind: 'origin-b' } }),
            makeUpdate({ startTs: 30, v: 4, origin: { kind: 'origin-b' } }),
          ],
        ])
        expectSummaries(
          'should split the updates when the origin kind changes',
          {},
          [
            makeSummary({
              startTs: 20,
              endTs: 40,
              fromV: 3,
              toV: 5,
              origin: { kind: 'origin-b' },
            }),
            makeSummary({
              startTs: 0,
              endTs: 20,
              fromV: 1,
              toV: 3,
              origin: { kind: 'origin-a' },
            }),
          ]
        )
      })

      describe('empty updates', function () {
        setupChunks([
          [
            makeUpdate({ startTs: 0, v: 1, pathnames: ['main.tex'] }),
            makeUpdate({ startTs: 10, v: 2, pathnames: [] }),
            makeUpdate({ startTs: 20, v: 3, pathnames: ['main.tex'] }),
            makeUpdate({ startTs: 30, v: 4, pathnames: [] }),
            makeUpdate({ startTs: 40, v: 5, pathnames: [] }),
          ],
          [
            makeUpdate({ startTs: 50, v: 6, pathnames: [] }),
            makeUpdate({ startTs: LATER, v: 7, pathnames: [] }),
            makeUpdate({ startTs: LATER + 10, v: 8, pathnames: ['main.tex'] }),
            makeUpdate({ startTs: LATER + 20, v: 9, pathnames: ['main.tex'] }),
            makeUpdate({ startTs: LATER + 30, v: 10, pathnames: [] }),
          ],
        ])

        expectSummaries('should skip empty updates', {}, [
          makeSummary({
            startTs: LATER + 10,
            endTs: LATER + 30,
            fromV: 8,
            toV: 11,
          }),
          makeSummary({ startTs: 0, endTs: 30, fromV: 1, toV: 8 }),
        ])
      })

      describe('history resync updates', function () {
        setupChunks([
          [
            makeUpdate({
              startTs: 0,
              v: 1,
              origin: { kind: 'history-resync' },
              projectOps: [{ add: { pathname: 'file1.tex' } }],
              pathnames: [],
            }),
            makeUpdate({
              startTs: 20,
              v: 2,
              origin: { kind: 'history-resync' },
              projectOps: [
                { add: { pathname: 'file2.tex' } },
                { add: { pathname: 'file3.tex' } },
              ],
              pathnames: [],
            }),
            makeUpdate({
              startTs: 40,
              v: 3,
              origin: { kind: 'history-resync' },
              projectOps: [{ add: { pathname: 'file4.tex' } }],
              pathnames: [],
            }),
            makeUpdate({
              startTs: 60,
              v: 4,
              origin: { kind: 'history-resync' },
              projectOps: [],
              pathnames: ['file1.tex', 'file2.tex', 'file5.tex'],
            }),
            makeUpdate({
              startTs: 80,
              v: 5,
              origin: { kind: 'history-resync' },
              projectOps: [],
              pathnames: ['file4.tex'],
            }),
            makeUpdate({ startTs: 100, v: 6, pathnames: ['file1.tex'] }),
          ],
        ])
        expectSummaries('should merge creates and edits', {}, [
          makeSummary({
            startTs: 100,
            endTs: 110,
            fromV: 6,
            toV: 7,
            pathnames: ['file1.tex'],
          }),
          makeSummary({
            startTs: 0,
            endTs: 90,
            fromV: 1,
            toV: 6,
            origin: { kind: 'history-resync' },
            pathnames: ['file5.tex'],
            projectOps: [
              { add: { pathname: 'file4.tex' }, atV: 3 },
              { add: { pathname: 'file2.tex' }, atV: 2 },
              { add: { pathname: 'file3.tex' }, atV: 2 },
              { add: { pathname: 'file1.tex' }, atV: 1 },
            ],
          }),
        ])
      })
    })
  })
})

/**
 * Set up mocks as if the project had a number of chunks.
 *
 * Each parameter represents a chunk and the value of the parameter is the list
 * of updates in that chunk.
 */
function setupChunks(updatesByChunk) {
  beforeEach('set up chunks', function () {
    let startVersion = 0
    for (let i = 0; i < updatesByChunk.length; i++) {
      const updates = updatesByChunk[i]
      const chunk = { chunk: { startVersion } }

      // Find the chunk by any update version
      for (const update of updates) {
        this.HistoryStoreManager.getChunkAtVersion
          .withArgs(this.projectId, this.historyId, update.v)
          .yields(null, chunk)
        startVersion = update.v
      }

      if (i === updatesByChunk.length - 1) {
        this.HistoryStoreManager.getMostRecentChunk
          .withArgs(this.projectId, this.historyId)
          .yields(null, chunk)
      }

      this.ChunkTranslator.convertToSummarizedUpdates
        .withArgs(chunk)
        .yields(null, updates)
    }
  })
}

function setupLabels(labels) {
  beforeEach('set up labels', function () {
    this.LabelsManager.getLabels.withArgs(this.projectId).yields(null, labels)
  })
}

function expectSummaries(description, options, expectedSummaries) {
  it(`${description}`, function (done) {
    this.SummarizedUpdatesManager.getSummarizedProjectUpdates(
      this.projectId,
      options,
      (err, summaries) => {
        if (err) {
          return done(err)
        }

        // The order of the users array is not significant
        for (const summary of summaries) {
          summary.meta.users.sort()
        }
        for (const summary of expectedSummaries) {
          summary.meta.users.sort()
        }

        expect(summaries).to.deep.equal(expectedSummaries)
        done()
      }
    )
  })
}

function makeUpdate(options = {}) {
  const {
    pathnames = ['main.tex'],
    users = ['user1'],
    projectOps = [],
    startTs = 0,
    endTs = startTs + 10,
    v = 1,
    origin,
  } = options
  const update = {
    pathnames,
    project_ops: projectOps,
    meta: { users, start_ts: startTs, end_ts: endTs },
    v,
  }
  if (origin) {
    update.meta.origin = origin
  }
  return update
}

function makeSummary(options = {}) {
  const {
    pathnames = ['main.tex'],
    users = ['user1'],
    startTs = 0,
    endTs = startTs + 10,
    fromV = 1,
    toV = fromV + 1,
    labels = [],
    projectOps = [],
    origin,
  } = options
  const summary = {
    pathnames: new Set(pathnames),
    meta: {
      users,
      start_ts: startTs,
      end_ts: endTs,
    },
    fromV,
    toV,
    labels,
    project_ops: projectOps,
  }
  if (origin) {
    summary.meta.origin = origin
  }
  return summary
}
