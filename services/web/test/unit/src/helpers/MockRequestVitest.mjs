class MockRequest {
  constructor(vi) {
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
      addFields: vi.fn(),
      setLevel: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    }
  }

  param(param) {
    return this.params[param]
  }
}

export default MockRequest
