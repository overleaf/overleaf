import { strict as esmock } from 'esmock'
import { expect } from 'chai'
import Path from 'node:path'
import { fileURLToPath } from 'node:url'
import sinon from 'sinon'
import MockResponse from '../helpers/MockResponse.js'
import MockRequest from '../helpers/MockRequest.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const modulePath = Path.join(
  __dirname,
  '../../../../app/src/infrastructure/ServeStaticWrapper'
)

describe('ServeStaticWrapperTests', function () {
  let error = null

  beforeEach(async function () {
    this.req = new MockRequest()
    this.res = new MockResponse()
    this.express = {
      static: () => (req, res, next) => {
        if (error) {
          next(error)
        } else {
          next()
        }
      },
    }
    this.serveStaticWrapper = await esmock(modulePath, {
      express: this.express,
    })
  })

  this.afterEach(() => {
    error = null
  })

  it('Premature close error thrown', async function () {
    error = new Error()
    error.code = 'ERR_STREAM_PREMATURE_CLOSE'
    const middleware = this.serveStaticWrapper('test_folder', {})
    const next = sinon.stub()
    middleware(this.req, this.res, next)
    expect(next.called).to.be.false
  })

  it('No error thrown', async function () {
    const middleware = this.serveStaticWrapper('test_folder', {})
    const next = sinon.stub()
    middleware(this.req, this.res, next)
    expect(next).to.be.calledWith()
  })

  it('Other error thrown', async function () {
    error = new Error()
    const middleware = this.serveStaticWrapper('test_folder', {})
    const next = sinon.stub()
    middleware(this.req, this.res, next)
    expect(next).to.be.calledWith(error)
  })
})
