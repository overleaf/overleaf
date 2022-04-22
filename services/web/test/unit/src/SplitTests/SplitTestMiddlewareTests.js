const SandboxedModule = require('sandboxed-module')
const path = require('path')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/SplitTests/SplitTestMiddleware'
)
const sinon = require('sinon')
const MockResponse = require('../helpers/MockResponse')
const MockRequest = require('../helpers/MockRequest')

describe('SplitTestMiddleware', function () {
  beforeEach(function () {
    this.SplitTestMiddleware = SandboxedModule.require(modulePath, {
      requires: {
        './SplitTestHandler': (this.SplitTestHandler = {
          promises: {
            getAssignment: sinon.stub().resolves(),
          },
        }),
      },
    })

    this.req = new MockRequest()
    this.res = new MockResponse()
    this.next = sinon.stub()
  })

  it('assign multiple split test variants in locals', async function () {
    this.SplitTestHandler.promises.getAssignment
      .withArgs(this.req, 'ui-overhaul')
      .resolves({
        variant: 'default',
      })
    this.SplitTestHandler.promises.getAssignment
      .withArgs(this.req, 'other-test')
      .resolves({
        variant: 'foobar',
      })

    const middleware = this.SplitTestMiddleware.loadAssignmentsInLocals([
      'ui-overhaul',
      'other-test',
    ])
    await middleware(this.req, this.res, this.next)

    sinon.assert.calledWith(
      this.SplitTestHandler.promises.getAssignment,
      this.req,
      this.res,
      'ui-overhaul'
    )
    sinon.assert.calledWith(
      this.SplitTestHandler.promises.getAssignment,
      this.req,
      this.res,
      'other-test'
    )
    sinon.assert.calledOnce(this.next)
  })

  it('assign no split test variant in locals', async function () {
    const middleware = this.SplitTestMiddleware.loadAssignmentsInLocals([])

    await middleware(this.req, this.res, this.next)

    sinon.assert.notCalled(this.SplitTestHandler.promises.getAssignment)
    sinon.assert.calledOnce(this.next)
  })

  it('exception thrown by assignment does not fail the request', async function () {
    this.SplitTestHandler.promises.getAssignment
      .withArgs(this.req, this.res, 'some-test')
      .throws(new Error('failure'))

    const middleware = this.SplitTestMiddleware.loadAssignmentsInLocals([
      'some-test',
    ])

    await middleware(this.req, this.res, this.next)

    sinon.assert.calledWith(
      this.SplitTestHandler.promises.getAssignment,
      this.req,
      this.res,
      'some-test'
    )
    sinon.assert.calledOnce(this.next)
  })
})
