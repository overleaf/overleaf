const SandboxedModule = require('sandboxed-module')
const path = require('path')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/SplitTests/SplitTestMiddleware'
)
const sinon = require('sinon')
const { assert } = require('chai')
const MockResponse = require('../helpers/MockResponse')
const MockRequest = require('../helpers/MockRequest')

describe('SplitTestMiddleware', function () {
  beforeEach(function () {
    this.SplitTestMiddleware = SandboxedModule.require(modulePath, {
      requires: {
        './SplitTestV2Handler': (this.SplitTestV2Handler = {
          promises: {
            getAssignmentForSession: sinon.stub().resolves(),
          },
        }),
        './SplitTestCache': (this.SplitTestCache = {
          get: sinon.stub().resolves(),
        }),
      },
    })

    this.req = new MockRequest()
    this.req.session = {}
    this.res = new MockResponse()
    this.next = sinon.stub()
  })

  it('assign split test variant in locals', async function () {
    this.SplitTestCache.get.withArgs('ui-overhaul').resolves({
      name: 'ui-overhaul',
      getCurrentVersion: () => ({
        versionNumber: 1,
        active: true,
      }),
    })
    this.SplitTestV2Handler.promises.getAssignmentForSession
      .withArgs(this.req.session, 'ui-overhaul')
      .resolves({
        variant: 'new',
      })

    const middleware = this.SplitTestMiddleware.loadAssignmentsInLocals([
      'ui-overhaul',
    ])
    await middleware(this.req, this.res, this.next)

    assert.equal(this.res.locals.splitTestVariants['ui-overhaul'], 'new')
    assert.deepEqual(this.req.session.cachedSplitTestAssignments, {
      'ui-overhaul-1': 'new',
    })
    sinon.assert.calledOnce(this.next)
  })

  it('assign multiple split test variant in locals', async function () {
    this.SplitTestCache.get
      .withArgs('ui-overhaul')
      .resolves({
        name: 'ui-overhaul',
        getCurrentVersion: () => ({
          versionNumber: 1,
          active: true,
        }),
      })
      .withArgs('other-test')
      .resolves({
        name: 'other-test',
        getCurrentVersion: () => ({
          versionNumber: 1,
          active: true,
        }),
      })

    this.SplitTestV2Handler.promises.getAssignmentForSession
      .withArgs(this.req.session, 'ui-overhaul')
      .resolves({
        variant: 'default',
      })
    this.SplitTestV2Handler.promises.getAssignmentForSession
      .withArgs(this.req.session, 'other-test')
      .resolves({
        variant: 'foobar',
      })

    const middleware = this.SplitTestMiddleware.loadAssignmentsInLocals([
      'ui-overhaul',
      'other-test',
    ])
    await middleware(this.req, this.res, this.next)

    assert.equal(this.res.locals.splitTestVariants['ui-overhaul'], 'default')
    assert.equal(this.res.locals.splitTestVariants['other-test'], 'foobar')
    assert.deepEqual(this.req.session.cachedSplitTestAssignments, {
      'ui-overhaul-1': 'default',
      'other-test-1': 'foobar',
    })
    sinon.assert.calledOnce(this.next)
  })

  it('cached assignment in session is used', async function () {
    this.req.session.cachedSplitTestAssignments = {
      'ui-overhaul-1': 'cached-variant',
    }
    this.SplitTestCache.get.withArgs('ui-overhaul').resolves({
      name: 'ui-overhaul',
      getCurrentVersion: () => ({
        versionNumber: 1,
        active: true,
      }),
    })

    const middleware = this.SplitTestMiddleware.loadAssignmentsInLocals([
      'ui-overhaul',
    ])
    await middleware(this.req, this.res, this.next)

    sinon.assert.notCalled(
      this.SplitTestV2Handler.promises.getAssignmentForSession
    )
    assert.equal(
      this.res.locals.splitTestVariants['ui-overhaul'],
      'cached-variant'
    )
    assert.deepEqual(this.req.session.cachedSplitTestAssignments, {
      'ui-overhaul-1': 'cached-variant',
    })
    sinon.assert.calledOnce(this.next)
  })

  it('inactive split test is not assigned in locals', async function () {
    this.SplitTestCache.get.withArgs('ui-overhaul').resolves({
      name: 'ui-overhaul',
      getCurrentVersion: () => ({
        versionNumber: 1,
        active: false,
      }),
    })

    const middleware = this.SplitTestMiddleware.loadAssignmentsInLocals([
      'ui-overhaul',
    ])
    await middleware(this.req, this.res, this.next)

    assert.equal(this.res.locals.splitTestVariants, undefined)
    assert.deepEqual(this.req.session.cachedSplitTestAssignments, {})
    sinon.assert.calledOnce(this.next)
  })

  it('not existing split test is not assigned in locals', async function () {
    this.SplitTestCache.get.withArgs('not-found').resolves(undefined)

    const middleware = this.SplitTestMiddleware.loadAssignmentsInLocals([
      'not-found',
    ])
    await middleware(this.req, this.res, this.next)

    assert.equal(this.res.locals.splitTestVariants, undefined)
    assert.deepEqual(this.req.session.cachedSplitTestAssignments, {})
    sinon.assert.calledOnce(this.next)
  })

  it('next middleware is called even if there is an error', async function () {
    this.SplitTestCache.get.throws('some error')

    const middleware = this.SplitTestMiddleware.loadAssignmentsInLocals([
      'some-test',
    ])
    await middleware(this.req, this.res, this.next)

    assert.equal(this.res.locals.splitTestVariants, undefined)
    assert.deepEqual(this.req.session.cachedSplitTestAssignments, {})
    sinon.assert.calledOnce(this.next)
  })
})
