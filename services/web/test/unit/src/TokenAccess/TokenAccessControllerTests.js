const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { expect } = require('chai')
const { ObjectId } = require('mongodb')
const MockRequest = require('../helpers/MockRequest')
const MockResponse = require('../helpers/MockResponse')
const PrivilegeLevels = require('../../../../app/src/Features/Authorization/PrivilegeLevels')

const MODULE_PATH =
  '../../../../app/src/Features/TokenAccess/TokenAccessController'

describe('TokenAccessController', function () {
  beforeEach(function () {
    this.user = { _id: ObjectId() }
    this.project = {
      _id: ObjectId(),
      tokenAccessReadAndWrite_refs: [],
      tokenAccessReadOnly_refs: [],
    }
    this.req = new MockRequest()
    this.res = new MockResponse()

    this.Settings = {}
    this.TokenAccessHandler = {
      TOKEN_TYPES: {
        READ_ONLY: 'readOnly',
        READ_AND_WRITE: 'readAndWrite',
      },
      isReadAndWriteToken: sinon.stub().returns(true),
      isReadOnlyToken: sinon.stub().returns(true),
      tokenAccessEnabledForProject: sinon.stub().returns(true),
      promises: {
        addReadAndWriteUserToProject: sinon.stub().resolves(),
        addReadOnlyUserToProject: sinon.stub().resolves(),
        getProjectByToken: sinon.stub().resolves(this.project),
        getV1DocPublishedInfo: sinon.stub().resolves({ allow: true }),
      },
    }

    this.SessionManager = {
      getLoggedInUserId: sinon.stub().returns(this.user._id),
    }

    this.AuthenticationController = {}

    this.AuthorizationManager = {
      promises: {
        getPrivilegeLevelForProject: sinon
          .stub()
          .resolves(PrivilegeLevels.NONE),
      },
    }

    this.AuthorizationMiddleware = {}

    this.ProjectAuditLogHandler = {
      promises: {
        addEntry: sinon.stub().resolves(),
      },
    }

    this.TokenAccessController = SandboxedModule.require(MODULE_PATH, {
      requires: {
        '@overleaf/settings': this.Settings,
        './TokenAccessHandler': this.TokenAccessHandler,
        '../Authentication/AuthenticationController':
          this.AuthenticationController,
        '../Authentication/SessionManager': this.SessionManager,
        '../Authorization/AuthorizationManager': this.AuthorizationManager,
        '../Authorization/AuthorizationMiddleware':
          this.AuthorizationMiddleware,
        '../Project/ProjectAuditLogHandler': this.ProjectAuditLogHandler,
      },
    })
  })

  describe('grantTokenAccessReadAndWrite', function () {
    describe('normal case', function () {
      beforeEach(function (done) {
        this.req.params = { token: this.token }
        this.req.body = { confirmedByUser: true }
        this.res.callback = done
        this.TokenAccessController.grantTokenAccessReadAndWrite(
          this.req,
          this.res,
          done
        )
      })

      it('grants read and write access', function () {
        expect(
          this.TokenAccessHandler.promises.addReadAndWriteUserToProject
        ).to.have.been.calledWith(this.user._id, this.project._id)
      })

      it('writes a project audit log', function () {
        expect(
          this.ProjectAuditLogHandler.promises.addEntry
        ).to.have.been.calledWith(
          this.project._id,
          'join-via-token',
          this.user._id,
          this.req.ip,
          { privileges: 'readAndWrite' }
        )
      })
    })

    describe('when the access was already granted', function () {
      beforeEach(function (done) {
        this.project.tokenAccessReadAndWrite_refs.push(this.user._id)
        this.req.params = { token: this.token }
        this.req.body = { confirmedByUser: true }
        this.res.callback = done
        this.TokenAccessController.grantTokenAccessReadAndWrite(
          this.req,
          this.res,
          done
        )
      })

      it("doesn't write a project audit log", function () {
        expect(this.ProjectAuditLogHandler.promises.addEntry).to.not.have.been
          .called
      })
    })
  })

  describe('grantTokenAccessReadOnly', function () {
    describe('normal case', function () {
      beforeEach(function (done) {
        this.req.params = { token: this.token }
        this.req.body = { confirmedByUser: true }
        this.res.callback = done
        this.TokenAccessController.grantTokenAccessReadOnly(
          this.req,
          this.res,
          done
        )
      })

      it('grants read-only access', function () {
        expect(
          this.TokenAccessHandler.promises.addReadOnlyUserToProject
        ).to.have.been.calledWith(this.user._id, this.project._id)
      })

      it('writes a project audit log', function () {
        expect(
          this.ProjectAuditLogHandler.promises.addEntry
        ).to.have.been.calledWith(
          this.project._id,
          'join-via-token',
          this.user._id,
          this.req.ip,
          { privileges: 'readOnly' }
        )
      })
    })

    describe('when the access was already granted', function () {
      beforeEach(function (done) {
        this.project.tokenAccessReadOnly_refs.push(this.user._id)
        this.req.params = { token: this.token }
        this.req.body = { confirmedByUser: true }
        this.res.callback = done
        this.TokenAccessController.grantTokenAccessReadOnly(
          this.req,
          this.res,
          done
        )
      })

      it("doesn't write a project audit log", function () {
        expect(this.ProjectAuditLogHandler.promises.addEntry).to.not.have.been
          .called
      })
    })
  })
})
