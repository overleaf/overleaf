import { expect } from 'vitest'
import mongodb from 'mongodb-legacy'
import path from 'node:path'

const { ObjectId } = mongodb

const MODULE_PATH = path.join(
  import.meta.dirname,
  '../../../../app/src/Features/Analytics/AccountMappingHelper'
)

describe('AccountMappingHelper', function () {
  beforeEach(async function (ctx) {
    ctx.AccountMappingHelper = (await import(MODULE_PATH)).default
  })

  describe('extractAccountMappingsFromSubscription', function () {
    describe('when the v1 id is the same in the updated subscription and the subscription', function () {
      describe('when the salesforce id is the same in the updated subscription and the subscription', function () {
        beforeEach(function (ctx) {
          ctx.subscription = {
            id: new ObjectId('abc123abc123abc123abc123'),
            salesforce_id: 'def456def456def456',
          }
          ctx.updatedSubscription = { salesforce_id: 'def456def456def456' }
          ctx.result =
            ctx.AccountMappingHelper.extractAccountMappingsFromSubscription(
              ctx.subscription,
              ctx.updatedSubscription
            )
        })

        it('returns an empty array', function (ctx) {
          expect(ctx.result).to.be.an('array')
          expect(ctx.result).to.have.length(0)
        })
      })
      describe('when the salesforce id has changed between the subscription and the updated subscription', function () {
        beforeEach(function (ctx) {
          ctx.subscription = {
            id: new ObjectId('abc123abc123abc123abc123'),
            salesforce_id: 'def456def456def456',
          }
          ctx.updatedSubscription = { salesforce_id: 'ghi789ghi789ghi789' }
          ctx.result =
            ctx.AccountMappingHelper.extractAccountMappingsFromSubscription(
              ctx.subscription,
              ctx.updatedSubscription
            )
        })

        it('returns an array with a single item', function (ctx) {
          expect(ctx.result).to.be.an('array')
          expect(ctx.result).to.have.length(1)
        })

        it('uses "account" as sourceEntity', function (ctx) {
          expect(ctx.result[0]).to.haveOwnProperty('sourceEntity', 'account')
        })

        it('uses the salesforceId from the updated subscription as sourceEntityId', function (ctx) {
          expect(ctx.result[0]).to.haveOwnProperty(
            'sourceEntityId',
            ctx.updatedSubscription.salesforce_id
          )
        })

        it('uses "subscription" as targetEntity', function (ctx) {
          expect(ctx.result[0]).to.haveOwnProperty(
            'targetEntity',
            'subscription'
          )
        })

        it('uses the subscriptionId as targetEntityId', function (ctx) {
          expect(ctx.result[0]).to.haveOwnProperty(
            'targetEntityId',
            ctx.subscription.id
          )
        })
      })
      describe('when the update subscription has a salesforce id and the subscription has no salesforce_id', function () {
        beforeEach(function (ctx) {
          ctx.subscription = { id: new ObjectId('abc123abc123abc123abc123') }
          ctx.updatedSubscription = { salesforce_id: 'def456def456def456' }
          ctx.result =
            ctx.AccountMappingHelper.extractAccountMappingsFromSubscription(
              ctx.subscription,
              ctx.updatedSubscription
            )
        })

        it('returns an array with a single item', function (ctx) {
          expect(ctx.result).to.be.an('array')
          expect(ctx.result).to.have.length(1)
        })

        it('uses "account" as sourceEntity', function (ctx) {
          expect(ctx.result[0]).to.haveOwnProperty('sourceEntity', 'account')
        })

        it('uses the salesforceId from the updated subscription as sourceEntityId', function (ctx) {
          expect(ctx.result[0]).to.haveOwnProperty(
            'sourceEntityId',
            ctx.updatedSubscription.salesforce_id
          )
        })

        it('uses "subscription" as targetEntity', function (ctx) {
          expect(ctx.result[0]).to.haveOwnProperty(
            'targetEntity',
            'subscription'
          )
        })

        it('uses the subscriptionId as targetEntityId', function (ctx) {
          expect(ctx.result[0]).to.haveOwnProperty(
            'targetEntityId',
            ctx.subscription.id
          )
        })
      })
    })

    describe('when the v1 id has changed between the subscription and the updated subscription', function () {
      describe('when the salesforce id has not changed between the subscription and the updated subscription', function () {
        beforeEach(function (ctx) {
          ctx.subscription = {
            id: new ObjectId('abc123abc123abc123abc123'),
            v1_id: '1',
            salesforce_id: '',
          }
          ctx.updatedSubscription = { v1_id: '2', salesforce_id: '' }
          ctx.result =
            ctx.AccountMappingHelper.extractAccountMappingsFromSubscription(
              ctx.subscription,
              ctx.updatedSubscription
            )
        })

        it('returns an array with a single item', function (ctx) {
          expect(ctx.result).to.be.an('array')
          expect(ctx.result).to.have.length(1)
        })

        it('uses "university" as the sourceEntity', function (ctx) {
          expect(ctx.result[0]).to.haveOwnProperty('sourceEntity', 'university')
        })

        it('uses the v1_id from the updated subscription as the sourceEntityId', function (ctx) {
          expect(ctx.result[0]).to.haveOwnProperty(
            'sourceEntityId',
            ctx.updatedSubscription.v1_id
          )
        })

        it('uses "subscription" as the targetEntity', function (ctx) {
          expect(ctx.result[0]).to.haveOwnProperty(
            'targetEntity',
            'subscription'
          )
        })

        it('uses the subscription id as the targetEntityId', function (ctx) {
          expect(ctx.result[0]).to.haveOwnProperty(
            'targetEntityId',
            ctx.subscription.id
          )
        })
      })
      describe('when the salesforce id has changed between the subscription and the updated subscription', function () {
        beforeEach(function (ctx) {
          ctx.subscription = {
            id: new ObjectId('abc123abc123abc123abc123'),
            v1_id: '',
            salesforce_id: 'def456def456def456',
          }
          ctx.updatedSubscription = {
            v1_id: '2',
            salesforce_id: '',
          }
          ctx.result =
            ctx.AccountMappingHelper.extractAccountMappingsFromSubscription(
              ctx.subscription,
              ctx.updatedSubscription
            )
        })

        it('returns an array with two items', function (ctx) {
          expect(ctx.result).to.be.an('array')
          expect(ctx.result).to.have.length(2)
        })

        it('uses the salesforce_id from the updated subscription as the sourceEntityId for the first item', function (ctx) {
          expect(ctx.result[0]).to.haveOwnProperty(
            'sourceEntityId',
            ctx.updatedSubscription.salesforce_id
          )
        })

        it('uses the subscription id as the targetEntityId for the first item', function (ctx) {
          expect(ctx.result[0]).to.haveOwnProperty(
            'targetEntityId',
            ctx.subscription.id
          )
        })

        it('uses the v1_id from the updated subscription as the sourceEntityId for the second item', function (ctx) {
          expect(ctx.result[1]).to.haveOwnProperty(
            'sourceEntityId',
            ctx.updatedSubscription.v1_id
          )
        })

        it('uses the subscription id as the targetEntityId for the second item', function (ctx) {
          expect(ctx.result[1]).to.haveOwnProperty(
            'targetEntityId',
            ctx.subscription.id
          )
        })
      })
    })
  })
  describe('when the recurlySubscription_id has changed between the subscription and the updated subscription', function () {
    beforeEach(function (ctx) {
      ctx.subscription = {
        id: new ObjectId('abc123abc123abc123abc123'),
        recurlySubscription_id: '',
      }
      ctx.updatedSubscription = {
        recurlySubscription_id: '1234a5678b90123cd4567e8f901a2b34',
      }
      ctx.result =
        ctx.AccountMappingHelper.extractAccountMappingsFromSubscription(
          ctx.subscription,
          ctx.updatedSubscription
        )
    })
    it('returns an array with one item', function (ctx) {
      expect(ctx.result).to.be.an('array')
      expect(ctx.result).to.have.length(1)
    })

    it('uses "recurly" as the source', function (ctx) {
      expect(ctx.result[0]).to.haveOwnProperty('source', 'recurly')
    })

    it('uses "subscription" as the sourceEntity', function (ctx) {
      expect(ctx.result[0]).to.haveOwnProperty('sourceEntity', 'subscription')
    })

    it('uses the recurlySubscription_id as the sourceEntityId', function (ctx) {
      expect(ctx.result[0]).to.haveOwnProperty(
        'sourceEntityId',
        ctx.updatedSubscription.recurlySubscription_id
      )
    })

    it('uses "v2" as the target', function (ctx) {
      expect(ctx.result[0]).to.haveOwnProperty('target', 'v2')
    })

    it('uses "subscription" as the targetEntity', function (ctx) {
      expect(ctx.result[0]).to.haveOwnProperty('targetEntity', 'subscription')
    })

    it('uses the subscription id as the targetEntityId', function (ctx) {
      expect(ctx.result[0]).to.haveOwnProperty(
        'targetEntityId',
        ctx.subscription.id
      )
    })
  })
})
