/* eslint-disable
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const should = require('chai').should()
const SandboxedModule = require('sandboxed-module')
const assert = require('assert')
const path = require('path')
const sinon = require('sinon')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/Blog/BlogController'
)
const { expect } = require('chai')

describe('BlogController', function() {
  beforeEach(function() {
    this.settings = {
      apis: {
        blog: {
          url: 'http://blog.sharelatex.env'
        }
      },
      cdn: { web: { host: null } }
    }
    this.request = { get: sinon.stub() }
    this.ErrorController = {}
    this.BlogController = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'settings-sharelatex': this.settings,
        'logger-sharelatex': {
          log() {}
        },
        '../Errors/ErrorController': this.ErrorController,
        request: this.request
      }
    })

    this.req = {}
    return (this.res = {})
  })

  describe('getPage', function() {
    it('should get the data from the blog api', function(done) {
      this.req.url = '/blog/something.html'
      const body = { stuff: 'here' }

      this.request.get.callsArgWith(1, null, null, JSON.stringify(body))
      this.res.render = (view, data) => {
        this.request.get.calledWith(
          `${this.settings.apis.blog.url}${this.req.url}`
        )
        view.should.equal('blog/blog_holder')
        assert.deepEqual(body, data)
        return done()
      }

      return this.BlogController.getPage(this.req, this.res)
    })

    it('should send to the error controller if the blog responds 404', function(done) {
      this.req.url = '/blog/something.html'
      this.request.get.callsArgWith(1, null, { statusCode: 404 })

      this.ErrorController.notFound = (req, res) => {
        assert.deepEqual(req, this.req)
        assert.deepEqual(res, this.res)
        return done()
      }

      return this.BlogController.getPage(this.req, this.res)
    })

    it('should proxy the image urls', function(done) {
      this.BlogController._directProxy = sinon.stub()
      this.req.url = '/something.png'
      this.BlogController.getPage(this.req, this.res)
      this.BlogController._directProxy
        .calledWith(`${this.settings.apis.blog.url}${this.req.url}`, this.res)
        .should.equal(true)
      return done()
    })
  })

  describe('getIndexPage', function() {
    it('should change the url and send it to getPage', function(done) {
      this.req.url = '/blog'
      this.BlogController.getPage = function(req, res) {
        req.url.should.equal('/blog/index.html')
        return done()
      }
      return this.BlogController.getIndexPage(this.req, this.res)
    })
  })
})
