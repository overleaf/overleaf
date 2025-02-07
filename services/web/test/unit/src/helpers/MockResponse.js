/* eslint-disable
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const Path = require('path')
const contentDisposition = require('content-disposition')

class MockResponse {
  static initClass() {
    // Added via ExpressLocals.
    this.prototype.setContentDisposition = sinon.stub() // FIXME: should be reset between each test
  }

  constructor() {
    this.rendered = false
    this.redirected = false
    this.returned = false
    this.headers = {}
    this.locals = {}

    sinon.spy(this, 'contentType')
    sinon.spy(this, 'header')
    sinon.spy(this, 'json')
    sinon.spy(this, 'send')
    sinon.spy(this, 'sendStatus')
    sinon.spy(this, 'status')
    sinon.spy(this, 'render')
    sinon.spy(this, 'redirect')
  }

  header(field, val) {
    this.headers[field] = val
  }

  render(template, variables) {
    this.success = true
    this.rendered = true
    this.returned = true
    this.renderedTemplate = template
    this.renderedVariables = variables
    if (this.callback != null) {
      return this.callback()
    }
  }

  redirect(url) {
    this.success = true
    this.redirected = true
    this.returned = true
    this.redirectedTo = url
    if (this.callback != null) {
      return this.callback()
    }
  }

  sendStatus(status) {
    if (arguments.length < 2) {
      if (typeof status !== 'number') {
        status = 200
      }
    }
    this.statusCode = status
    this.returned = true
    if (status >= 200 && status < 300) {
      this.success = true
    } else {
      this.success = false
    }
    if (this.callback != null) {
      return this.callback()
    }
  }

  writeHead(status) {
    this.statusCode = status
  }

  send(status, body) {
    if (arguments.length < 2) {
      if (typeof status !== 'number') {
        body = status
        status = this.statusCode || 200
      }
    }
    this.statusCode = status
    this.returned = true
    if (status >= 200 && status < 300) {
      this.success = true
    } else {
      this.success = false
    }
    if (body) {
      this.body = body
    }
    if (this.callback != null) {
      return this.callback()
    }
  }

  json(status, body) {
    if (arguments.length < 2) {
      if (typeof status !== 'number') {
        body = status
        status = this.statusCode || 200
      }
    }
    this.statusCode = status
    this.returned = true
    this.contentType('application/json')
    if (status >= 200 && status < 300) {
      this.success = true
    } else {
      this.success = false
    }
    if (body) {
      this.body = JSON.stringify(body)
    }
    if (this.callback != null) {
      return this.callback()
    }
  }

  status(status) {
    this.statusCode = status
    return this
  }

  setHeader(header, value) {
    this.header(header, value)
  }

  appendHeader(header, value) {
    if (this.headers[header]) {
      this.headers[header] += `, ${value}`
    } else {
      this.headers[header] = value
    }
  }

  setTimeout(timout) {
    this.timout = timout
  }

  end(data, encoding) {
    if (this.callback) {
      return this.callback()
    }
  }

  attachment(filename) {
    switch (Path.extname(filename)) {
      case '.csv':
        this.contentType('text/csv; charset=utf-8')
        break
      case '.zip':
        this.contentType('application/zip')
        break
      default:
        throw new Error('unexpected extension')
    }
    this.header('Content-Disposition', contentDisposition(filename))
    return this
  }

  contentType(type) {
    this.header('Content-Type', type)
    this.type = type
    return this
  }

  type(type) {
    return this.contentType(type)
  }
}
MockResponse.initClass()

module.exports = MockResponse
