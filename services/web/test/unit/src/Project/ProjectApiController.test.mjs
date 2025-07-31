import { vi } from 'vitest'
import sinon from 'sinon'

const modulePath = '../../../../app/src/Features/Project/ProjectApiController'

describe('Project api controller', function () {
  beforeEach(async function (ctx) {
    ctx.ProjectDetailsHandler = { getDetails: sinon.stub() }

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectDetailsHandler',
      () => ({
        default: ctx.ProjectDetailsHandler,
      })
    )

    ctx.controller = (await import(modulePath)).default
    ctx.project_id = '321l3j1kjkjl'
    ctx.req = {
      params: {
        project_id: ctx.project_id,
      },
      session: {
        destroy: sinon.stub(),
      },
    }
    ctx.res = {}
    ctx.next = sinon.stub()
    return (ctx.projDetails = { name: 'something' })
  })

  describe('getProjectDetails', function () {
    it('should ask the project details handler for proj details', async function (ctx) {
      await new Promise(resolve => {
        ctx.ProjectDetailsHandler.getDetails.callsArgWith(
          1,
          null,
          ctx.projDetails
        )
        ctx.res.json = data => {
          ctx.ProjectDetailsHandler.getDetails
            .calledWith(ctx.project_id)
            .should.equal(true)
          data.should.deep.equal(ctx.projDetails)
          return resolve()
        }
        return ctx.controller.getProjectDetails(ctx.req, ctx.res)
      })
    })

    it('should send a 500 if there is an error', function (ctx) {
      ctx.ProjectDetailsHandler.getDetails.callsArgWith(1, 'error')
      ctx.controller.getProjectDetails(ctx.req, ctx.res, ctx.next)
      return ctx.next.calledWith('error').should.equal(true)
    })
  })
})
