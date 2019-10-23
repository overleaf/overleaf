const sinon = require('sinon')
const { expect } = require('chai')
const { ObjectId } = require('mongodb')
const SandboxedModule = require('sandboxed-module')
const { Project } = require('../helpers/models/Project')

const MODULE_PATH =
  '../../../../app/src/Features/Project/ProjectAuditLogHandler'

describe('ProjectAuditLogHandler', function() {
  beforeEach(function() {
    this.projectId = ObjectId()
    this.userId = ObjectId()
    this.ProjectMock = sinon.mock(Project)
    this.ProjectAuditLogHandler = SandboxedModule.require(MODULE_PATH, {
      requires: {
        '../../models/Project': { Project }
      }
    })
  })

  afterEach(function() {
    this.ProjectMock.restore()
  })

  describe('addEntry', function() {
    describe('success', function() {
      beforeEach(async function() {
        this.dbUpdate = this.ProjectMock.expects('updateOne').withArgs(
          { _id: this.projectId },
          {
            $push: {
              auditLog: {
                $each: [
                  {
                    operation: 'translate',
                    initiatorId: this.userId,
                    info: { destinationLanguage: 'tagalog' },
                    timestamp: sinon.match.typeOf('date')
                  }
                ],
                $slice: -200
              }
            }
          }
        )
        this.dbUpdate.chain('exec').resolves({ nModified: 1 })
        this.operationId = await this.ProjectAuditLogHandler.promises.addEntry(
          this.projectId,
          'translate',
          this.userId,
          { destinationLanguage: 'tagalog' }
        )
      })

      it('writes a log', async function() {
        this.ProjectMock.verify()
      })
    })

    describe('when the project does not exist', function() {
      beforeEach(function() {
        this.ProjectMock.expects('updateOne')
          .chain('exec')
          .resolves({ nModified: 0 })
      })

      it('throws an error', async function() {
        await expect(
          this.ProjectAuditLogHandler.promises.addEntry(
            this.projectId,
            'translate',
            this.userId,
            { destinationLanguage: 'tagalog' }
          )
        ).to.be.rejected
      })
    })
  })
})
