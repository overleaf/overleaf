/* eslint-disable
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const should = require('chai').should()
const modulePath = '../../../../app/src/Features/Project/ProjectApiController'
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
require('chai').should()

describe('Project api controller', function() {
  beforeEach(function() {
    this.ProjectDetailsHandler = { getDetails: sinon.stub() }
    this.controller = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        './ProjectDetailsHandler': this.ProjectDetailsHandler,
        'logger-sharelatex': {
          log() {}
        }
      }
    })
    this.project_id = '321l3j1kjkjl'
    this.req = {
      params: {
        project_id: this.project_id
      },
      session: {
        destroy: sinon.stub()
      }
    }
    this.res = {}
    this.next = sinon.stub()
    return (this.projDetails = { name: 'something' })
  })

  describe('getProjectDetails', function() {
    it('should ask the project details handler for proj details', function(done) {
      this.ProjectDetailsHandler.getDetails.callsArgWith(
        1,
        null,
        this.projDetails
      )
      this.res.json = data => {
        this.ProjectDetailsHandler.getDetails
          .calledWith(this.project_id)
          .should.equal(true)
        data.should.deep.equal(this.projDetails)
        return done()
      }
      return this.controller.getProjectDetails(this.req, this.res)
    })

    it('should send a 500 if there is an error', function() {
      this.ProjectDetailsHandler.getDetails.callsArgWith(1, 'error')
      this.controller.getProjectDetails(this.req, this.res, this.next)
      return this.next.calledWith('error').should.equal(true)
    })
  })
})
