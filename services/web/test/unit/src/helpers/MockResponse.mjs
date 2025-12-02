import Path from 'node:path'
import contentDisposition from 'content-disposition'

class MockResponse {
  constructor(vi) {
    this.rendered = false
    this.redirected = false
    this.returned = false
    this.headers = {}
    this.locals = {}

    this.setContentDisposition = vi.fn()

    this.contentType = vi.fn(this.contentType)
    this.header = vi.fn(this.header)
    this.json = vi.fn(this.json)
    this.send = vi.fn(this.send)
    this.sendStatus = vi.fn(this.sendStatus)
    this.status = vi.fn(this.status)
    this.render = vi.fn(this.render)
    this.redirect = vi.fn(this.redirect)
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
    this.callback?.()
  }

  redirect(url) {
    this.success = true
    this.redirected = true
    this.returned = true
    this.redirectedTo = url
    this.callback?.()
  }

  sendStatus(status) {
    if (typeof status !== 'number') {
      status = 200
    }
    this.statusCode = status
    this.returned = true
    this.success = status >= 200 && status < 300
    this.callback?.()
  }

  writeHead(status) {
    this.statusCode = status
  }

  send(status, body) {
    if (typeof status !== 'number') {
      body = status
      status = this.statusCode || 200
    }
    this.statusCode = status
    this.returned = true
    this.success = status >= 200 && status < 300
    if (body) {
      this.body = body
    }
    this.callback?.()
  }

  json(status, body) {
    if (typeof status !== 'number') {
      body = status
      status = this.statusCode || 200
    }
    this.statusCode = status
    this.returned = true
    this.contentType('application/json')
    this.success = status >= 200 && status < 300
    if (body) {
      this.body = JSON.stringify(body)
    }
    this.callback?.()
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
    this.callback?.()
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

export default MockResponse
