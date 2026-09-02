import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import sinon from 'sinon'
import { setReqValidationModeForTests } from '@overleaf/validation-tools'

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
    ctx.project_id = '507f191e810c19729de860ea'
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

  afterEach(function () {
    setReqValidationModeForTests(null)
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

    describe('with a malformed project_id', function () {
      beforeEach(function (ctx) {
        ctx.req.params.project_id = 'not-a-valid-object-id'
      })

      it('should still process the request in log mode', function (ctx) {
        setReqValidationModeForTests('log')
        ctx.ProjectDetailsHandler.getDetails.callsArgWith(
          1,
          null,
          ctx.projDetails
        )
        ctx.res.json = sinon.stub()
        ctx.controller.getProjectDetails(ctx.req, ctx.res, ctx.next)
        sinon.assert.notCalled(ctx.next)
        sinon.assert.calledWith(
          ctx.ProjectDetailsHandler.getDetails,
          'not-a-valid-object-id'
        )
      })

      describe('when enforced', function () {
        afterEach(function () {
          setReqValidationModeForTests(null)
        })

        it('should reject the request', function (ctx) {
          setReqValidationModeForTests('enforce')
          let error
          try {
            ctx.controller.getProjectDetails(ctx.req, ctx.res, ctx.next)
          } catch (err) {
            error = err
          }
          expect(error).to.exist
          expect(error.name).to.equal('InvalidParamsError')
          sinon.assert.notCalled(ctx.ProjectDetailsHandler.getDetails)
        })
      })
    })
  })
})
