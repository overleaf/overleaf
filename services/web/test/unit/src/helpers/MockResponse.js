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

class MockResponse {
  static initClass() {
    this.prototype.setContentDisposition = sinon.stub()

    this.prototype.header = sinon.stub()

    this.prototype.contentType = sinon.stub()
  }
  constructor() {
    this.rendered = false
    this.redirected = false
    this.returned = false
    this.headers = {}
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
        const body = status
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

  send(status, body) {
    if (arguments.length < 2) {
      if (typeof status !== 'number') {
        body = status
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
    this.type = 'application/json'
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
    return (this.headers[header] = value)
  }

  setTimeout(timout) {
    this.timout = timout
  }

  end(data, encoding) {
    if (this.callback) {
      return this.callback()
    }
  }

  type(type) {
    return (this.type = type)
  }
}
MockResponse.initClass()

module.exports = MockResponse
