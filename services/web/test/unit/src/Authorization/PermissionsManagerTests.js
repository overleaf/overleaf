const sinon = require('sinon')
const { expect } = require('chai')
const modulePath =
  '../../../../app/src/Features/Authorization/PermissionsManager.js'
const SandboxedModule = require('sandboxed-module')
const { ForbiddenError } = require('../../../../app/src/Features/Errors/Errors')

describe('PermissionsManager', function () {
  beforeEach(function () {
    this.PermissionsManager = SandboxedModule.require(modulePath, {
      requires: {
        '../../infrastructure/Modules': (this.Modules = {
          promises: {
            hooks: {
              fire: (this.hooksFire = sinon.stub().resolves([[]])),
            },
          },
        }),
      },
    })
    this.PermissionsManager.registerCapability('capability1', {
      default: true,
    })
    this.PermissionsManager.registerCapability('capability2', {
      default: true,
    })
    this.PermissionsManager.registerCapability('capability3', {
      default: true,
    })
    this.PermissionsManager.registerCapability('capability4', {
      default: false,
    })
    this.PermissionsManager.registerPolicy('openPolicy', {
      capability1: true,
      capability2: true,
    })
    this.PermissionsManager.registerPolicy('restrictivePolicy', {
      capability1: true,
      capability2: false,
    })
    this.openPolicyResponseSet = [
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
    this.restrictivePolicyResponseSet = [
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
    it('accepts empty object', function () {
      expect(() => this.PermissionsManager.validatePolicies({})).not.to.throw
    })

    it('accepts object with registered policies', function () {
      expect(() =>
        this.PermissionsManager.validatePolicies({
          openPolicy: true,
          restrictivePolicy: false,
        })
      ).not.to.throw
    })

    it('accepts object with policies containing non-boolean values', function () {
      expect(() =>
        this.PermissionsManager.validatePolicies({
          openPolicy: 1,
        })
      ).to.throw('policy value must be a boolean: openPolicy = 1')
      expect(() =>
        this.PermissionsManager.validatePolicies({
          openPolicy: undefined,
        })
      ).to.throw('policy value must be a boolean: openPolicy = undefined')
      expect(() =>
        this.PermissionsManager.validatePolicies({
          openPolicy: null,
        })
      ).to.throw('policy value must be a boolean: openPolicy = null')
    })

    it('throws error on object with policies that are not registered', function () {
      expect(() =>
        this.PermissionsManager.validatePolicies({
          openPolicy: true,
          unregisteredPolicy: false,
        })
      ).to.throw('unknown policy: unregisteredPolicy')
    })
  })

  describe('hasPermission', function () {
    describe('when no policies apply to the user', function () {
      it('should return true if default permission is true', function () {
        const groupPolicy = {}
        const capability = 'capability1'
        const result = this.PermissionsManager.hasPermission(
          groupPolicy,
          capability
        )
        expect(result).to.be.true
      })

      it('should return false if the default permission is false', function () {
        const groupPolicy = {}
        const capability = 'capability4'
        const result = this.PermissionsManager.hasPermission(
          groupPolicy,
          capability
        )
        expect(result).to.be.false
      })
    })

    describe('when a policy applies to the user', function () {
      it('should return true if the user has the capability after the policy is applied', function () {
        this.PermissionsManager.registerPolicy('policy', {
          capability1: true,
          capability2: false,
        })
        const groupPolicy = {
          policy: true,
        }
        const capability = 'capability1'
        const result = this.PermissionsManager.hasPermission(
          groupPolicy,
          capability
        )
        expect(result).to.be.true
      })

      it('should return false if the user does not have the capability after the policy is applied', function () {
        this.PermissionsManager.registerPolicy('policy', {
          capability1: true,
          capability2: false,
        })
        const groupPolicy = {
          policy: true,
        }
        const capability = 'capability2'
        const result = this.PermissionsManager.hasPermission(
          groupPolicy,
          capability
        )
        expect(result).to.be.false
      })

      it('should return the default permission if the policy does not apply to the capability', function () {
        this.PermissionsManager.registerPolicy('policy', {
          capability1: true,
          capability2: false,
        })
        const groupPolicy = {
          policy: true,
        }
        {
          const capability = 'capability3'
          const result = this.PermissionsManager.hasPermission(
            groupPolicy,
            capability
          )
          expect(result).to.be.true
        }
        {
          const capability = 'capability4'
          const result = this.PermissionsManager.hasPermission(
            groupPolicy,
            capability
          )
          expect(result).to.be.false
        }
      })

      it('should return the default permission if the policy is not enforced', function () {
        this.PermissionsManager.registerPolicy('policy', {
          capability1: true,
          capability2: false,
        })
        const groupPolicy = {
          policy: false,
        }
        const capability1 = 'capability1'
        const result1 = this.PermissionsManager.hasPermission(
          groupPolicy,
          capability1
        )
        const capability2 = 'capability2'
        const result2 = this.PermissionsManager.hasPermission(
          groupPolicy,
          capability2
        )
        expect(result1).to.be.true
        expect(result2).to.be.true
      })
    })

    describe('when multiple policies apply to the user', function () {
      it('should return true if all policies allow the capability', function () {
        this.PermissionsManager.registerPolicy('policy1', {
          capability1: true,
          capability2: true,
        })

        this.PermissionsManager.registerPolicy('policy2', {
          capability1: true,
          capability2: true,
        })
        const groupPolicy = {
          policy1: true,
          policy2: true,
        }
        const capability = 'capability1'
        const result = this.PermissionsManager.hasPermission(
          groupPolicy,
          capability
        )
        expect(result).to.be.true
      })

      it('should return false if any policy denies the capability', function () {
        this.PermissionsManager.registerPolicy('policy1', {
          capability1: true,
          capability2: true,
        })

        this.PermissionsManager.registerPolicy('policy2', {
          capability1: false,
          capability2: true,
        })
        const groupPolicy = {
          policy1: true,
          policy2: true,
        }
        const capability = 'capability1'
        const result = this.PermissionsManager.hasPermission(
          groupPolicy,
          capability
        )
        expect(result).to.be.false
      })

      it('should return the default permssion when the applicable policy is not enforced', function () {
        this.PermissionsManager.registerPolicy('policy1', {
          capability1: true,
          capability2: true,
        })

        this.PermissionsManager.registerPolicy('policy2', {
          capability1: false,
          capability2: true,
        })
        const groupPolicy = {
          policy1: true,
          policy2: false,
        }
        const capability = 'capability1'
        const result = this.PermissionsManager.hasPermission(
          groupPolicy,
          capability
        )
        expect(result).to.be.true
      })

      it('should return the default permission if the policies do not restrict to the capability', function () {
        this.PermissionsManager.registerPolicy('policy', {
          capability1: true,
          capability2: false,
        })
        const groupPolicy = {
          policy: true,
        }
        {
          const capability = 'capability3'
          const result = this.PermissionsManager.hasPermission(
            groupPolicy,
            capability
          )
          expect(result).to.be.true
        }
        {
          const capability = 'capability4'
          const result = this.PermissionsManager.hasPermission(
            groupPolicy,
            capability
          )
          expect(result).to.be.false
        }
      })
    })
  })

  describe('getUserCapabilities', function () {
    it('should return the default capabilities when no group policy is provided', function () {
      const groupPolicy = {}
      const capabilities =
        this.PermissionsManager.getUserCapabilities(groupPolicy)
      expect(capabilities).to.deep.equal(
        new Set(['capability1', 'capability2', 'capability3'])
      )
    })

    it('should return a reduced capability set when a group policy is provided', function () {
      this.PermissionsManager.registerPolicy('policy', {
        capability1: true,
        capability2: false,
      })
      const groupPolicy = {
        policy: true,
      }
      const capabilities =
        this.PermissionsManager.getUserCapabilities(groupPolicy)
      expect(capabilities).to.deep.equal(
        new Set(['capability1', 'capability3'])
      )
    })

    it('should return a reduced capability set when multiple group policies are provided', function () {
      this.PermissionsManager.registerPolicy('policy1', {
        capability1: true,
        capability2: false,
      })
      this.PermissionsManager.registerPolicy('policy2', {
        capability1: false,
        capability2: true,
      })

      const groupPolicy = {
        policy1: true,
        policy2: true,
      }
      const capabilities =
        this.PermissionsManager.getUserCapabilities(groupPolicy)
      expect(capabilities).to.deep.equal(new Set(['capability3']))
    })

    it('should return an empty capability set when group policies remove all permissions', function () {
      this.PermissionsManager.registerPolicy('policy1', {
        capability1: true,
        capability2: false,
      })
      this.PermissionsManager.registerPolicy('policy2', {
        capability1: false,
        capability2: true,
      })
      this.PermissionsManager.registerPolicy('policy3', {
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
        this.PermissionsManager.getUserCapabilities(groupPolicy)
      expect(capabilities).to.deep.equal(new Set())
    })
  })

  describe('getUserValidationStatus', function () {
    it('should return the status for the policy when the user conforms', async function () {
      this.PermissionsManager.registerPolicy(
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
        await this.PermissionsManager.promises.getUserValidationStatus({
          user,
          groupPolicy,
          subscription,
        })
      expect(result).to.deep.equal(new Map([['policy', true]]))
    })

    it('should return the status for the policy when the user does not conform', async function () {
      this.PermissionsManager.registerPolicy(
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
        await this.PermissionsManager.promises.getUserValidationStatus({
          user,
          groupPolicy,
          subscription,
        })
      expect(result).to.deep.equal(new Map([['policy', false]]))
    })
    it('should return the status for multiple policies according to whether the user conforms', async function () {
      this.PermissionsManager.registerPolicy(
        'policy1',
        {},
        {
          validator: async ({ user, subscription }) => {
            return user.prop === 'allowed' && subscription.prop === 'managed'
          },
        }
      )
      this.PermissionsManager.registerPolicy(
        'policy2',
        {},
        {
          validator: async ({ user, subscription }) => {
            return user.prop === 'other' && subscription.prop === 'managed'
          },
        }
      )
      this.PermissionsManager.registerPolicy(
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
        await this.PermissionsManager.promises.getUserValidationStatus({
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
      it('should not error when managedUsersEnabled is not enabled for user', async function () {
        const result =
          await this.PermissionsManager.promises.assertUserPermissions(
            { _id: 'user123' },
            ['add-secondary-email']
          )
        expect(result).to.be.undefined
      })

      it('should not error when default capability is true', async function () {
        this.PermissionsManager.registerCapability('some-policy-to-check', {
          default: true,
        })
        this.hooksFire.resolves([
          [
            {
              managedUsersEnabled: true,
              groupPolicy: {},
            },
          ],
        ])
        const result =
          await this.PermissionsManager.promises.assertUserPermissions(
            { _id: 'user123' },
            ['some-policy-to-check']
          )
        expect(result).to.be.undefined
      })

      it('should not error when default permission is false but user has permission', async function () {
        this.PermissionsManager.registerCapability('some-policy-to-check', {
          default: false,
        })
        this.PermissionsManager.registerPolicy('userCanDoSomePolicy', {
          'some-policy-to-check': true,
        })
        this.hooksFire.resolves([
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
          await this.PermissionsManager.promises.assertUserPermissions(
            { _id: 'user123' },
            ['some-policy-to-check']
          )
        expect(result).to.be.undefined
      })
    })

    describe('not allowed', function () {
      it('should return error when managedUsersEnabled is enabled for user but there is no group policy', async function () {
        this.hooksFire.resolves([[{ managedUsersEnabled: true }]])
        await expect(
          this.PermissionsManager.promises.assertUserPermissions(
            { _id: 'user123' },
            ['add-secondary-email']
          )
        ).to.be.rejectedWith(Error, 'unknown capability: add-secondary-email')
      })

      it('should return error when default permission is false', async function () {
        this.PermissionsManager.registerCapability('some-policy-to-check', {
          default: false,
        })
        this.hooksFire.resolves([
          [
            {
              managedUsersEnabled: true,
              groupPolicy: {},
            },
          ],
        ])
        await expect(
          this.PermissionsManager.promises.assertUserPermissions(
            { _id: 'user123' },
            ['some-policy-to-check']
          )
        ).to.be.rejectedWith(ForbiddenError)
      })

      it('should return error when default permission is true but user does not have permission', async function () {
        this.PermissionsManager.registerCapability('some-policy-to-check', {
          default: true,
        })
        this.PermissionsManager.registerPolicy('userCannotDoSomePolicy', {
          'some-policy-to-check': false,
        })
        this.hooksFire.resolves([
          [
            {
              managedUsersEnabled: true,
              groupPolicy: { userCannotDoSomePolicy: true },
            },
          ],
        ])
        await expect(
          this.PermissionsManager.promises.assertUserPermissions(
            { _id: 'user123' },
            ['some-policy-to-check']
          )
        ).to.be.rejectedWith(ForbiddenError)
      })
    })
  })

  describe('registerAllowedProperty', function () {
    it('allows us to register a property', async function () {
      this.PermissionsManager.registerAllowedProperty('metadata1')
      const result = await this.PermissionsManager.getAllowedProperties()
      expect(result).to.deep.equal(new Set(['metadata1']))
    })

    // used if multiple modules would require the same prop, since we dont know which will load first, both must register
    it('should handle multiple registrations of the same property', async function () {
      this.PermissionsManager.registerAllowedProperty('metadata1')
      this.PermissionsManager.registerAllowedProperty('metadata1')
      const result = await this.PermissionsManager.getAllowedProperties()
      expect(result).to.deep.equal(new Set(['metadata1']))
    })
  })

  describe('combineAllowedProperties', function () {
    it('should handle multiple occurences of the same property, preserving the first occurence', async function () {
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
      this.PermissionsManager.registerAllowedProperty('prop1')

      const combinedProps =
        this.PermissionsManager.combineAllowedProperties(results)

      expect(combinedProps).to.deep.equal({
        prop1: 'some other value here',
      })
    })

    it('should add registered properties to the set', async function () {
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
      this.PermissionsManager.registerAllowedProperty('prop1')
      this.PermissionsManager.registerAllowedProperty('prop2')

      const combinedProps =
        this.PermissionsManager.combineAllowedProperties(results)

      expect(combinedProps).to.deep.equal({
        prop1: 'some value here',
        prop2: 'some value here',
      })
    })

    it('should not add unregistered properties to the req object', async function () {
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
      this.PermissionsManager.registerAllowedProperty('prop1')

      const results = [policy, policy2]

      const combinedProps =
        this.PermissionsManager.combineAllowedProperties(results)

      expect(combinedProps).to.deep.equal({ prop1: 'some value here' })
    })

    it('should handle an empty array', async function () {
      const results = []

      const combinedProps =
        this.PermissionsManager.combineAllowedProperties(results)

      expect(combinedProps).to.deep.equal({})
    })
  })

  describe('combineGroupPolicies', function () {
    it('should return an empty object when an empty array is passed', async function () {
      const results = []

      const combinedPolicy =
        this.PermissionsManager.combineGroupPolicies(results)
      expect(combinedPolicy).to.deep.equal({})
    })

    it('should combine multiple group policies into a single policy object', async function () {
      const groupPolicy = {
        policy1: true,
      }

      const groupPolicy2 = {
        policy2: false,
        policy3: true,
      }
      this.PermissionsManager.registerAllowedProperty('prop1')

      const results = [groupPolicy, groupPolicy2]

      const combinedPolicy =
        this.PermissionsManager.combineGroupPolicies(results)

      expect(combinedPolicy).to.deep.equal({
        policy1: true,
        policy3: true,
      })
    })

    it('should handle duplicate enforced policies across different group policies', async function () {
      const groupPolicy = {
        policy1: false,
        policy2: true,
      }

      const groupPolicy2 = {
        policy2: true,
        policy3: true,
      }
      this.PermissionsManager.registerAllowedProperty('prop1')

      const results = [groupPolicy, groupPolicy2]

      const combinedPolicy =
        this.PermissionsManager.combineGroupPolicies(results)

      expect(combinedPolicy).to.deep.equal({
        policy2: true,
        policy3: true,
      })
    })

    it('should handle group policies with no enforced policies', async function () {
      const groupPolicy = {
        policy1: false,
        policy2: false,
      }

      const groupPolicy2 = {
        policy2: false,
        policy3: true,
      }
      this.PermissionsManager.registerAllowedProperty('prop1')

      const results = [groupPolicy, groupPolicy2]

      const combinedPolicy =
        this.PermissionsManager.combineGroupPolicies(results)

      expect(combinedPolicy).to.deep.equal({ policy3: true })
    })

    it('should choose the stricter option between two policy values', async function () {
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
      this.PermissionsManager.registerAllowedProperty('prop1')

      const results = [groupPolicy, groupPolicy2]

      const combinedPolicy =
        this.PermissionsManager.combineGroupPolicies(results)

      expect(combinedPolicy).to.deep.equal({
        policy2: true,
        policy3: true,
        policy4: true,
      })
    })
  })

  describe('checkUserListPermissions', function () {
    it('should return true when all users have permissions required', async function () {
      const userList = ['user1', 'user2', 'user3']
      const capabilities = ['capability1', 'capability2']
      this.hooksFire.onCall(0).resolves(this.openPolicyResponseSet)
      this.hooksFire.onCall(1).resolves(this.openPolicyResponseSet)
      this.hooksFire.onCall(2).resolves(this.openPolicyResponseSet)

      const usersHavePermission =
        await this.PermissionsManager.promises.checkUserListPermissions(
          userList,
          capabilities
        )
      expect(usersHavePermission).to.equal(true)
    })

    it('should return false if any user does not have permission', async function () {
      const userList = ['user1', 'user2', 'user3']
      const capabilities = ['capability1', 'capability2']
      this.hooksFire.onCall(0).resolves(this.openPolicyResponseSet)
      this.hooksFire.onCall(1).resolves(this.restrictivePolicyResponseSet)
      this.hooksFire.onCall(2).resolves(this.openPolicyResponseSet)

      const usersHavePermission =
        await this.PermissionsManager.promises.checkUserListPermissions(
          userList,
          capabilities
        )
      expect(usersHavePermission).to.equal(false)
    })
  })
})
