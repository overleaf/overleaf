const MockWebApi = require('./helpers/MockWebApi')
const DocUpdaterClient = require('./helpers/DocUpdaterClient')
const DocUpdaterApp = require('./helpers/DocUpdaterApp')
const { promisify } = require('node:util')
const { exec } = require('node:child_process')
const { expect } = require('chai')
const Settings = require('@overleaf/settings')
const { db, ObjectId } = require('../../../app/js/mongodb')

const rclient = require('@overleaf/redis-wrapper').createClient(
  Settings.redis.documentupdater
)
const keys = Settings.redis.documentupdater.key_schema

describe('FlushDocsWithPendingUpdates', function () {
  beforeEach(async function () {
    await DocUpdaterApp.ensureRunning()
    await rclient.flushall()
    await db.docs.deleteMany({})
    // Make sure db.docs is never empty, so that a valid --estimated-docs
    // value exists even in the scenarios that do not insert a doc.
    await db.docs.insertOne({
      _id: new ObjectId(),
      project_id: new ObjectId(),
    })
  })

  async function runScript(args) {
    let result
    try {
      result = await promisify(exec)(
        ['node', 'scripts/flush_docs_with_pending_updates.js']
          .concat(args)
          .join(' ')
      )
    } catch (error) {
      // includes details like exit code, stdErr and stdOut
      return error
    }
    result.code = 0
    return result
  }

  async function getEstimatedDocs() {
    return await db.docs.estimatedDocumentCount()
  }

  async function createStuckDoc({ insertIntoMongo }) {
    const projectId = DocUpdaterClient.randomId()
    const docId = DocUpdaterClient.randomId()
    MockWebApi.insertDoc(projectId, docId, {
      lines: ['one', 'two', 'three'],
      version: 1,
    })
    if (insertIntoMongo) {
      await db.docs.insertOne({
        _id: new ObjectId(docId),
        project_id: new ObjectId(projectId),
      })
    }
    // Simulate the race condition: the doc is no longer loaded in redis, but
    // an update is still queued.
    const update = {
      doc: docId,
      op: [{ i: 'foo ', p: 0 }],
      v: 1,
      meta: { user_id: DocUpdaterClient.randomId(), ts: Date.now() },
    }
    await rclient.rpush(
      keys.pendingUpdates({ doc_id: docId }),
      JSON.stringify(update)
    )
    return { projectId, docId }
  }

  describe('with a stuck doc that exists in mongo', function () {
    let projectId, docId
    beforeEach(async function () {
      ;({ projectId, docId } = await createStuckDoc({ insertIntoMongo: true }))
    })

    it('should apply the pending updates and flush and delete the doc', async function () {
      const result = await runScript([
        `--estimated-docs=${await getEstimatedDocs()}`,
      ])
      expect(result.code).to.equal(0)
      expect(result.stdout).to.include(
        `Flushing doc ${docId} in project ${projectId} with 1 pending updates`
      )
      expect(result.stdout).to.include(
        'Processed 1 docs with pending updates: flushed=1 missing=0 discarded=0 errored=0'
      )

      expect(
        await rclient.exists(keys.pendingUpdates({ doc_id: docId }))
      ).to.equal(0)
      expect(await rclient.exists(keys.docLines({ doc_id: docId }))).to.equal(0)

      const doc = await MockWebApi.getDocument(projectId, docId)
      expect(doc.lines).to.deep.equal(['foo one', 'two', 'three'])
      expect(doc.version).to.equal(2)
    })

    it('should not change anything in dry-run mode', async function () {
      const result = await runScript([
        `--estimated-docs=${await getEstimatedDocs()}`,
        '--dry-run',
      ])
      expect(result.code).to.equal(2)
      expect(result.stdout).to.include(
        `Would flush doc ${docId} in project ${projectId} with 1 pending updates`
      )

      expect(
        await rclient.llen(keys.pendingUpdates({ doc_id: docId }))
      ).to.equal(1)
      expect(await rclient.exists(keys.docLines({ doc_id: docId }))).to.equal(0)
      const doc = await MockWebApi.getDocument(projectId, docId)
      expect(doc.lines).to.deep.equal(['one', 'two', 'three'])
      expect(doc.version).to.equal(1)
    })

    describe('with a second stuck doc', function () {
      let otherDocId
      beforeEach(async function () {
        ;({ docId: otherDocId } = await createStuckDoc({
          insertIntoMongo: true,
        }))
      })

      it('should only process the doc passed via --docId', async function () {
        const result = await runScript([
          `--estimated-docs=${await getEstimatedDocs()}`,
          `--docId=${docId}`,
        ])
        expect(result.code).to.equal(0)
        expect(result.stdout).to.include(
          'Processed 1 docs with pending updates: flushed=1 missing=0 discarded=0 errored=0'
        )

        expect(
          await rclient.exists(keys.pendingUpdates({ doc_id: docId }))
        ).to.equal(0)
        expect(await rclient.exists(keys.docLines({ doc_id: docId }))).to.equal(
          0
        )
        expect(
          await rclient.llen(keys.pendingUpdates({ doc_id: otherDocId }))
        ).to.equal(1)
        expect(
          await rclient.exists(keys.docLines({ doc_id: otherDocId }))
        ).to.equal(0)
      })

      it('should exit non-zero when hitting the scan limit', async function () {
        const result = await runScript([
          `--estimated-docs=${await getEstimatedDocs()}`,
          '--limit=1',
        ])
        expect(result.code).to.equal(2)
        expect(result.stderr).to.include('Hit the scan limit of 1 keys')
      })
    })
  })

  describe('with a stuck doc whose project was hard deleted', function () {
    let projectId, docId
    beforeEach(async function () {
      ;({ projectId, docId } = await createStuckDoc({
        insertIntoMongo: false,
      }))
    })

    it('should log the doc id and leave the queue in place', async function () {
      const result = await runScript([
        `--estimated-docs=${await getEstimatedDocs()}`,
      ])
      expect(result.code).to.equal(2)
      expect(result.stderr).to.include(
        `Doc ${docId} not found in db.docs, pending updates:`
      )
      expect(result.stderr).to.include('foo ')
      expect(result.stderr).to.not.include('unflushed doc keys:')
      expect(result.stdout).to.include(
        'Processed 1 docs with pending updates: flushed=0 missing=1 discarded=0 errored=0'
      )

      expect(
        await rclient.llen(keys.pendingUpdates({ doc_id: docId }))
      ).to.equal(1)
      expect(await rclient.exists(keys.docLines({ doc_id: docId }))).to.equal(0)
    })

    describe('with unflushed changes', function () {
      beforeEach(async function () {
        await rclient.set(keys.unflushedTime({ doc_id: docId }), Date.now())
        await rclient.set(keys.projectKey({ doc_id: docId }), projectId)
        await rclient.set(keys.docLines({ doc_id: docId }), '["unflushed"]')
        await rclient.set(keys.docVersion({ doc_id: docId }), 2)
      })

      it('should log all the doc keys by default', async function () {
        const result = await runScript([
          `--estimated-docs=${await getEstimatedDocs()}`,
        ])
        expect(result.code).to.equal(2)
        expect(result.stderr).to.include(
          `Doc ${docId} not found in db.docs, pending updates:`
        )
        expect(result.stderr).to.include('unflushed doc keys:')
        expect(result.stderr).to.include('unflushed')
        expect(result.stderr).to.include('foo ')
      })

      it('should not log the doc content with --log-unflushed=false', async function () {
        const result = await runScript([
          `--estimated-docs=${await getEstimatedDocs()}`,
          '--log-unflushed=false',
        ])
        expect(result.code).to.equal(2)
        expect(result.stderr).to.include(`Doc ${docId} not found in db.docs`)
        expect(result.stderr).to.not.include('pending updates:')
        expect(result.stderr).to.not.include('unflushed doc keys:')
      })

      it('should log but not discard the doc keys in dry-run mode', async function () {
        const result = await runScript([
          `--estimated-docs=${await getEstimatedDocs()}`,
          '--discard-hard-deleted',
          '--dry-run',
        ])
        expect(result.code).to.equal(2)
        expect(result.stderr).to.include('unflushed doc keys:')
        expect(result.stderr).to.not.include(
          `Discarded redis keys of doc ${docId}`
        )

        expect(
          await rclient.llen(keys.pendingUpdates({ doc_id: docId }))
        ).to.equal(1)
        expect(await rclient.exists(keys.docLines({ doc_id: docId }))).to.equal(
          1
        )
      })
    })

    it('should not log the doc keys when the lines are flushed', async function () {
      // Doc content is present in redis but already flushed: no unflushed time.
      await rclient.set(keys.projectKey({ doc_id: docId }), projectId)
      await rclient.set(keys.docLines({ doc_id: docId }), '["flushed"]')
      await rclient.set(keys.docVersion({ doc_id: docId }), 2)

      const result = await runScript([
        `--estimated-docs=${await getEstimatedDocs()}`,
      ])
      expect(result.code).to.equal(2)
      expect(result.stderr).to.include(
        `Doc ${docId} not found in db.docs, pending updates:`
      )
      expect(result.stderr).to.not.include('unflushed doc keys:')
    })

    it('should remove all the doc keys with --discard-hard-deleted', async function () {
      // Simulate leftovers of a partially loaded doc.
      await rclient.set(keys.projectKey({ doc_id: docId }), projectId)
      await rclient.set(keys.docLines({ doc_id: docId }), '["one"]')
      await rclient.sadd(keys.docsInProject({ project_id: projectId }), docId)
      await rclient.sadd(keys.historyRangesSupport(), docId)

      const result = await runScript([
        `--estimated-docs=${await getEstimatedDocs()}`,
        '--discard-hard-deleted',
      ])
      expect(result.code).to.equal(0)
      expect(result.stderr).to.include(`Discarded redis keys of doc ${docId}`)
      expect(result.stdout).to.include(
        'Processed 1 docs with pending updates: flushed=0 missing=1 discarded=1 errored=0'
      )

      expect(
        await rclient.exists(keys.pendingUpdates({ doc_id: docId }))
      ).to.equal(0)
      expect(await rclient.exists(keys.projectKey({ doc_id: docId }))).to.equal(
        0
      )
      expect(await rclient.exists(keys.docLines({ doc_id: docId }))).to.equal(0)
      expect(
        await rclient.sismember(
          keys.docsInProject({ project_id: projectId }),
          docId
        )
      ).to.equal(0)
      expect(
        await rclient.sismember(keys.historyRangesSupport(), docId)
      ).to.equal(0)
    })

    it('should not discard anything in dry-run mode', async function () {
      const result = await runScript([
        `--estimated-docs=${await getEstimatedDocs()}`,
        '--discard-hard-deleted',
        '--dry-run',
      ])
      expect(result.code).to.equal(2)
      expect(
        await rclient.llen(keys.pendingUpdates({ doc_id: docId }))
      ).to.equal(1)
      expect(await rclient.exists(keys.docLines({ doc_id: docId }))).to.equal(0)
    })

    it('should flush the doc with a --projectId override', async function () {
      const result = await runScript([
        `--estimated-docs=${await getEstimatedDocs()}`,
        `--docId=${docId}`,
        `--projectId=${projectId}`,
      ])
      expect(result.code).to.equal(0)
      expect(result.stdout).to.include(
        'Processed 1 docs with pending updates: flushed=1 missing=0 discarded=0 errored=0'
      )

      expect(
        await rclient.exists(keys.pendingUpdates({ doc_id: docId }))
      ).to.equal(0)
      expect(await rclient.exists(keys.docLines({ doc_id: docId }))).to.equal(0)
      const doc = await MockWebApi.getDocument(projectId, docId)
      expect(doc.lines).to.deep.equal(['foo one', 'two', 'three'])
      expect(doc.version).to.equal(2)
    })
  })

  describe('safety measures', function () {
    let docId
    beforeEach(async function () {
      ;({ docId } = await createStuckDoc({ insertIntoMongo: true }))
    })

    it('should abort without --estimated-docs', async function () {
      const result = await runScript([])
      expect(result.code).to.equal(1)
      expect(result.stderr).to.include(
        '--estimated-docs must be set to a positive integer'
      )
      expect(
        await rclient.llen(keys.pendingUpdates({ doc_id: docId }))
      ).to.equal(1)
      expect(await rclient.exists(keys.docLines({ doc_id: docId }))).to.equal(0)
    })

    it('should abort when --estimated-docs is far off', async function () {
      const estimatedDocs = (await getEstimatedDocs()) * 10
      const result = await runScript([`--estimated-docs=${estimatedDocs}`])
      expect(result.code).to.equal(1)
      expect(result.stderr).to.include('is this the right database?')
      expect(
        await rclient.llen(keys.pendingUpdates({ doc_id: docId }))
      ).to.equal(1)
      expect(await rclient.exists(keys.docLines({ doc_id: docId }))).to.equal(0)
    })

    it('should abort when --projectId is used without --docId', async function () {
      const result = await runScript([
        `--estimated-docs=${await getEstimatedDocs()}`,
        `--projectId=${new ObjectId().toString()}`,
      ])
      expect(result.code).to.equal(1)
      expect(result.stderr).to.include(
        '--projectId can only be used together with --docId'
      )
    })
  })

  describe('without any stuck docs', function () {
    it('should process zero docs', async function () {
      const result = await runScript([
        `--estimated-docs=${await getEstimatedDocs()}`,
      ])
      expect(result.code).to.equal(0)
      expect(result.stdout).to.include(
        'Processed 0 docs with pending updates: flushed=0 missing=0 discarded=0 errored=0'
      )
    })
  })
})
