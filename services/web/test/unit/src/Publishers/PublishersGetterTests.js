const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Publishers/PublishersGetter.js'
)

describe('PublishersGetter', function () {
  beforeEach(function () {
    this.publisher = {
      _id: 'mock-publsiher-id',
      slug: 'ieee',
      fetchV1Data: sinon.stub(),
    }

    this.UserMembershipsHandler = {
      promises: {
        getEntitiesByUser: sinon.stub().resolves([this.publisher]),
      },
    }
    this.UserMembershipEntityConfigs = {
      publisher: {
        modelName: 'Publisher',
        canCreate: true,
        fields: {
          primaryKey: 'slug',
        },
      },
    }

    this.PublishersGetter = SandboxedModule.require(modulePath, {
      requires: {
        '../User/UserGetter': this.UserGetter,
        '../UserMembership/UserMembershipsHandler': this.UserMembershipsHandler,
        '../UserMembership/UserMembershipEntityConfigs':
          this.UserMembershipEntityConfigs,
      },
    })

    this.userId = '12345abcde'
  })

  describe('getManagedPublishers', function () {
    it('fetches v1 data before returning publisher list', function (done) {
      this.PublishersGetter.getManagedPublishers(
        this.userId,
        (error, publishers) => {
          expect(error).to.be.null
          publishers.length.should.equal(1)
          done()
        }
      )
    })
  })
})
