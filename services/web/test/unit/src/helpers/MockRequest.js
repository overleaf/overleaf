const sinon = require('sinon')

class MockRequest {
  constructor() {
    this.session = { destroy() {} }

    this.ip = '42.42.42.42'
    this.headers = {}
    this.params = {}
    this.query = {}
    this.body = {}
    this._parsedUrl = {}
    this.i18n = {
      translate(str) {
        return str
      },
    }
    this.route = { path: '' }
    this.accepts = () => {}
    this.setHeader = () => {}
    this.logger = {
      addFields: sinon.stub(),
      setLevel: sinon.stub(),
    }
  }

  param(param) {
    return this.params[param]
  }
}

module.exports = MockRequest
