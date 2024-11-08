const MockWebApi = require('./helpers/MockWebApi')
const DocUpdaterClient = require('./helpers/DocUpdaterClient')
const DocUpdaterApp = require('./helpers/DocUpdaterApp')
const { promisify } = require('node:util')
const { exec } = require('node:child_process')
const { expect } = require('chai')
const Settings = require('@overleaf/settings')
const fs = require('node:fs')
const Path = require('node:path')
const MockDocstoreApi = require('./helpers/MockDocstoreApi')
const sinon = require('sinon')

const rclient = require('@overleaf/redis-wrapper').createClient(
  Settings.redis.documentupdater
)

describe('CheckRedisMongoSyncState', function () {
  beforeEach(function (done) {
    DocUpdaterApp.ensureRunning(done)
  })
  beforeEach(async function () {
    await rclient.flushall()
  })

  let peekDocumentInDocstore
  beforeEach(function () {
    peekDocumentInDocstore = sinon.spy(MockDocstoreApi, 'peekDocument')
  })
  afterEach(function () {
    peekDocumentInDocstore.restore()
  })

  async function runScript(options) {
    let result
    try {
      result = await promisify(exec)(
        Object.entries(options)
          .map(([key, value]) => `${key}=${value}`)
          .concat(['node', 'scripts/check_redis_mongo_sync_state.js'])
          .join(' ')
      )
    } catch (error) {
      // includes details like exit code, stdErr and stdOut
      return error
    }
    result.code = 0
    return result
  }

  describe('without projects', function () {
    it('should work when in sync', async function () {
      const result = await runScript({})
      expect(result.code).to.equal(0)
      expect(result.stdout).to.include('Processed 0 projects')
      expect(result.stdout).to.include(
        'Found 0 projects with 0 out of sync docs'
      )
    })
  })

  describe('with a project', function () {
    let projectId, docId
    beforeEach(function (done) {
      projectId = DocUpdaterClient.randomId()
      docId = DocUpdaterClient.randomId()
      MockWebApi.insertDoc(projectId, docId, {
        lines: ['mongo', 'lines'],
        version: 1,
      })
      DocUpdaterClient.getDoc(projectId, docId, done)
    })

    it('should work when in sync', async function () {
      const result = await runScript({})
      expect(result.code).to.equal(0)
      expect(result.stdout).to.include('Processed 1 projects')
      expect(result.stdout).to.include(
        'Found 0 projects with 0 out of sync docs'
      )

      expect(peekDocumentInDocstore).to.not.have.been.called
    })

    describe('with out of sync lines', function () {
      beforeEach(function () {
        MockWebApi.insertDoc(projectId, docId, {
          lines: ['updated', 'mongo', 'lines'],
          version: 1,
        })
      })

      it('should detect the out of sync state', async function () {
        const result = await runScript({})
        expect(result.code).to.equal(1)
        expect(result.stdout).to.include('Processed 1 projects')
        expect(result.stdout).to.include(
          'Found 1 projects with 1 out of sync docs'
        )
      })
    })

    describe('with out of sync ranges', function () {
      beforeEach(function () {
        MockWebApi.insertDoc(projectId, docId, {
          lines: ['mongo', 'lines'],
          version: 1,
          ranges: { changes: ['FAKE CHANGE'] },
        })
      })

      it('should detect the out of sync state', async function () {
        const result = await runScript({})
        expect(result.code).to.equal(1)
        expect(result.stdout).to.include('Processed 1 projects')
        expect(result.stdout).to.include(
          'Found 1 projects with 1 out of sync docs'
        )
      })
    })

    describe('with out of sync version', function () {
      beforeEach(function () {
        MockWebApi.insertDoc(projectId, docId, {
          lines: ['mongo', 'lines'],
          version: 2,
        })
      })

      it('should detect the out of sync state', async function () {
        const result = await runScript({})
        expect(result.code).to.equal(1)
        expect(result.stdout).to.include('Processed 1 projects')
        expect(result.stdout).to.include(
          'Found 1 projects with 1 out of sync docs'
        )
      })

      it('should auto-fix the out of sync state', async function () {
        const result = await runScript({
          AUTO_FIX_VERSION_MISMATCH: 'true',
        })
        expect(result.code).to.equal(0)
        expect(result.stdout).to.include('Processed 1 projects')
        expect(result.stdout).to.include(
          'Found 0 projects with 0 out of sync docs'
        )
      })
    })

    describe('with a project', function () {
      let projectId2, docId2
      beforeEach(function (done) {
        projectId2 = DocUpdaterClient.randomId()
        docId2 = DocUpdaterClient.randomId()
        MockWebApi.insertDoc(projectId2, docId2, {
          lines: ['mongo', 'lines'],
          version: 1,
        })
        DocUpdaterClient.getDoc(projectId2, docId2, done)
      })

      it('should work when in sync', async function () {
        const result = await runScript({})
        expect(result.code).to.equal(0)
        expect(result.stdout).to.include('Processed 2 projects')
        expect(result.stdout).to.include(
          'Found 0 projects with 0 out of sync docs'
        )
      })

      describe('with one out of sync', function () {
        beforeEach(function () {
          MockWebApi.insertDoc(projectId, docId, {
            lines: ['updated', 'mongo', 'lines'],
            version: 1,
          })
        })

        it('should detect one project out of sync', async function () {
          const result = await runScript({})
          expect(result.code).to.equal(1)
          expect(result.stdout).to.include('Processed 2 projects')
          expect(result.stdout).to.include(
            'Found 1 projects with 1 out of sync docs'
          )
        })

        it('should write differences to disk', async function () {
          const FOLDER = '/tmp/folder'
          await fs.promises.rm(FOLDER, { recursive: true, force: true })
          const result = await runScript({
            WRITE_CONTENT: 'true',
            FOLDER,
          })
          expect(result.code).to.equal(1)
          expect(result.stdout).to.include('Processed 2 projects')
          expect(result.stdout).to.include(
            'Found 1 projects with 1 out of sync docs'
          )

          const dir = Path.join(FOLDER, projectId, docId)
          expect(await fs.promises.readdir(FOLDER)).to.deep.equal([projectId])
          expect(await fs.promises.readdir(dir)).to.deep.equal([
            'mongo-snapshot.txt',
            'redis-snapshot.txt',
          ])
          expect(
            await fs.promises.readFile(
              Path.join(dir, 'mongo-snapshot.txt'),
              'utf-8'
            )
          ).to.equal('updated\nmongo\nlines')
          expect(
            await fs.promises.readFile(
              Path.join(dir, 'redis-snapshot.txt'),
              'utf-8'
            )
          ).to.equal('mongo\nlines')
        })
      })

      describe('with both out of sync', function () {
        beforeEach(function () {
          MockWebApi.insertDoc(projectId, docId, {
            lines: ['updated', 'mongo', 'lines'],
            version: 1,
          })
          MockWebApi.insertDoc(projectId2, docId2, {
            lines: ['updated2', 'mongo', 'lines'],
            version: 1,
          })
        })

        it('should detect both projects out of sync', async function () {
          const result = await runScript({})
          expect(result.code).to.equal(1)
          expect(result.stdout).to.include('Processed 2 projects')
          expect(result.stdout).to.include(
            'Found 2 projects with 2 out of sync docs'
          )
        })
      })
    })
  })

  describe('with more projects than the LIMIT', function () {
    for (let i = 0; i < 20; i++) {
      beforeEach(function (done) {
        const projectId = DocUpdaterClient.randomId()
        const docId = DocUpdaterClient.randomId()
        MockWebApi.insertDoc(projectId, docId, {
          lines: ['mongo', 'lines'],
          version: 1,
        })
        DocUpdaterClient.getDoc(projectId, docId, done)
      })
    }

    it('should flag limit', async function () {
      const result = await runScript({ LIMIT: '4' })
      expect(result.code).to.equal(2)
      // A redis SCAN may return more than COUNT (aka LIMIT) entries. Match loosely.
      expect(result.stdout).to.match(/Processed \d+ projects/)
      expect(result.stderr).to.include(
        'Found too many un-flushed projects (LIMIT=4). Please fix the reported projects first, then try again.'
      )
    })

    it('should continue with auto-flush', async function () {
      const result = await runScript({
        LIMIT: '4',
        FLUSH_IN_SYNC_PROJECTS: 'true',
      })
      expect(result.code).to.equal(0)
      expect(result.stdout).to.include('Processed 20 projects')
    })
  })

  describe('with partially deleted doc', function () {
    let projectId, docId
    beforeEach(function (done) {
      projectId = DocUpdaterClient.randomId()
      docId = DocUpdaterClient.randomId()
      MockWebApi.insertDoc(projectId, docId, {
        lines: ['mongo', 'lines'],
        version: 1,
      })
      MockDocstoreApi.insertDoc(projectId, docId, {
        lines: ['mongo', 'lines'],
        version: 1,
      })
      DocUpdaterClient.getDoc(projectId, docId, err => {
        MockWebApi.clearDocs()
        done(err)
      })
    })
    describe('with only the file-tree entry deleted', function () {
      it('should flag the partial deletion', async function () {
        const result = await runScript({})
        expect(result.code).to.equal(0)
        expect(result.stdout).to.include('Processed 1 projects')
        expect(result.stdout).to.include(
          `Found partially deleted doc ${docId} in project ${projectId}: use AUTO_FIX_PARTIALLY_DELETED_DOC_METADATA=true to fix metadata`
        )
        expect(result.stdout).to.include(
          'Found 0 projects with 0 out of sync docs'
        )
        expect(MockDocstoreApi.getDoc(projectId, docId)).to.not.include({
          deleted: true,
          name: 'c.tex',
        })
        expect(peekDocumentInDocstore).to.have.been.called
      })
      it('should autofix the partial deletion', async function () {
        const result = await runScript({
          AUTO_FIX_PARTIALLY_DELETED_DOC_METADATA: 'true',
        })
        expect(result.code).to.equal(0)
        expect(result.stdout).to.include('Processed 1 projects')
        expect(result.stdout).to.include(
          `Found partially deleted doc ${docId} in project ${projectId}: fixing metadata`
        )
        expect(result.stdout).to.include(
          'Found 0 projects with 0 out of sync docs'
        )

        expect(MockDocstoreApi.getDoc(projectId, docId)).to.include({
          deleted: true,
          name: 'c.tex',
        })

        const result2 = await runScript({})
        expect(result2.code).to.equal(0)
        expect(result2.stdout).to.include('Processed 1 projects')
        expect(result2.stdout).to.not.include(
          `Found partially deleted doc ${docId} in project ${projectId}`
        )
        expect(result2.stdout).to.include(
          'Found 0 projects with 0 out of sync docs'
        )
      })
    })
    describe('with docstore metadata updated', function () {
      beforeEach(function (done) {
        MockDocstoreApi.patchDocument(
          projectId,
          docId,
          {
            deleted: true,
            deletedAt: new Date(),
            name: 'c.tex',
          },
          done
        )
      })

      it('should work when in sync', async function () {
        const result = await runScript({})
        expect(result.code).to.equal(0)
        expect(result.stdout).to.include('Processed 1 projects')
        expect(result.stdout).to.not.include(
          `Found partially deleted doc ${docId} in project ${projectId}`
        )
        expect(result.stdout).to.include(
          'Found 0 projects with 0 out of sync docs'
        )
        expect(peekDocumentInDocstore).to.have.been.called
      })
    })
  })
})
