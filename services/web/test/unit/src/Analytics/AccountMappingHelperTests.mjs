import path from 'node:path'
import esmock from 'esmock'
import { expect } from 'chai'
import mongodb from 'mongodb-legacy'
import { fileURLToPath } from 'node:url'

const { ObjectId } = mongodb

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const MODULE_PATH = path.join(
  __dirname,
  '../../../../app/src/Features/Analytics/AccountMappingHelper'
)

describe('AccountMappingHelper', function () {
  beforeEach(async function () {
    this.AccountMappingHelper = await esmock.strict(MODULE_PATH)
  })

  describe('extractAccountMappingsFromSubscription', function () {
    describe('when the v1 id is the same in the updated subscription and the subscription', function () {
      describe('when the salesforce id is the same in the updated subscription and the subscription', function () {
        beforeEach(function () {
          this.subscription = {
            id: new ObjectId('abc123abc123abc123abc123'),
            salesforce_id: 'def456def456def456',
          }
          this.updatedSubscription = { salesforce_id: 'def456def456def456' }
          this.result =
            this.AccountMappingHelper.extractAccountMappingsFromSubscription(
              this.subscription,
              this.updatedSubscription
            )
        })

        it('returns an empty array', function () {
          expect(this.result).to.be.an('array')
          expect(this.result).to.have.length(0)
        })
      })
      describe('when the salesforce id has changed between the subscription and the updated subscription', function () {
        beforeEach(function () {
          this.subscription = {
            id: new ObjectId('abc123abc123abc123abc123'),
            salesforce_id: 'def456def456def456',
          }
          this.updatedSubscription = { salesforce_id: 'ghi789ghi789ghi789' }
          this.result =
            this.AccountMappingHelper.extractAccountMappingsFromSubscription(
              this.subscription,
              this.updatedSubscription
            )
        })

        it('returns an array with a single item', function () {
          expect(this.result).to.be.an('array')
          expect(this.result).to.have.length(1)
        })

        it('uses "account" as sourceEntity', function () {
          expect(this.result[0]).to.haveOwnProperty('sourceEntity', 'account')
        })

        it('uses the salesforceId from the updated subscription as sourceEntityId', function () {
          expect(this.result[0]).to.haveOwnProperty(
            'sourceEntityId',
            this.updatedSubscription.salesforce_id
          )
        })

        it('uses "subscription" as targetEntity', function () {
          expect(this.result[0]).to.haveOwnProperty(
            'targetEntity',
            'subscription'
          )
        })

        it('uses the subscriptionId as targetEntityId', function () {
          expect(this.result[0]).to.haveOwnProperty(
            'targetEntityId',
            this.subscription.id
          )
        })
      })
      describe('when the update subscription has a salesforce id and the subscription has no salesforce_id', function () {
        beforeEach(function () {
          this.subscription = { id: new ObjectId('abc123abc123abc123abc123') }
          this.updatedSubscription = { salesforce_id: 'def456def456def456' }
          this.result =
            this.AccountMappingHelper.extractAccountMappingsFromSubscription(
              this.subscription,
              this.updatedSubscription
            )
        })

        it('returns an array with a single item', function () {
          expect(this.result).to.be.an('array')
          expect(this.result).to.have.length(1)
        })

        it('uses "account" as sourceEntity', function () {
          expect(this.result[0]).to.haveOwnProperty('sourceEntity', 'account')
        })

        it('uses the salesforceId from the updated subscription as sourceEntityId', function () {
          expect(this.result[0]).to.haveOwnProperty(
            'sourceEntityId',
            this.updatedSubscription.salesforce_id
          )
        })

        it('uses "subscription" as targetEntity', function () {
          expect(this.result[0]).to.haveOwnProperty(
            'targetEntity',
            'subscription'
          )
        })

        it('uses the subscriptionId as targetEntityId', function () {
          expect(this.result[0]).to.haveOwnProperty(
            'targetEntityId',
            this.subscription.id
          )
        })
      })
    })
  })

  describe('when the v1 id has changed between the subscription and the updated subscription', function () {
    describe('when the salesforce id has not changed between the subscription and the updated subscription', function () {
      beforeEach(function () {
        this.subscription = {
          id: new ObjectId('abc123abc123abc123abc123'),
          v1_id: '1',
          salesforce_id: '',
        }
        this.updatedSubscription = { v1_id: '2', salesforce_id: '' }
        this.result =
          this.AccountMappingHelper.extractAccountMappingsFromSubscription(
            this.subscription,
            this.updatedSubscription
          )
      })

      it('returns an array with a single item', function () {
        expect(this.result).to.be.an('array')
        expect(this.result).to.have.length(1)
      })

      it('uses "university" as the sourceEntity', function () {
        expect(this.result[0]).to.haveOwnProperty('sourceEntity', 'university')
      })

      it('uses the v1_id from the updated subscription as the sourceEntityId', function () {
        expect(this.result[0]).to.haveOwnProperty(
          'sourceEntityId',
          this.updatedSubscription.v1_id
        )
      })

      it('uses "subscription" as the targetEntity', function () {
        expect(this.result[0]).to.haveOwnProperty(
          'targetEntity',
          'subscription'
        )
      })

      it('uses the subscription id as the targetEntityId', function () {
        expect(this.result[0]).to.haveOwnProperty(
          'targetEntityId',
          this.subscription.id
        )
      })
    })
    describe('when the salesforce id has changed between the subscription and the updated subscription', function () {
      beforeEach(function () {
        this.subscription = {
          id: new ObjectId('abc123abc123abc123abc123'),
          v1_id: '',
          salesforce_id: 'def456def456def456',
        }
        this.updatedSubscription = {
          v1_id: '2',
          salesforce_id: '',
        }
        this.result =
          this.AccountMappingHelper.extractAccountMappingsFromSubscription(
            this.subscription,
            this.updatedSubscription
          )
      })

      it('returns an array with two items', function () {
        expect(this.result).to.be.an('array')
        expect(this.result).to.have.length(2)
      })

      it('uses the salesforce_id from the updated subscription as the sourceEntityId for the first item', function () {
        expect(this.result[0]).to.haveOwnProperty(
          'sourceEntityId',
          this.updatedSubscription.salesforce_id
        )
      })

      it('uses the subscription id as the targetEntityId for the first item', function () {
        expect(this.result[0]).to.haveOwnProperty(
          'targetEntityId',
          this.subscription.id
        )
      })

      it('uses the v1_id from the updated subscription as the sourceEntityId for the second item', function () {
        expect(this.result[1]).to.haveOwnProperty(
          'sourceEntityId',
          this.updatedSubscription.v1_id
        )
      })

      it('uses the subscription id as the targetEntityId for the second item', function () {
        expect(this.result[1]).to.haveOwnProperty(
          'targetEntityId',
          this.subscription.id
        )
      })
    })
  })
})
