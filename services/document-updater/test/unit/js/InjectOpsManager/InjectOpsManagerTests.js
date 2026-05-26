const sinon = require('sinon')
const { expect } = require('chai')
const SandboxedModule = require('sandboxed-module')

const modulePath = '../../../../app/js/InjectOpsManager.js'

describe('InjectOpsManager', function () {
  beforeEach(function () {
    this.rpush = sinon.stub().yields(null)
    this.rclient = { rpush: this.rpush }
    this.InjectOpsManager = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/redis-wrapper': {
          createClient: () => this.rclient,
        },
        '@overleaf/settings': {
          redis: {
            documentupdater: {
              key_schema: {
                pendingUpdates({ doc_id: docId }) {
                  return `PendingUpdates:{${docId}}`
                },
              },
            },
          },
          dispatcherCount: 4,
        },
        '@overleaf/promise-utils': {
          promisifyAll: obj => ({
            queueOp: (...args) =>
              new Promise((resolve, reject) => {
                obj.queueOp(...args, (err, result) =>
                  err ? reject(err) : resolve(result)
                )
              }),
          }),
        },
        '@overleaf/o-error': class OError extends Error {
          static tag(err, ...rest) {
            return err
          }
        },
        '@overleaf/logger': { debug: () => {}, warn: () => {}, error: () => {} },
        './Metrics': { summary: () => {} },
      },
    })
  })

  it('rpushes op JSON onto pendingUpdates and a dispatcher shard', async function () {
    await this.InjectOpsManager.promises.queueOp('proj1', 'doc1', {
      op: [{ i: 'hi', p: 0 }],
      v: 7,
      meta: { user_id: 'u1', source: 'claude-sync:abc' },
    })
    expect(this.rpush.callCount).to.equal(2)
    const [pendingKey, json] = this.rpush.firstCall.args
    expect(pendingKey).to.equal('PendingUpdates:{doc1}')
    const update = JSON.parse(json)
    expect(update.doc).to.equal('doc1')
    expect(update.v).to.equal(7)
    expect(update.op).to.deep.equal([{ i: 'hi', p: 0 }])
    expect(update.meta.source).to.equal('claude-sync:abc')

    const [shardKey, docKey] = this.rpush.secondCall.args
    expect(shardKey).to.match(/^pending-updates-list/)
    expect(docKey).to.equal('proj1:doc1')
  })

  it('rejects ops containing null bytes', async function () {
    try {
      await this.InjectOpsManager.promises.queueOp('proj1', 'doc1', {
        op: [{ i: 'with' + String.fromCharCode(0) + 'null', p: 0 }],
        v: 1,
        meta: { source: 's' },
      })
      throw new Error('should have thrown')
    } catch (err) {
      expect(err.message).to.match(/null byte/)
    }
    expect(this.rpush.callCount).to.equal(0)
  })

  it('drops disallowed fields from the queued payload', async function () {
    await this.InjectOpsManager.promises.queueOp('p', 'd', {
      op: [{ i: 'x', p: 0 }],
      v: 1,
      meta: { source: 's' },
      naughty: 'should-not-pass',
    })
    const update = JSON.parse(this.rpush.firstCall.args[1])
    expect(update.naughty).to.equal(undefined)
  })
})
