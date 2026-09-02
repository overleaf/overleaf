import { beforeEach, describe, it, vi } from 'vitest'
import sinon from 'sinon'
import MockRequest from '../helpers/MockRequest.mjs'
import MockResponse from '../helpers/MockResponse.mjs'

const modulePath =
  '../../../../app/src/Features/InactiveData/InactiveProjectController'

describe('InactiveProjectController', function () {
  beforeEach(async function (ctx) {
    ctx.InactiveProjectManager = {
      deactivateOldProjects: sinon.stub(),
      deactivateProject: sinon.stub(),
    }
    vi.doMock(
      '../../../../app/src/Features/InactiveData/InactiveProjectManager',
      () => ({
        default: ctx.InactiveProjectManager,
      })
    )
    ctx.controller = (await import(modulePath)).default
    ctx.req = new MockRequest(vi)
    ctx.res = new MockResponse(vi)
    ctx.res.json = sinon.stub()
    ctx.res.sendStatus = sinon.stub()
  })

  describe('deactivateOldProjects', function () {
    it('should call the manager with the parsed numeric values', function (ctx) {
      ctx.req.body = { numberOfProjectsToArchive: 5, ageOfProjects: 30 }
      ctx.InactiveProjectManager.deactivateOldProjects.callsFake(
        (limit, daysOld, cb) => cb(null, ['project-1'])
      )
      ctx.controller.deactivateOldProjects(ctx.req, ctx.res)
      ctx.InactiveProjectManager.deactivateOldProjects
        .calledWith(5, 30)
        .should.equal(true)
      ctx.res.json.calledWith(['project-1']).should.equal(true)
    })

    it('should coerce numeric-looking strings sent as the body', function (ctx) {
      // some private-API callers post numbers as strings
      ctx.req.body = { numberOfProjectsToArchive: '5', ageOfProjects: '30' }
      ctx.InactiveProjectManager.deactivateOldProjects.callsFake(
        (limit, daysOld, cb) => cb(null, [])
      )
      ctx.controller.deactivateOldProjects(ctx.req, ctx.res)
      ctx.InactiveProjectManager.deactivateOldProjects
        .calledWith(5, 30)
        .should.equal(true)
    })

    it('should work without any body fields', function (ctx) {
      ctx.req.body = {}
      ctx.InactiveProjectManager.deactivateOldProjects.callsFake(
        (limit, daysOld, cb) => cb(null, [])
      )
      ctx.controller.deactivateOldProjects(ctx.req, ctx.res)
      ctx.InactiveProjectManager.deactivateOldProjects
        .calledWith(undefined, undefined)
        .should.equal(true)
    })

    it('should return a 500 when the manager errors', function (ctx) {
      ctx.req.body = {}
      ctx.InactiveProjectManager.deactivateOldProjects.callsFake(
        (limit, daysOld, cb) => cb(new Error('failed'))
      )
      ctx.controller.deactivateOldProjects(ctx.req, ctx.res)
      ctx.res.sendStatus.calledWith(500).should.equal(true)
    })
  })

  describe('deactivateProject', function () {
    beforeEach(function (ctx) {
      // project_id is validated as a Mongo ObjectId
      ctx.projectId = '507f191e810c19729de860ea'
      ctx.req.params = { project_id: ctx.projectId }
    })

    it('should call the manager and return 200', function (ctx) {
      ctx.InactiveProjectManager.deactivateProject.callsFake((id, cb) =>
        cb(null)
      )
      ctx.controller.deactivateProject(ctx.req, ctx.res)
      ctx.InactiveProjectManager.deactivateProject
        .calledWith(ctx.projectId)
        .should.equal(true)
      ctx.res.sendStatus.calledWith(200).should.equal(true)
    })

    it('should return a 500 when the manager errors', function (ctx) {
      ctx.InactiveProjectManager.deactivateProject.callsFake((id, cb) =>
        cb(new Error('failed'))
      )
      ctx.controller.deactivateProject(ctx.req, ctx.res)
      ctx.res.sendStatus.calledWith(500).should.equal(true)
    })
  })
})
