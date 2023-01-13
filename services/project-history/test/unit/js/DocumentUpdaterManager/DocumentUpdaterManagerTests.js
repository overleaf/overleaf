/* eslint-disable
    no-return-assign,
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import sinon from 'sinon'
import { expect } from 'chai'
import { strict as esmock } from 'esmock'

const MODULE_PATH = '../../../../app/js/DocumentUpdaterManager.js'

describe('DocumentUpdaterManager', function () {
  beforeEach(async function () {
    this.settings = {
      apis: { documentupdater: { url: 'http://example.com' } },
    }
    this.request = {
      get: sinon.stub(),
      post: sinon.stub(),
    }
    this.DocumentUpdaterManager = await esmock(MODULE_PATH, {
      request: this.request,
      '@overleaf/settings': this.settings,
    })
    this.callback = sinon.stub()
    this.lines = ['one', 'two', 'three']
    return (this.version = 42)
  })

  describe('getDocument', function () {
    describe('successfully', function () {
      beforeEach(function () {
        this.body = JSON.stringify({
          lines: this.lines,
          version: this.version,
          ops: [],
        })
        this.request.get.yields(null, { statusCode: 200 }, this.body)
        return this.DocumentUpdaterManager.getDocument(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      it('should get the document from the document updater', function () {
        const url = `${this.settings.apis.documentupdater.url}/project/${this.project_id}/doc/${this.doc_id}`
        return this.request.get.calledWith(url).should.equal(true)
      })

      return it('should call the callback with the content and version', function () {
        return this.callback
          .calledWith(null, this.lines.join('\n'), this.version)
          .should.equal(true)
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function () {
        this.error = new Error('something went wrong')
        this.request.get.yields(this.error, null, null)
        return this.DocumentUpdaterManager.getDocument(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      return it('should return an error to the callback', function () {
        return this.callback.calledWith(this.error).should.equal(true)
      })
    })

    return describe('when the document updater returns a failure error code', function () {
      beforeEach(function () {
        this.request.get.yields(null, { statusCode: 500 }, '')
        return this.DocumentUpdaterManager.getDocument(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      return it('should return the callback with an error', function () {
        return this.callback
          .calledWith(
            sinon.match.has(
              'message',
              'doc updater returned a non-success status code: 500'
            )
          )
          .should.equal(true)
      })
    })
  })

  return describe('setDocument', function () {
    beforeEach(function () {
      this.content = 'mock content'
      return (this.user_id = 'user-id-123')
    })

    describe('successfully', function () {
      beforeEach(function () {
        this.request.post.yields(null, { statusCode: 200 })
        return this.DocumentUpdaterManager.setDocument(
          this.project_id,
          this.doc_id,
          this.content,
          this.user_id,
          this.callback
        )
      })

      it('should set the document in the document updater', function () {
        const url = `${this.settings.apis.documentupdater.url}/project/${this.project_id}/doc/${this.doc_id}`
        return this.request.post
          .calledWith({
            url,
            json: {
              lines: this.content.split('\n'),
              source: 'restore',
              user_id: this.user_id,
              undoing: true,
            },
          })
          .should.equal(true)
      })

      return it('should call the callback', function () {
        return this.callback.calledWith(null).should.equal(true)
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function () {
        this.error = new Error('something went wrong')
        this.request.post.yields(this.error, null, null)
        return this.DocumentUpdaterManager.setDocument(
          this.project_id,
          this.doc_id,
          this.content,
          this.user_id,
          this.callback
        )
      })

      return it('should return an error to the callback', function () {
        return this.callback.calledWith(this.error).should.equal(true)
      })
    })

    return describe('when the document updater returns a failure error code', function () {
      beforeEach(function () {
        this.request.post.yields(null, { statusCode: 500 }, '')
        return this.DocumentUpdaterManager.setDocument(
          this.project_id,
          this.doc_id,
          this.content,
          this.user_id,
          this.callback
        )
      })

      return it('should return the callback with an error', function () {
        return this.callback
          .calledWith(
            sinon.match.has(
              'message',
              'doc updater returned a non-success status code: 500'
            )
          )
          .should.equal(true)
      })
    })
  })
})
