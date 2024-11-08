/* eslint-disable
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS202: Simplify dynamic range loops
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const DocUpdaterClient = require('../../acceptance/js/helpers/DocUpdaterClient')
// MockWebApi = require "../../acceptance/js/helpers/MockWebApi"
const assert = require('node:assert')
const async = require('async')

const insert = function (string, pos, content) {
  const result = string.slice(0, pos) + content + string.slice(pos)
  return result
}

const transform = function (op1, op2) {
  if (op2.p < op1.p) {
    return {
      p: op1.p + op2.i.length,
      i: op1.i,
    }
  } else {
    return op1
  }
}

class StressTestClient {
  constructor(options) {
    if (options == null) {
      options = {}
    }
    this.options = options
    if (this.options.updateDelay == null) {
      this.options.updateDelay = 200
    }
    this.project_id = this.options.project_id || DocUpdaterClient.randomId()
    this.doc_id = this.options.doc_id || DocUpdaterClient.randomId()
    this.pos = this.options.pos || 0
    this.content = this.options.content || ''

    this.client_id = DocUpdaterClient.randomId()
    this.version = this.options.version || 0
    this.inflight_op = null
    this.charCode = 0

    this.counts = {
      conflicts: 0,
      local_updates: 0,
      remote_updates: 0,
      max_delay: 0,
    }

    DocUpdaterClient.subscribeToAppliedOps((channel, update) => {
      update = JSON.parse(update)
      if (update.error != null) {
        console.error(new Error(`Error from server: '${update.error}'`))
        return
      }
      if (update.doc_id === this.doc_id) {
        return this.processReply(update)
      }
    })
  }

  sendUpdate() {
    const data = String.fromCharCode(65 + (this.charCode++ % 26))
    this.content = insert(this.content, this.pos, data)
    this.inflight_op = {
      i: data,
      p: this.pos++,
    }
    this.resendUpdate()
    return (this.inflight_op_sent = Date.now())
  }

  resendUpdate() {
    assert(this.inflight_op != null)
    DocUpdaterClient.sendUpdate(this.project_id, this.doc_id, {
      doc: this.doc_id,
      op: [this.inflight_op],
      v: this.version,
      meta: {
        source: this.client_id,
      },
      dupIfSource: [this.client_id],
    })
    return (this.update_timer = setTimeout(() => {
      console.log(
        `[${new Date()}] \t[${this.client_id.slice(
          0,
          4
        )}] WARN: Resending update after 5 seconds`
      )
      return this.resendUpdate()
    }, 5000))
  }

  processReply(update) {
    if (update.op.v !== this.version) {
      if (update.op.v < this.version) {
        console.log(
          `[${new Date()}] \t[${this.client_id.slice(
            0,
            4
          )}] WARN: Duplicate ack (already seen version)`
        )
        return
      } else {
        console.error(
          `[${new Date()}] \t[${this.client_id.slice(
            0,
            4
          )}] ERROR: Version jumped ahead (client: ${this.version}, op: ${
            update.op.v
          })`
        )
      }
    }
    this.version++
    if (update.op.meta.source === this.client_id) {
      if (this.inflight_op != null) {
        this.counts.local_updates++
        this.inflight_op = null
        clearTimeout(this.update_timer)
        const delay = Date.now() - this.inflight_op_sent
        this.counts.max_delay = Math.max(this.counts.max_delay, delay)
        return this.continue()
      } else {
        return console.log(
          `[${new Date()}] \t[${this.client_id.slice(
            0,
            4
          )}] WARN: Duplicate ack`
        )
      }
    } else {
      assert(update.op.op.length === 1)
      this.counts.remote_updates++
      let externalOp = update.op.op[0]
      if (this.inflight_op != null) {
        this.counts.conflicts++
        this.inflight_op = transform(this.inflight_op, externalOp)
        externalOp = transform(externalOp, this.inflight_op)
      }
      if (externalOp.p < this.pos) {
        this.pos += externalOp.i.length
      }
      return (this.content = insert(this.content, externalOp.p, externalOp.i))
    }
  }

  continue() {
    if (this.updateCount > 0) {
      this.updateCount--
      return setTimeout(
        () => {
          return this.sendUpdate()
        },
        this.options.updateDelay * (0.5 + Math.random())
      )
    } else {
      return this.updateCallback()
    }
  }

  runForNUpdates(n, callback) {
    if (callback == null) {
      callback = function () {}
    }
    this.updateCallback = callback
    this.updateCount = n
    return this.continue()
  }

  check(callback) {
    if (callback == null) {
      callback = function () {}
    }
    return DocUpdaterClient.getDoc(
      this.project_id,
      this.doc_id,
      (error, res, body) => {
        if (error != null) {
          throw error
        }
        if (body.lines == null) {
          return console.error(
            `[${new Date()}] \t[${this.client_id.slice(
              0,
              4
            )}] ERROR: Invalid response from get doc (${this.doc_id})`,
            body
          )
        }
        const content = body.lines.join('\n')
        const { version } = body
        if (content !== this.content) {
          if (version === this.version) {
            console.error(
              `[${new Date()}] \t[${this.client_id.slice(
                0,
                4
              )}] Error: Client content does not match server.`
            )
            console.error(`Server: ${content.split('a')}`)
            console.error(`Client: ${this.content.split('a')}`)
          } else {
            console.error(
              `[${new Date()}] \t[${this.client_id.slice(
                0,
                4
              )}] Error: Version mismatch (Server: '${version}', Client: '${
                this.version
              }')`
            )
          }
        }

        if (!this.isContentValid(this.content)) {
          const iterable = this.content.split('')
          for (let i = 0; i < iterable.length; i++) {
            const chunk = iterable[i]
            if (chunk != null && chunk !== 'a') {
              console.log(chunk, i)
            }
          }
          throw new Error('bad content')
        }
        return callback()
      }
    )
  }

  isChunkValid(chunk) {
    const char = 0
    for (let i = 0; i < chunk.length; i++) {
      const letter = chunk[i]
      if (letter.charCodeAt(0) !== 65 + (i % 26)) {
        console.error(
          `[${new Date()}] \t[${this.client_id.slice(0, 4)}] Invalid Chunk:`,
          chunk
        )
        return false
      }
    }
    return true
  }

  isContentValid(content) {
    for (const chunk of Array.from(content.split('a'))) {
      if (chunk != null && chunk !== '') {
        if (!this.isChunkValid(chunk)) {
          console.error(
            `[${new Date()}] \t[${this.client_id.slice(0, 4)}] Invalid content`,
            content
          )
          return false
        }
      }
    }
    return true
  }
}

const checkDocument = function (projectId, docId, clients, callback) {
  if (callback == null) {
    callback = function () {}
  }
  const jobs = clients.map(client => cb => client.check(cb))
  return async.parallel(jobs, callback)
}

const printSummary = function (docId, clients) {
  const slot = require('cluster-key-slot')
  const now = new Date()
  console.log(
    `[${now}] [${docId.slice(0, 4)} (slot: ${slot(docId)})] ${
      clients.length
    } clients...`
  )
  return (() => {
    const result = []
    for (const client of Array.from(clients)) {
      console.log(
        `[${now}] \t[${client.client_id.slice(0, 4)}] { local: ${
          client.counts.local_updates
        }, remote: ${client.counts.remote_updates}, conflicts: ${
          client.counts.conflicts
        }, max_delay: ${client.counts.max_delay} }`
      )
      result.push(
        (client.counts = {
          local_updates: 0,
          remote_updates: 0,
          conflicts: 0,
          max_delay: 0,
        })
      )
    }
    return result
  })()
}

const CLIENT_COUNT = parseInt(process.argv[2], 10)
const UPDATE_DELAY = parseInt(process.argv[3], 10)
const SAMPLE_INTERVAL = parseInt(process.argv[4], 10)

for (const docAndProjectId of Array.from(process.argv.slice(5))) {
  ;(function (docAndProjectId) {
    const [projectId, docId] = Array.from(docAndProjectId.split(':'))
    console.log({ projectId, docId })
    return DocUpdaterClient.setDocLines(
      projectId,
      docId,
      [new Array(CLIENT_COUNT + 2).join('a')],
      null,
      null,
      error => {
        if (error != null) {
          throw error
        }
        return DocUpdaterClient.getDoc(projectId, docId, (error, res, body) => {
          let runBatch
          if (error != null) {
            throw error
          }
          if (body.lines == null) {
            return console.error(
              `[${new Date()}] ERROR: Invalid response from get doc (${docId})`,
              body
            )
          }
          const content = body.lines.join('\n')
          const { version } = body

          const clients = []
          for (
            let pos = 1, end = CLIENT_COUNT, asc = end >= 1;
            asc ? pos <= end : pos >= end;
            asc ? pos++ : pos--
          ) {
            ;(function (pos) {
              const client = new StressTestClient({
                doc_id: docId,
                project_id: projectId,
                content,
                pos,
                version,
                updateDelay: UPDATE_DELAY,
              })
              return clients.push(client)
            })(pos)
          }

          return (runBatch = function () {
            const jobs = clients.map(
              client => cb =>
                client.runForNUpdates(SAMPLE_INTERVAL / UPDATE_DELAY, cb)
            )
            return async.parallel(jobs, error => {
              if (error != null) {
                throw error
              }
              printSummary(docId, clients)
              return checkDocument(projectId, docId, clients, error => {
                if (error != null) {
                  throw error
                }
                return runBatch()
              })
            })
          })()
        })
      }
    )
  })(docAndProjectId)
}
