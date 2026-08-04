import mongodb from 'mongodb-legacy'
import { expectValidationError } from '@overleaf/validation-tools/testUtils.js'
import DocstoreApp from './helpers/DocstoreApp.js'
import DocstoreClient from './helpers/DocstoreClient.js'

const { ObjectId } = mongodb

describe('Applying updates to a doc', function () {
  beforeEach(async function () {
    this.project_id = new ObjectId()
    this.doc_id = new ObjectId()
    this.originalLines = ['original', 'lines', '$1.00', '$foo']
    this.newLines = ['new', 'lines', '$2.00', '$bar']
    this.originalRanges = {
      changes: [
        {
          id: new ObjectId().toString(),
          op: { i: '$foo', p: 3 },
          metadata: {
            user_id: new ObjectId().toString(),
            ts: new Date().toISOString(),
          },
        },
      ],
    }
    this.newRanges = {
      changes: [
        {
          id: new ObjectId().toString(),
          op: { i: '$bar', p: 6 },
          metadata: {
            user_id: new ObjectId().toString(),
            ts: new Date().toISOString(),
          },
        },
      ],
    }

    this.version = 42
    await DocstoreApp.ensureRunning()
    await DocstoreClient.createDoc(
      this.project_id,
      this.doc_id,
      this.originalLines,
      this.version,
      this.originalRanges
    )
  })

  describe('when nothing has been updated', function () {
    beforeEach(async function () {
      this.body = await DocstoreClient.updateDoc(
        this.project_id,
        this.doc_id,
        this.originalLines,
        this.version,
        this.originalRanges
      )
    })

    it('should return modified = false', function () {
      this.body.modified.should.equal(false)
    })

    it('should not update the doc in the API', async function () {
      const doc = await DocstoreClient.getDoc(this.project_id, this.doc_id)
      doc.lines.should.deep.equal(this.originalLines)
      doc.version.should.equal(this.version)
      doc.ranges.should.deep.equal(this.originalRanges)
    })
  })

  describe('when the lines have changed', function () {
    beforeEach(async function () {
      this.body = await DocstoreClient.updateDoc(
        this.project_id,
        this.doc_id,
        this.newLines,
        this.version,
        this.originalRanges
      )
    })

    it('should return modified = true', function () {
      this.body.modified.should.equal(true)
    })

    it('should return the rev', function () {
      this.body.rev.should.equal(2)
    })

    it('should update the doc in the API', async function () {
      const doc = await DocstoreClient.getDoc(this.project_id, this.doc_id)
      doc.lines.should.deep.equal(this.newLines)
      doc.version.should.equal(this.version)
      doc.ranges.should.deep.equal(this.originalRanges)
    })
  })

  describe('when the version has changed', function () {
    beforeEach(async function () {
      this.body = await DocstoreClient.updateDoc(
        this.project_id,
        this.doc_id,
        this.originalLines,
        this.version + 1,
        this.originalRanges
      )
    })

    it('should return modified = true', function () {
      this.body.modified.should.equal(true)
    })

    it('should return the rev', function () {
      this.body.rev.should.equal(1)
    })

    it('should update the doc in the API', async function () {
      const doc = await DocstoreClient.getDoc(this.project_id, this.doc_id)
      doc.lines.should.deep.equal(this.originalLines)
      doc.version.should.equal(this.version + 1)
      doc.ranges.should.deep.equal(this.originalRanges)
    })
  })

  describe('when the version was decremented', function () {
    let statusCode
    beforeEach(async function () {
      try {
        this.body = await DocstoreClient.updateDoc(
          this.project_id,
          this.doc_id,
          this.newLines,
          this.version - 1,
          this.newRanges
        )
      } catch (error) {
        statusCode = error.info.status
      }
    })

    it('should return 409', function () {
      statusCode.should.equal(409)
    })

    it('should not update the doc in the API', async function () {
      const doc = await DocstoreClient.getDoc(this.project_id, this.doc_id)
      doc.lines.should.deep.equal(this.originalLines)
      doc.version.should.equal(this.version)
      doc.ranges.should.deep.equal(this.originalRanges)
    })
  })

  describe('when the ranges have changed', function () {
    beforeEach(async function () {
      this.body = await DocstoreClient.updateDoc(
        this.project_id,
        this.doc_id,
        this.originalLines,
        this.version,
        this.newRanges
      )
    })

    it('should return modified = true', function () {
      this.body.modified.should.equal(true)
    })

    it('should return the rev', function () {
      this.body.rev.should.equal(2)
    })

    it('should update the doc in the API', async function () {
      const doc = await DocstoreClient.getDoc(this.project_id, this.doc_id)
      doc.lines.should.deep.equal(this.originalLines)
      doc.version.should.equal(this.version)
      doc.ranges.should.deep.equal(this.newRanges)
    })
  })

  describe('when the doc does not exist', function () {
    beforeEach(async function () {
      this.missing_doc_id = new ObjectId()
      this.body = await DocstoreClient.updateDoc(
        this.project_id,
        this.missing_doc_id,
        this.originalLines,
        0,
        this.originalRanges
      )
    })

    it('should create the doc', function () {
      this.body.rev.should.equal(1)
    })

    it('should be retreivable', async function () {
      const doc = await DocstoreClient.getDoc(
        this.project_id,
        this.missing_doc_id
      )
      doc.lines.should.deep.equal(this.originalLines)
      doc.version.should.equal(0)
      doc.ranges.should.deep.equal(this.originalRanges)
    })
  })

  describe('when malformed doc lines are provided', function () {
    describe('when the lines are not an array', function () {
      let statusCode
      beforeEach(async function () {
        try {
          this.body = await DocstoreClient.updateDoc(
            this.project_id,
            this.doc_id,
            { foo: 'bar' },
            this.version,
            this.originalRanges
          )
        } catch (error) {
          statusCode = error.info.status
        }
      })

      it('should return 400', function () {
        statusCode.should.equal(400)
      })

      it('should not update the doc in the API', async function () {
        const doc = await DocstoreClient.getDoc(this.project_id, this.doc_id)
        doc.lines.should.deep.equal(this.originalLines)
      })
    })

    describe('when the lines are not present', function () {
      let statusCode
      beforeEach(async function () {
        try {
          this.body = await DocstoreClient.updateDoc(
            this.project_id,
            this.doc_id,
            null,
            this.version,
            this.originalRanges
          )
        } catch (error) {
          statusCode = error.info.status
        }
      })

      it('should return 400', function () {
        statusCode.should.equal(400)
      })

      it('should not update the doc in the API', async function () {
        const doc = await DocstoreClient.getDoc(this.project_id, this.doc_id)
        doc.lines.should.deep.equal(this.originalLines)
      })
    })
  })

  describe('when an unknown ranges field is provided', function () {
    let err
    beforeEach(async function () {
      try {
        this.body = await DocstoreClient.updateDoc(
          this.project_id,
          this.doc_id,
          this.newLines,
          this.version + 1,
          { ...this.originalRanges, unknownField: 'x' }
        )
      } catch (error) {
        err = error
      }
    })

    it('should return 400', function () {
      err.info.status.should.equal(400)
    })

    // handleValidationError() (@overleaf/validation-tools) composes the body
    // as { error: fromError(zodError).toString(), statusCode }; fromError()
    // renders the literal unrecognized-key name for a strictObject
    // rejection. Asserting on the body (not just the status code) confirms
    // the *intended* field is what rejected the request, not some unrelated
    // bug that happens to also return the same status.
    it('should return a body naming the unknown field', function () {
      expectValidationError(err, 400, 'unknownField')
    })

    it('should not update the doc in the API', async function () {
      const doc = await DocstoreClient.getDoc(this.project_id, this.doc_id)
      doc.lines.should.deep.equal(this.originalLines)
      doc.version.should.equal(this.version)
    })
  })

  describe('when no version is provided', function () {
    let statusCode
    beforeEach(async function () {
      try {
        this.body = await DocstoreClient.updateDoc(
          this.project_id,
          this.doc_id,
          this.originalLines,
          null,
          this.originalRanges
        )
      } catch (error) {
        statusCode = error.info.status
      }
    })

    it('should return 400', function () {
      statusCode.should.equal(400)
    })

    it('should not update the doc in the API', async function () {
      const doc = await DocstoreClient.getDoc(this.project_id, this.doc_id)
      doc.lines.should.deep.equal(this.originalLines)
      doc.version.should.equal(this.version)
    })
  })

  describe('when the content is large', function () {
    beforeEach(async function () {
      const line = new Array(1025).join('x') // 1kb
      this.largeLines = Array.apply(null, Array(1024)).map(() => line) // 1mb
      this.body = await DocstoreClient.updateDoc(
        this.project_id,
        this.doc_id,
        this.largeLines,
        this.version,
        this.originalRanges
      )
    })

    it('should return modified = true', function () {
      this.body.modified.should.equal(true)
    })

    it('should update the doc in the API', async function () {
      const doc = await DocstoreClient.getDoc(this.project_id, this.doc_id)
      doc.lines.should.deep.equal(this.largeLines)
    })
  })

  describe('when there is a large json payload', function () {
    beforeEach(async function () {
      const line = new Array(1025).join('x') // 1kb
      this.largeLines = Array.apply(null, Array(1024)).map(() => line) // 1kb
      // bloat the ranges payload beyond max_doc_length (2mb + 1kb)
      this.originalRanges.comments = [
        {
          id: new ObjectId().toString(),
          op: { c: line.repeat(2049), p: 0, t: new ObjectId().toString() },
        },
      ]
      this.body = await DocstoreClient.updateDoc(
        this.project_id,
        this.doc_id,
        this.largeLines,
        this.version,
        this.originalRanges
      )
    })

    it('should return modified = true', function () {
      this.body.modified.should.equal(true)
    })

    it('should update the doc in the API', async function () {
      const doc = await DocstoreClient.getDoc(this.project_id, this.doc_id)
      doc.lines.should.deep.equal(this.largeLines)
    })
  })

  describe('when the document body is too large', function () {
    let statusCode, body
    beforeEach(async function () {
      const line = new Array(1025).join('x') // 1kb
      this.largeLines = Array.apply(null, Array(2049)).map(() => line) // 2mb + 1kb
      try {
        this.body = await DocstoreClient.updateDoc(
          this.project_id,
          this.doc_id,
          this.largeLines,
          this.version,
          this.originalRanges
        )
      } catch (error) {
        statusCode = error.info.status
        body = error.body
      }
    })

    it('should return 413', function () {
      statusCode.should.equal(413)
    })

    it('should report body too large', function () {
      body.should.equal('document body too large')
    })

    it('should not update the doc in the API', async function () {
      const doc = await DocstoreClient.getDoc(this.project_id, this.doc_id)
      doc.lines.should.deep.equal(this.originalLines)
    })
  })

  describe('when the json payload is too large', function () {
    beforeEach(async function () {
      const line = new Array(1024).join('x') // 1 KB
      this.largeLines = new Array(8192).fill(line) // 8 MB
      // bloat the ranges payload by 6 MB
      this.originalRanges.comments = [
        {
          id: new ObjectId().toString(),
          op: { c: line.repeat(6144), p: 0, t: new ObjectId().toString() },
        },
      ]

      try {
        this.body = await DocstoreClient.updateDoc(
          this.project_id,
          this.doc_id,
          this.largeLines,
          this.version,
          this.originalRanges
        )
      } catch (error) {
        // ignore error response
      }
    })

    it('should not update the doc in the API', async function () {
      const doc = await DocstoreClient.getDoc(this.project_id, this.doc_id)
      doc.lines.should.deep.equal(this.originalLines)
    })
  })
})
