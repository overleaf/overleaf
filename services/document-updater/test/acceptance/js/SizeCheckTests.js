const { expect } = require('chai')
const { setTimeout } = require('node:timers/promises')
const Settings = require('@overleaf/settings')

const MockWebApi = require('./helpers/MockWebApi')
const DocUpdaterClient = require('./helpers/DocUpdaterClient')
const DocUpdaterApp = require('./helpers/DocUpdaterApp')
const { RequestFailedError } = require('@overleaf/fetch-utils')

describe('SizeChecks', function () {
  before(async function () {
    await DocUpdaterApp.ensureRunning()
  })
  beforeEach(function () {
    this.version = 0
    this.update = {
      doc: this.doc_id,
      op: [
        {
          i: 'insert some more lines that will bring it above the limit\n',
          p: 42,
        },
      ],
      v: this.version,
    }
    this.project_id = DocUpdaterClient.randomId()
    this.doc_id = DocUpdaterClient.randomId()
  })

  describe('when a doc is above the doc size limit already', function () {
    beforeEach(function () {
      this.lines = ['x'.repeat(Settings.max_doc_length)] // including the extra newline, this will be over the limit
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        v: this.version,
      })
    })

    it('should error when fetching the doc', async function () {
      await expect(DocUpdaterClient.getDoc(this.project_id, this.doc_id))
        .to.be.rejectedWith(RequestFailedError)
        .and.eventually.have.nested.property('response.status', 500)
    })

    describe('when trying to update', function () {
      beforeEach(async function () {
        const update = {
          doc: this.doc_id,
          op: this.update.op,
          v: this.version,
        }
        await DocUpdaterClient.sendUpdate(this.project_id, this.doc_id, update)
        await setTimeout(200)
      })

      it('should still error when fetching the doc', async function () {
        await expect(DocUpdaterClient.getDoc(this.project_id, this.doc_id))
          .to.be.rejectedWith(RequestFailedError)
          .and.eventually.have.nested.property('response.status', 500)
      })
    })
  })

  describe('when the stringified JSON is above the doc size limit but the doc character count is not', function () {
    beforeEach(function () {
      let charsRemaining = Settings.max_doc_length
      this.lines = []
      // Take the maximum allowed doc length and split it into N lines of 63 characters + a newline.
      // The character count will be exactly max_doc_length
      // The JSON stringified size will exceed max_doc_length, due to the JSON formatting of the array.
      // This document should be allowed, because we use the character count as the limit, not the JSON size.
      while (charsRemaining > 0) {
        const charstoAdd = Math.min(charsRemaining - 1, 63) // allow for additional newline
        this.lines.push('x'.repeat(charstoAdd))
        charsRemaining -= charstoAdd + 1
      }
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        v: this.version,
      })
    })

    it('should be able to fetch the doc', async function () {
      const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
      expect(doc.lines).to.deep.equal(this.lines)
    })

    describe('when trying to update', function () {
      beforeEach(async function () {
        const update = {
          doc: this.doc_id,
          op: this.update.op,
          v: this.version,
        }
        await DocUpdaterClient.sendUpdate(this.project_id, this.doc_id, update)
        await setTimeout(200)
      })

      it('should not update the doc', async function () {
        const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
        expect(doc.lines).to.deep.equal(this.lines)
      })
    })
  })

  describe('when a doc is just below the doc size limit', function () {
    beforeEach(function () {
      this.lines = ['x'.repeat(Settings.max_doc_length - 1)] // character count is exactly max_doc_length after including the newline
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        v: this.version,
      })
    })

    it('should be able to fetch the doc', async function () {
      const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
      expect(doc.lines).to.deep.equal(this.lines)
    })

    describe('when trying to update', function () {
      beforeEach(async function () {
        const update = {
          doc: this.doc_id,
          op: this.update.op,
          v: this.version,
        }
        await DocUpdaterClient.sendUpdate(this.project_id, this.doc_id, update)
        await setTimeout(200)
      })

      it('should not update the doc', async function () {
        const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
        expect(doc.lines).to.deep.equal(this.lines)
      })
    })
  })
})
