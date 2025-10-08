import { vi, expect } from 'vitest'
import sinon from 'sinon'

const modulePath =
  '../../../../app/src/Features/Authorization/PermissionsManager.mjs'

describe('PermissionsManager', function () {
  beforeEach(async function (ctx) {
    vi.doMock('../../../../app/src/infrastructure/Modules', () => ({
      default: (ctx.Modules = {
        promises: {
          hooks: {
            fire: (ctx.hooksFire = sinon.stub().resolves([[]])),
          },
        },
      }),
    }))

    ctx.PermissionsManager = (await import(modulePath)).default
    ctx.PermissionsManager.registerCapability('capability1', {
      default: true,
    })
    ctx.PermissionsManager.registerCapability('capability2', {
      default: true,
    })
    ctx.PermissionsManager.registerCapability('capability3', {
      default: true,
    })
    ctx.PermissionsManager.registerCapability('capability4', {
      default: false,
    })
    ctx.PermissionsManager.registerPolicy('openPolicy', {
      capability1: true,
      capability2: true,
    })
    ctx.PermissionsManager.registerPolicy('restrictivePolicy', {
      capability1: true,
      capability2: false,
    })
    ctx.openPolicyResponseSet = [
      [
        {
          managedUsersEnabled: true,
          groupPolicy: { openPolicy: true },
        },
        {
          managedUsersEnabled: true,
          groupPolicy: { openPolicy: true },
        },
      ],
    ]
    ctx.restrictivePolicyResponseSet = [
      [
        {
          managedUsersEnabled: true,
          groupPolicy: { openPolicy: true },
        },
        {
          managedUsersEnabled: true,
          groupPolicy: { restrictivePolicy: true },
        },
      ],
    ]
  })

  describe('validatePolicies', function () {
    it('accepts empty object', function (ctx) {
      expect(() => ctx.PermissionsManager.validatePolicies({})).not.to.throw
    })

    it('accepts object with registered policies', function (ctx) {
      expect(() =>
        ctx.PermissionsManager.validatePolicies({
          openPolicy: true,
          restrictivePolicy: false,
        })
      ).not.to.throw
    })

    it('accepts object with policies containing non-boolean values', function (ctx) {
      expect(() =>
        ctx.PermissionsManager.validatePolicies({
          openPolicy: 1,
        })
      ).to.throw('policy value must be a boolean: openPolicy = 1')
      expect(() =>
        ctx.PermissionsManager.validatePolicies({
          openPolicy: undefined,
        })
      ).to.throw('policy value must be a boolean: openPolicy = undefined')
      expect(() =>
        ctx.PermissionsManager.validatePolicies({
          openPolicy: null,
        })
      ).to.throw('policy value must be a boolean: openPolicy = null')
    })

    it('throws error on object with policies that are not registered', function (ctx) {
      expect(() =>
        ctx.PermissionsManager.validatePolicies({
          openPolicy: true,
          unregisteredPolicy: false,
        })
      ).to.throw('unknown policy: unregisteredPolicy')
    })
  })

  describe('hasPermission', function () {
    describe('when no policies apply to the user', function () {
      it('should return true if default permission is true', function (ctx) {
        const groupPolicy = {}
        const capability = 'capability1'
        const result = ctx.PermissionsManager.hasPermission(
          groupPolicy,
          capability
        )
        expect(result).to.be.true
      })

      it('should return false if the default permission is false', function (ctx) {
        const groupPolicy = {}
        const capability = 'capability4'
        const result = ctx.PermissionsManager.hasPermission(
          groupPolicy,
          capability
        )
        expect(result).to.be.false
      })
    })

    describe('when a policy applies to the user', function () {
      it('should return true if the user has the capability after the policy is applied', function (ctx) {
        ctx.PermissionsManager.registerPolicy('policy', {
          capability1: true,
          capability2: false,
        })
        const groupPolicy = {
          policy: true,
        }
        const capability = 'capability1'
        const result = ctx.PermissionsManager.hasPermission(
          groupPolicy,
          capability
        )
        expect(result).to.be.true
      })

      it('should return false if the user does not have the capability after the policy is applied', function (ctx) {
        ctx.PermissionsManager.registerPolicy('policy', {
          capability1: true,
          capability2: false,
        })
        const groupPolicy = {
          policy: true,
        }
        const capability = 'capability2'
        const result = ctx.PermissionsManager.hasPermission(
          groupPolicy,
          capability
        )
        expect(result).to.be.false
      })

      it('should return the default permission if the policy does not apply to the capability', function (ctx) {
        ctx.PermissionsManager.registerPolicy('policy', {
          capability1: true,
          capability2: false,
        })
        const groupPolicy = {
          policy: true,
        }
        {
          const capability = 'capability3'
          const result = ctx.PermissionsManager.hasPermission(
            groupPolicy,
            capability
          )
          expect(result).to.be.true
        }
        {
          const capability = 'capability4'
          const result = ctx.PermissionsManager.hasPermission(
            groupPolicy,
            capability
          )
          expect(result).to.be.false
        }
      })

      it('should return the default permission if the policy is not enforced', function (ctx) {
        ctx.PermissionsManager.registerPolicy('policy', {
          capability1: true,
          capability2: false,
        })
        const groupPolicy = {
          policy: false,
        }
        const capability1 = 'capability1'
        const result1 = ctx.PermissionsManager.hasPermission(
          groupPolicy,
          capability1
        )
        const capability2 = 'capability2'
        const result2 = ctx.PermissionsManager.hasPermission(
          groupPolicy,
          capability2
        )
        expect(result1).to.be.true
        expect(result2).to.be.true
      })
    })

    describe('when multiple policies apply to the user', function () {
      it('should return true if all policies allow the capability', function (ctx) {
        ctx.PermissionsManager.registerPolicy('policy1', {
          capability1: true,
          capability2: true,
        })

        ctx.PermissionsManager.registerPolicy('policy2', {
          capability1: true,
          capability2: true,
        })
        const groupPolicy = {
          policy1: true,
          policy2: true,
        }
        const capability = 'capability1'
        const result = ctx.PermissionsManager.hasPermission(
          groupPolicy,
          capability
        )
        expect(result).to.be.true
      })

      it('should return false if any policy denies the capability', function (ctx) {
        ctx.PermissionsManager.registerPolicy('policy1', {
          capability1: true,
          capability2: true,
        })

        ctx.PermissionsManager.registerPolicy('policy2', {
          capability1: false,
          capability2: true,
        })
        const groupPolicy = {
          policy1: true,
          policy2: true,
        }
        const capability = 'capability1'
        const result = ctx.PermissionsManager.hasPermission(
          groupPolicy,
          capability
        )
        expect(result).to.be.false
      })

      it('should return the default permssion when the applicable policy is not enforced', function (ctx) {
        ctx.PermissionsManager.registerPolicy('policy1', {
          capability1: true,
          capability2: true,
        })

        ctx.PermissionsManager.registerPolicy('policy2', {
          capability1: false,
          capability2: true,
        })
        const groupPolicy = {
          policy1: true,
          policy2: false,
        }
        const capability = 'capability1'
        const result = ctx.PermissionsManager.hasPermission(
          groupPolicy,
          capability
        )
        expect(result).to.be.true
      })

      it('should return the default permission if the policies do not restrict to the capability', function (ctx) {
        ctx.PermissionsManager.registerPolicy('policy', {
          capability1: true,
          capability2: false,
        })
        const groupPolicy = {
          policy: true,
        }
        {
          const capability = 'capability3'
          const result = ctx.PermissionsManager.hasPermission(
            groupPolicy,
            capability
          )
          expect(result).to.be.true
        }
        {
          const capability = 'capability4'
          const result = ctx.PermissionsManager.hasPermission(
            groupPolicy,
            capability
          )
          expect(result).to.be.false
        }
      })
    })
  })

  describe('getUserCapabilities', function () {
    it('should return the default capabilities when no group policy is provided', function (ctx) {
      const groupPolicy = {}
      const capabilities =
        ctx.PermissionsManager.getUserCapabilities(groupPolicy)
      expect(capabilities).to.deep.equal(
        new Set(['capability1', 'capability2', 'capability3'])
      )
    })

    it('should return a reduced capability set when a group policy is provided', function (ctx) {
      ctx.PermissionsManager.registerPolicy('policy', {
        capability1: true,
        capability2: false,
      })
      const groupPolicy = {
        policy: true,
      }
      const capabilities =
        ctx.PermissionsManager.getUserCapabilities(groupPolicy)
      expect(capabilities).to.deep.equal(
        new Set(['capability1', 'capability3'])
      )
    })

    it('should return a reduced capability set when multiple group policies are provided', function (ctx) {
      ctx.PermissionsManager.registerPolicy('policy1', {
        capability1: true,
        capability2: false,
      })
      ctx.PermissionsManager.registerPolicy('policy2', {
        capability1: false,
        capability2: true,
      })

      const groupPolicy = {
        policy1: true,
        policy2: true,
      }
      const capabilities =
        ctx.PermissionsManager.getUserCapabilities(groupPolicy)
      expect(capabilities).to.deep.equal(new Set(['capability3']))
    })

    it('should return an empty capability set when group policies remove all permissions', function (ctx) {
      ctx.PermissionsManager.registerPolicy('policy1', {
        capability1: true,
        capability2: false,
      })
      ctx.PermissionsManager.registerPolicy('policy2', {
        capability1: false,
        capability2: true,
      })
      ctx.PermissionsManager.registerPolicy('policy3', {
        capability1: true,
        capability2: true,
        capability3: false,
      })
      const groupPolicy = {
        policy1: true,
        policy2: true,
        policy3: true,
      }
      const capabilities =
        ctx.PermissionsManager.getUserCapabilities(groupPolicy)
      expect(capabilities).to.deep.equal(new Set())
    })
  })

  describe('getUserValidationStatus', function () {
    it('should return the status for the policy when the user conforms', async function (ctx) {
      ctx.PermissionsManager.registerPolicy(
        'policy',
        {},
        {
          validator: async ({ user, subscription }) => {
            return user.prop === 'allowed' && subscription.prop === 'managed'
          },
        }
      )
      const groupPolicy = {
        policy: true,
      }
      const user = { prop: 'allowed' }
      const subscription = { prop: 'managed' }
      const result =
        await ctx.PermissionsManager.promises.getUserValidationStatus({
          user,
          groupPolicy,
          subscription,
        })
      expect(result).to.deep.equal(new Map([['policy', true]]))
    })

    it('should return the status for the policy when the user does not conform', async function (ctx) {
      ctx.PermissionsManager.registerPolicy(
        'policy',
        {},
        {
          validator: async ({ user, subscription }) => {
            return user.prop === 'allowed' && subscription.prop === 'managed'
          },
        }
      )
      const groupPolicy = {
        policy: true,
      }
      const user = { prop: 'not allowed' }
      const subscription = { prop: 'managed' }
      const result =
        await ctx.PermissionsManager.promises.getUserValidationStatus({
          user,
          groupPolicy,
          subscription,
        })
      expect(result).to.deep.equal(new Map([['policy', false]]))
    })
    it('should return the status for multiple policies according to whether the user conforms', async function (ctx) {
      ctx.PermissionsManager.registerPolicy(
        'policy1',
        {},
        {
          validator: async ({ user, subscription }) => {
            return user.prop === 'allowed' && subscription.prop === 'managed'
          },
        }
      )
      ctx.PermissionsManager.registerPolicy(
        'policy2',
        {},
        {
          validator: async ({ user, subscription }) => {
            return user.prop === 'other' && subscription.prop === 'managed'
          },
        }
      )
      ctx.PermissionsManager.registerPolicy(
        'policy3',
        {},
        {
          validator: async ({ user, subscription }) => {
            return user.prop === 'allowed' && subscription.prop === 'managed'
          },
        }
      )

      const groupPolicy = {
        policy1: true,
        policy2: true,
        policy3: false, // this policy is not enforced
      }
      const user = { prop: 'allowed' }
      const subscription = { prop: 'managed' }
      const result =
        await ctx.PermissionsManager.promises.getUserValidationStatus({
          user,
          groupPolicy,
          subscription,
        })
      expect(result).to.deep.equal(
        new Map([
          ['policy1', true],
          ['policy2', false],
        ])
      )
    })
  })
  describe('assertUserPermissions', function () {
    describe('allowed', function () {
      it('should not error when managedUsersEnabled is not enabled for user', async function (ctx) {
        const result =
          await ctx.PermissionsManager.promises.assertUserPermissions(
            { _id: 'user123' },
            ['add-secondary-email']
          )
        expect(result).to.be.undefined
      })

      it('should not error when default capability is true', async function (ctx) {
        ctx.PermissionsManager.registerCapability('some-policy-to-check', {
          default: true,
        })
        ctx.hooksFire.resolves([
          [
            {
              managedUsersEnabled: true,
              groupPolicy: {},
            },
          ],
        ])
        const result =
          await ctx.PermissionsManager.promises.assertUserPermissions(
            { _id: 'user123' },
            ['some-policy-to-check']
          )
        expect(result).to.be.undefined
      })

      it('should not error when default permission is false but user has permission', async function (ctx) {
        ctx.PermissionsManager.registerCapability('some-policy-to-check', {
          default: false,
        })
        ctx.PermissionsManager.registerPolicy('userCanDoSomePolicy', {
          'some-policy-to-check': true,
        })
        ctx.hooksFire.resolves([
          [
            {
              managedUsersEnabled: true,
              groupPolicy: {
                userCanDoSomePolicy: true,
              },
            },
          ],
        ])
        const result =
          await ctx.PermissionsManager.promises.assertUserPermissions(
            { _id: 'user123' },
            ['some-policy-to-check']
          )
        expect(result).to.be.undefined
      })
    })

    describe('not allowed', function () {
      it('should return error when managedUsersEnabled is enabled for user but there is no group policy', async function (ctx) {
        ctx.hooksFire.resolves([[{ managedUsersEnabled: true }]])
        await expect(
          ctx.PermissionsManager.promises.assertUserPermissions(
            { _id: 'user123' },
            ['add-secondary-email']
          )
        ).to.be.rejectedWith(Error, 'unknown capability: add-secondary-email')
      })

      it('should return error when default permission is false', async function (ctx) {
        ctx.PermissionsManager.registerCapability('some-policy-to-check', {
          default: false,
        })
        ctx.hooksFire.resolves([
          [
            {
              managedUsersEnabled: true,
              groupPolicy: {},
            },
          ],
        ])
        await expect(
          ctx.PermissionsManager.promises.assertUserPermissions(
            { _id: 'user123' },
            ['some-policy-to-check']
          )
        ).to.be.rejectedWith(
          'user does not have one or more permissions within some-policy-to-check'
        )
      })

      it('should return error when default permission is true but user does not have permission', async function (ctx) {
        ctx.PermissionsManager.registerCapability('some-policy-to-check', {
          default: true,
        })
        ctx.PermissionsManager.registerPolicy('userCannotDoSomePolicy', {
          'some-policy-to-check': false,
        })
        ctx.hooksFire.resolves([
          [
            {
              managedUsersEnabled: true,
              groupPolicy: { userCannotDoSomePolicy: true },
            },
          ],
        ])
        await expect(
          ctx.PermissionsManager.promises.assertUserPermissions(
            { _id: 'user123' },
            ['some-policy-to-check']
          )
        ).to.be.rejectedWith(
          'user does not have one or more permissions within some-policy-to-check'
        )
      })
    })
  })

  describe('registerAllowedProperty', function () {
    it('allows us to register a property', async function (ctx) {
      ctx.PermissionsManager.registerAllowedProperty('metadata1')
      const result = await ctx.PermissionsManager.getAllowedProperties()
      expect(result).to.deep.equal(new Set(['metadata1']))
    })

    // used if multiple modules would require the same prop, since we dont know which will load first, both must register
    it('should handle multiple registrations of the same property', async function (ctx) {
      ctx.PermissionsManager.registerAllowedProperty('metadata1')
      ctx.PermissionsManager.registerAllowedProperty('metadata1')
      const result = await ctx.PermissionsManager.getAllowedProperties()
      expect(result).to.deep.equal(new Set(['metadata1']))
    })
  })

  describe('combineAllowedProperties', function () {
    it('should handle multiple occurences of the same property, preserving the first occurence', async function (ctx) {
      const policy1 = {
        groupPolicy: {
          policy: false,
        },
        prop1: 'some other value here',
      }
      const policy2 = {
        groupPolicy: {
          policy: false,
        },
        prop1: 'some value here',
      }

      const results = [policy1, policy2]
      ctx.PermissionsManager.registerAllowedProperty('prop1')

      const combinedProps =
        ctx.PermissionsManager.combineAllowedProperties(results)

      expect(combinedProps).to.deep.equal({
        prop1: 'some other value here',
      })
    })

    it('should add registered properties to the set', async function (ctx) {
      const policy = {
        groupPolicy: {
          policy: false,
        },
        prop1: 'some value here',
        propNotMeThough: 'dont copy please',
      }

      const policy2 = {
        groupPolicy: {
          policy: false,
        },
        prop2: 'some value here',
      }

      const results = [policy, policy2]
      ctx.PermissionsManager.registerAllowedProperty('prop1')
      ctx.PermissionsManager.registerAllowedProperty('prop2')

      const combinedProps =
        ctx.PermissionsManager.combineAllowedProperties(results)

      expect(combinedProps).to.deep.equal({
        prop1: 'some value here',
        prop2: 'some value here',
      })
    })

    it('should not add unregistered properties to the req object', async function (ctx) {
      const policy = {
        groupPolicy: {
          policy: false,
        },
        prop1: 'some value here',
      }

      const policy2 = {
        groupPolicy: {
          policy: false,
        },
        prop2: 'some value here',
      }
      ctx.PermissionsManager.registerAllowedProperty('prop1')

      const results = [policy, policy2]

      const combinedProps =
        ctx.PermissionsManager.combineAllowedProperties(results)

      expect(combinedProps).to.deep.equal({ prop1: 'some value here' })
    })

    it('should handle an empty array', async function (ctx) {
      const results = []

      const combinedProps =
        ctx.PermissionsManager.combineAllowedProperties(results)

      expect(combinedProps).to.deep.equal({})
    })
  })

  describe('combineGroupPolicies', function () {
    it('should return an empty object when an empty array is passed', async function (ctx) {
      const results = []

      const combinedPolicy =
        ctx.PermissionsManager.combineGroupPolicies(results)
      expect(combinedPolicy).to.deep.equal({})
    })

    it('should combine multiple group policies into a single policy object', async function (ctx) {
      const groupPolicy = {
        policy1: true,
      }

      const groupPolicy2 = {
        policy2: false,
        policy3: true,
      }
      ctx.PermissionsManager.registerAllowedProperty('prop1')

      const results = [groupPolicy, groupPolicy2]

      const combinedPolicy =
        ctx.PermissionsManager.combineGroupPolicies(results)

      expect(combinedPolicy).to.deep.equal({
        policy1: true,
        policy3: true,
      })
    })

    it('should handle duplicate enforced policies across different group policies', async function (ctx) {
      const groupPolicy = {
        policy1: false,
        policy2: true,
      }

      const groupPolicy2 = {
        policy2: true,
        policy3: true,
      }
      ctx.PermissionsManager.registerAllowedProperty('prop1')

      const results = [groupPolicy, groupPolicy2]

      const combinedPolicy =
        ctx.PermissionsManager.combineGroupPolicies(results)

      expect(combinedPolicy).to.deep.equal({
        policy2: true,
        policy3: true,
      })
    })

    it('should handle group policies with no enforced policies', async function (ctx) {
      const groupPolicy = {
        policy1: false,
        policy2: false,
      }

      const groupPolicy2 = {
        policy2: false,
        policy3: true,
      }
      ctx.PermissionsManager.registerAllowedProperty('prop1')

      const results = [groupPolicy, groupPolicy2]

      const combinedPolicy =
        ctx.PermissionsManager.combineGroupPolicies(results)

      expect(combinedPolicy).to.deep.equal({ policy3: true })
    })

    it('should choose the stricter option between two policy values', async function (ctx) {
      const groupPolicy = {
        policy1: false,
        policy2: true,
        policy4: true,
      }

      const groupPolicy2 = {
        policy2: false,
        policy3: true,
        policy4: false,
      }
      ctx.PermissionsManager.registerAllowedProperty('prop1')

      const results = [groupPolicy, groupPolicy2]

      const combinedPolicy =
        ctx.PermissionsManager.combineGroupPolicies(results)

      expect(combinedPolicy).to.deep.equal({
        policy2: true,
        policy3: true,
        policy4: true,
      })
    })
  })

  describe('checkUserListPermissions', function () {
    it('should return true when all users have permissions required', async function (ctx) {
      const userList = ['user1', 'user2', 'user3']
      const capabilities = ['capability1', 'capability2']
      ctx.hooksFire.onCall(0).resolves(ctx.openPolicyResponseSet)
      ctx.hooksFire.onCall(1).resolves(ctx.openPolicyResponseSet)
      ctx.hooksFire.onCall(2).resolves(ctx.openPolicyResponseSet)

      const usersHavePermission =
        await ctx.PermissionsManager.promises.checkUserListPermissions(
          userList,
          capabilities
        )
      expect(usersHavePermission).to.equal(true)
    })

    it('should return false if any user does not have permission', async function (ctx) {
      const userList = ['user1', 'user2', 'user3']
      const capabilities = ['capability1', 'capability2']
      ctx.hooksFire.onCall(0).resolves(ctx.openPolicyResponseSet)
      ctx.hooksFire.onCall(1).resolves(ctx.restrictivePolicyResponseSet)
      ctx.hooksFire.onCall(2).resolves(ctx.openPolicyResponseSet)

      const usersHavePermission =
        await ctx.PermissionsManager.promises.checkUserListPermissions(
          userList,
          capabilities
        )
      expect(usersHavePermission).to.equal(false)
    })
  })
})
