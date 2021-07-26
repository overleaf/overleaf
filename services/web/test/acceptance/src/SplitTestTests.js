const SplitTestV2Handler = require('../../../app/src/Features/SplitTests/SplitTestV2Handler')
const User = require('./helpers/User')
const { db } = require('../../../app/src/infrastructure/mongodb')
const { ObjectId } = require('mongodb')
const chai = require('chai')
const chaiExclude = require('chai-exclude')
const { promisify } = require('../../../app/src/util/promises')
const { assert } = chai
const { CacheFlow } = require('cache-flow')
chai.use(chaiExclude)

describe('SplitTest', function () {
  beforeEach(async function () {
    this.res = {
      send: obj => {
        this.sent = obj
      },
      status: status => {
        this.sentStatus = status
        return this.res
      },
    }
    this.sent = undefined
    const UserPromises = User.promises
    this.adminUser = new UserPromises({ email: 'admin@example.com' })
    await this.adminUser.ensureUserExists()
    await this.adminUser.ensureAdmin()
    await this.adminUser.login()

    this.sendAdminRequest = async function ({ method, path, payload }) {
      return this.adminUser.doRequest(method, {
        uri: path,
        json: payload,
      })
    }
    this.expectResponse = async function (
      { method, path, payload },
      { status, body, excluding, excludingEvery }
    ) {
      const result = await this.sendAdminRequest({ method, path, payload })

      assert.equal(result.response.statusCode, status)
      if (body) {
        if (excludingEvery) {
          assert.deepEqualExcludingEvery(result.body, body, excludingEvery)
        } else if (excluding) {
          assert.deepEqualExcludingEvery(result.body, body, excluding)
        } else {
          assert.deepEqual(result.body, body)
        }
      }
    }
  })

  describe('Manage split test lifecycle', function () {
    it('Create, update and revert', async function () {
      const config = {
        name: 'split-test-1',
        configuration: {
          active: true,
          phase: 'alpha',
          variants: [
            {
              name: 'variant-1',
              active: true,
              rolloutPercent: 10,
            },
          ],
        },
      }

      const version1 = {
        versionNumber: 1,
        phase: 'alpha',
        active: true,
        variants: [
          {
            name: 'variant-1',
            active: true,
            rolloutPercent: 10,
            rolloutStripes: [
              {
                start: 0,
                end: 10,
              },
            ],
          },
        ],
      }

      await this.expectResponse(
        {
          method: 'POST',
          path: '/admin/createSplitTest',
          payload: config,
        },
        {
          status: 200,
          body: {
            name: 'split-test-1',
            versions: [version1],
          },
          excludingEvery: ['_id', '__v'],
        }
      )

      config.configuration.variants[0].rolloutPercent = 20
      config.configuration.variants.push({
        name: 'variant-2',
        active: true,
        rolloutPercent: 5,
      })

      const version2 = {
        versionNumber: 2,
        phase: 'alpha',
        active: true,
        variants: [
          {
            name: 'variant-1',
            active: true,
            rolloutPercent: 20,
            rolloutStripes: [
              {
                start: 0,
                end: 10,
              },
              {
                start: 10,
                end: 20,
              },
            ],
          },
          {
            name: 'variant-2',
            active: true,
            rolloutPercent: 5,
            rolloutStripes: [
              {
                start: 20,
                end: 25,
              },
            ],
          },
        ],
      }
      await this.expectResponse(
        {
          method: 'POST',
          path: '/admin/updateSplitTest',
          payload: config,
        },
        {
          status: 200,
          body: {
            name: 'split-test-1',
            versions: [version1, version2],
          },
          excludingEvery: ['_id', '__v'],
        }
      )

      config.configuration.active = false
      config.configuration.variants[0].active = false
      config.configuration.variants[0].rolloutPercent = 30
      config.configuration.variants[1].rolloutPercent = 30

      const version3 = {
        versionNumber: 3,
        phase: 'alpha',
        active: false,
        variants: [
          {
            name: 'variant-1',
            active: false,
            rolloutPercent: 30,
            rolloutStripes: [
              {
                start: 0,
                end: 10,
              },
              {
                start: 10,
                end: 20,
              },
              {
                start: 25,
                end: 35,
              },
            ],
          },
          {
            name: 'variant-2',
            active: true,
            rolloutPercent: 30,
            rolloutStripes: [
              {
                start: 20,
                end: 25,
              },
              {
                start: 35,
                end: 60,
              },
            ],
          },
        ],
      }
      await this.expectResponse(
        {
          method: 'POST',
          path: '/admin/updateSplitTest',
          payload: config,
        },
        {
          status: 200,
          body: {
            name: 'split-test-1',
            versions: [version1, version2, version3],
          },
          excludingEvery: ['_id', '__v'],
        }
      )

      const version4 = {
        versionNumber: 4,
        phase: 'alpha',
        active: true,
        variants: [
          {
            name: 'variant-1',
            active: true,
            rolloutPercent: 20,
            rolloutStripes: [
              {
                start: 0,
                end: 10,
              },
              {
                start: 10,
                end: 20,
              },
            ],
          },
          {
            name: 'variant-2',
            active: true,
            rolloutPercent: 5,
            rolloutStripes: [
              {
                start: 20,
                end: 25,
              },
            ],
          },
        ],
      }
      await this.expectResponse(
        {
          method: 'POST',
          path: '/admin/splitTest/revertToPreviousVersion',
          payload: {
            name: 'split-test-1',
            versionNumber: 2,
          },
        },
        {
          status: 200,
          body: {
            name: 'split-test-1',
            versions: [version1, version2, version3, version4],
          },
          excludingEvery: ['_id', '__v'],
        }
      )
    })

    it('Switch to next phase', async function () {
      const version1 = {
        versionNumber: 1,
        phase: 'alpha',
        active: true,
        variants: [
          {
            name: 'variant-1',
            active: true,
            rolloutPercent: 50,
            rolloutStripes: [
              {
                start: 0,
                end: 50,
              },
            ],
          },
          {
            name: 'variant-2',
            active: true,
            rolloutPercent: 50,
            rolloutStripes: [
              {
                start: 50,
                end: 100,
              },
            ],
          },
        ],
      }
      await this.expectResponse(
        {
          method: 'POST',
          path: '/admin/createSplitTest',
          payload: {
            name: 'split-test-3',
            configuration: {
              active: true,
              phase: 'alpha',
              variants: [
                {
                  name: 'variant-1',
                  rolloutPercent: 50,
                  active: true,
                },
                {
                  name: 'variant-2',
                  rolloutPercent: 50,
                  active: true,
                },
              ],
            },
          },
        },
        {
          status: 200,
          body: {
            name: 'split-test-3',
            versions: [version1],
          },
          excluding: ['_id', '__v'],
        }
      )

      const version2 = {
        versionNumber: 2,
        phase: 'beta',
        active: true,
        variants: [
          {
            name: 'variant-1',
            active: true,
            rolloutPercent: 0,
            rolloutStripes: [],
          },
          {
            name: 'variant-2',
            active: true,
            rolloutPercent: 0,
            rolloutStripes: [],
          },
        ],
      }

      await this.expectResponse(
        {
          method: 'POST',
          path: '/admin/splitTest/switchToNextPhase',
          payload: {
            name: 'split-test-3',
          },
        },
        {
          status: 200,
          body: {
            name: 'split-test-3',
            versions: [version1, version2],
          },
          excludingEvery: ['_id', '__v'],
        }
      )

      const version3 = {
        versionNumber: 3,
        phase: 'release',
        active: true,
        variants: [
          {
            name: 'variant-1',
            active: true,
            rolloutPercent: 0,
            rolloutStripes: [],
          },
          {
            name: 'variant-2',
            active: true,
            rolloutPercent: 0,
            rolloutStripes: [],
          },
        ],
      }
      await this.expectResponse(
        {
          method: 'POST',
          path: '/admin/splitTest/switchToNextPhase',
          payload: {
            name: 'split-test-3',
          },
        },
        {
          status: 200,
          body: {
            name: 'split-test-3',
            versions: [version1, version2, version3],
          },
          excludingEvery: ['_id', '__v'],
        }
      )
    })

    it('Error - update with different rollout phase is not allowed', async function () {
      await this.expectResponse(
        {
          method: 'POST',
          path: '/admin/createSplitTest',
          payload: {
            name: 'split-test-2',
            configuration: {
              active: true,
              phase: 'alpha',
              variants: [],
            },
          },
        },
        {
          status: 200,
          body: {
            name: 'split-test-2',
            versions: [
              {
                versionNumber: 1,
                phase: 'alpha',
                active: true,
                variants: [],
              },
            ],
          },
          excludingEvery: ['_id', '__v'],
        }
      )
      await this.expectResponse(
        {
          method: 'POST',
          path: '/admin/updateSplitTest',
          payload: {
            name: 'split-test-2',
            configuration: {
              active: true,
              phase: 'beta',
              variants: [],
            },
          },
        },
        {
          status: 500,
          body: {
            error:
              'Error while updating split test: Cannot update with different phase - use switchToNextPhase endpoint instead',
          },
        }
      )
    })

    it('Error - update with non existing name', async function () {
      await this.expectResponse(
        {
          method: 'POST',
          path: '/admin/updateSplitTest',
          payload: {
            name: 'does-not-exist',
            configuration: {
              active: true,
              phase: 'beta',
              variants: [
                {
                  name: 'foo',
                  active: true,
                  rolloutPercent: 50,
                },
              ],
            },
          },
        },
        {
          status: 500,
          body: {
            error:
              "Error while updating split test: Cannot update split test 'does-not-exist': not found",
          },
        }
      )
    })

    it('Error - create with missing name in configuration', async function () {
      await this.expectResponse(
        {
          method: 'POST',
          path: '/admin/createSplitTest',
          payload: {
            configuration: {
              active: true,
              phase: 'beta',
              variants: [
                {
                  name: 'foo',
                  active: true,
                  rolloutPercent: 50,
                },
              ],
            },
          },
        },
        {
          status: 500,
          body: {
            error:
              'Error while creating split test: SplitTest validation failed: name: Path `name` is required.',
          },
        }
      )
    })

    it('Error - missing variants in configuration', async function () {
      await this.expectResponse(
        {
          method: 'POST',
          path: '/admin/createSplitTest',
          payload: {
            name: 'split-test-1',
            configuration: {},
          },
        },
        {
          status: 500,
          body: {
            error:
              'Error while creating split test: configuration.variants is not iterable',
          },
        }
      )
    })

    it('Error - create with total rollout percent exceeding 100', async function () {
      await this.expectResponse(
        {
          method: 'POST',
          path: '/admin/createSplitTest',
          payload: {
            name: 'split-test-1',
            configuration: {
              active: true,
              phase: 'alpha',
              variants: [
                {
                  name: 'variant-1',
                  active: true,
                  rolloutPercent: 51,
                },
                {
                  name: 'variant-2',
                  active: true,
                  rolloutPercent: 50,
                },
              ],
            },
          },
        },
        {
          status: 500,
          body: {
            error:
              'Error while creating split test: Total variants rollout percentage cannot exceed 100',
          },
        }
      )
    })

    it('Error - create with empty split test name', async function () {
      await this.expectResponse(
        {
          method: 'POST',
          path: '/admin/createSplitTest',
          payload: {
            name: '',
            configuration: {
              active: true,
              phase: 'alpha',
              variants: [
                {
                  name: 'variant-1',
                  active: true,
                  rolloutPercent: 50,
                },
              ],
            },
          },
        },
        {
          status: 500,
          body: {
            error:
              'Error while creating split test: SplitTest validation failed: name: Path `name` is required.',
          },
        }
      )
    })

    it('Error - create with empty variant name', async function () {
      await this.expectResponse(
        {
          method: 'POST',
          path: '/admin/createSplitTest',
          payload: {
            name: 'split-test-7',
            configuration: {
              active: true,
              phase: 'alpha',
              variants: [
                {
                  name: '',
                  active: true,
                  rolloutPercent: 50,
                },
              ],
            },
          },
        },
        {
          status: 500,
          body: {
            error:
              'Error while creating split test: SplitTest validation failed: versions.0.variants.0.name: Path `name` is required.',
          },
        }
      )
    })

    it('Error - cannot switch to release phase after revert to beta', async function () {
      const version1 = {
        versionNumber: 1,
        phase: 'alpha',
        active: true,
        variants: [],
      }
      await this.expectResponse(
        {
          method: 'POST',
          path: '/admin/createSplitTest',
          payload: {
            name: 'split-test-8',
            configuration: {
              active: true,
              phase: 'alpha',
              variants: [],
            },
          },
        },
        {
          status: 200,
          body: {
            name: 'split-test-8',
            versions: [version1],
          },
          excludingEvery: ['__v', '_id'],
        }
      )

      const version2 = {
        versionNumber: 2,
        phase: 'beta',
        active: true,
        variants: [],
      }
      await this.expectResponse(
        {
          method: 'POST',
          path: '/admin/splitTest/switchToNextPhase',
          payload: {
            name: 'split-test-8',
          },
        },
        {
          status: 200,
          body: {
            name: 'split-test-8',
            versions: [version1, version2],
          },
          excludingEvery: ['__v', '_id'],
        }
      )

      const version3 = {
        versionNumber: 3,
        phase: 'release',
        active: true,
        variants: [],
      }
      await this.expectResponse(
        {
          method: 'POST',
          path: '/admin/splitTest/switchToNextPhase',
          payload: {
            name: 'split-test-8',
          },
        },
        {
          status: 200,
          body: {
            name: 'split-test-8',
            versions: [version1, version2, version3],
          },
          excludingEvery: ['__v', '_id'],
        }
      )

      const version4 = {
        versionNumber: 4,
        phase: 'beta',
        active: true,
        variants: [],
      }
      await this.expectResponse(
        {
          method: 'POST',
          path: '/admin/splitTest/revertToPreviousVersion',
          payload: {
            name: 'split-test-8',
            versionNumber: 2,
          },
        },
        {
          status: 200,
          body: {
            name: 'split-test-8',
            forbidReleasePhase: true,
            versions: [version1, version2, version3, version4],
          },
          excludingEvery: ['__v', '_id'],
        }
      )

      await this.expectResponse(
        {
          method: 'POST',
          path: '/admin/splitTest/switchToNextPhase',
          payload: {
            name: 'split-test-8',
          },
        },
        {
          status: 500,
          body: {
            error:
              'Error while switching split test to next phase: Switch to release phase is disabled for this test',
          },
        }
      )
    })
  })

  describe('Assign users to variants', async function () {
    it('Assign to default variant when test is inactive', async function () {
      await this.sendAdminRequest({
        method: 'POST',
        path: '/admin/createSplitTest',
        payload: {
          name: 'user-test-inactive',
          configuration: {
            active: false,
            phase: 'release',
            variants: [
              {
                name: 'variant-1',
                active: true,
                rolloutPercent: 100,
              },
            ],
          },
        },
      })

      const user = await createUserWithId('foobarbazcar', { alpha: true })
      const assignment = await SplitTestV2Handler.promises.getAssignment(
        user._id,
        'user-test-inactive'
      )
      assert.deepEqual(assignment, {
        variant: 'default',
        analytics: {
          segmentation: {},
        },
      })
    })

    it('Assign to correct variant when active for alpha/non-alpha user', async function () {
      await this.sendAdminRequest({
        method: 'POST',
        path: '/admin/createSplitTest',
        payload: {
          name: 'user-test-1',
          configuration: {
            active: true,
            phase: 'alpha',
            variants: [
              {
                name: 'variant-1',
                active: true,
                rolloutPercent: 30,
              },
            ],
          },
        },
      })

      const user1 = await createUserWithId('abc123abc123', { alpha: true })
      const assignment1 = await SplitTestV2Handler.promises.getAssignment(
        user1._id,
        'user-test-1'
      ) // percentile: 24
      assert.deepEqual(assignment1, {
        variant: 'variant-1',
        analytics: {
          segmentation: {
            splitTest: 'user-test-1',
            phase: 'alpha',
            versionNumber: 1,
            variant: 'variant-1',
          },
        },
      })

      const user2 = await createUserWithId('xxx123abc123', {
        alpha: false,
        beta: true,
      })
      const assignment2 = await SplitTestV2Handler.promises.getAssignment(
        user2._id,
        'user-test-1'
      ) // percentile: 70
      assert.deepEqual(assignment2, {
        variant: 'default',
        analytics: {
          segmentation: {},
        },
      })
    })

    it('Assign to correct variant when active for beta user', async function () {
      await this.sendAdminRequest({
        method: 'POST',
        path: '/admin/createSplitTest',
        payload: {
          name: 'user-test-2',
          configuration: {
            active: true,
            phase: 'beta',
            variants: [
              {
                name: 'variant-1',
                active: true,
                rolloutPercent: 30,
              },
            ],
          },
        },
      })

      const user1 = await createUserWithId('abc123abc123', { beta: true })
      const assignment1 = await SplitTestV2Handler.promises.getAssignment(
        user1._id,
        'user-test-2'
      ) // percentile: 62
      assert.deepEqual(assignment1, {
        variant: 'default',
        analytics: {
          segmentation: {
            splitTest: 'user-test-2',
            phase: 'beta',
            versionNumber: 1,
            variant: 'default',
          },
        },
      })

      const user2 = await createUserWithId('abc234abc234', { beta: false })
      const assignment2 = await SplitTestV2Handler.promises.getAssignment(
        user2._id,
        'user-test-2'
      ) // percentile: 34
      assert.deepEqual(assignment2, {
        variant: 'default',
        analytics: {
          segmentation: {},
        },
      })
    })

    it('Assign to correct variant when active in release phase', async function () {
      await this.sendAdminRequest({
        method: 'POST',
        path: '/admin/createSplitTest',
        payload: {
          name: 'user-test-3',
          configuration: {
            active: true,
            phase: 'release',
            variants: [
              {
                name: 'variant-1',
                active: true,
                rolloutPercent: 50,
              },
            ],
          },
        },
      })

      const user1 = await createUserWithId('abc123abc123')
      const assignment1 = await SplitTestV2Handler.promises.getAssignment(
        user1._id,
        'user-test-3'
      ) // percentile: 33
      assert.deepEqual(assignment1, {
        variant: 'variant-1',
        analytics: {
          segmentation: {
            splitTest: 'user-test-3',
            phase: 'release',
            versionNumber: 1,
            variant: 'variant-1',
          },
        },
      })

      const user2 = await createUserWithId('abc234abc234')
      const assignment2 = await SplitTestV2Handler.promises.getAssignment(
        user2._id,
        'user-test-3'
      ) // percentile: 81
      assert.deepEqual(assignment2, {
        variant: 'default',
        analytics: {
          segmentation: {
            splitTest: 'user-test-3',
            phase: 'release',
            versionNumber: 1,
            variant: 'default',
          },
        },
      })
    })

    it('Split test is cached for 1min after update', async function () {
      await this.sendAdminRequest({
        method: 'POST',
        path: '/admin/createSplitTest',
        payload: {
          name: 'user-test-4',
          configuration: {
            active: true,
            phase: 'release',
            variants: [
              {
                name: 'variant-1',
                active: true,
                rolloutPercent: 10,
              },
            ],
          },
        },
      })

      const user1 = await createUserWithId('abc123abc123')
      const assignment1 = await SplitTestV2Handler.promises.getAssignment(
        user1._id,
        'user-test-4'
      ) // percentile: 38
      assert.deepEqual(assignment1, {
        variant: 'default',
        analytics: {
          segmentation: {
            splitTest: 'user-test-4',
            phase: 'release',
            versionNumber: 1,
            variant: 'default',
          },
        },
      })

      await this.sendAdminRequest({
        method: 'POST',
        path: '/admin/updateSplitTest',
        payload: {
          name: 'user-test-4',
          configuration: {
            active: true,
            phase: 'release',
            variants: [
              {
                name: 'variant-1',
                active: true,
                rolloutPercent: 100,
              },
            ],
          },
        },
      })

      const assignment2 = await SplitTestV2Handler.promises.getAssignment(
        user1._id,
        'user-test-4'
      ) // percentile: 38
      assert.deepEqual(assignment2, {
        variant: 'default',
        analytics: {
          segmentation: {
            splitTest: 'user-test-4',
            phase: 'release',
            versionNumber: 1,
            variant: 'default',
          },
        },
      })
    })

    it('User is reassigned if split test cache is cleared after update', async function () {
      await this.sendAdminRequest({
        method: 'POST',
        path: '/admin/createSplitTest',
        payload: {
          name: 'user-test-5',
          configuration: {
            active: true,
            phase: 'release',
            variants: [
              {
                name: 'variant-1',
                active: true,
                rolloutPercent: 10,
              },
            ],
          },
        },
      })

      let user1 = await createUserWithId('abc123abc123')
      const assignment1 = await SplitTestV2Handler.promises.getAssignment(
        user1._id,
        'user-test-5',
        { sync: true }
      ) // percentile: 84
      assert.deepEqual(assignment1, {
        variant: 'default',
        analytics: {
          segmentation: {
            splitTest: 'user-test-5',
            phase: 'release',
            versionNumber: 1,
            variant: 'default',
          },
        },
      })
      user1 = await getUser('abc123abc123')
      assert.deepEqualExcludingEvery(
        user1.splitTests,
        {
          'user-test-5': [
            {
              variantName: 'default',
              versionNumber: 1,
              phase: 'release',
            },
          ],
        },
        ['assignedAt']
      )

      await this.sendAdminRequest({
        method: 'POST',
        path: '/admin/updateSplitTest',
        payload: {
          name: 'user-test-5',
          configuration: {
            active: true,
            phase: 'release',
            variants: [
              {
                name: 'variant-1',
                active: true,
                rolloutPercent: 100,
              },
            ],
          },
        },
      })

      await CacheFlow.reset('split-test')

      const assignment2 = await SplitTestV2Handler.promises.getAssignment(
        user1._id,
        'user-test-5',
        { sync: true }
      ) // percentile: 84
      assert.deepEqual(assignment2, {
        variant: 'variant-1',
        analytics: {
          segmentation: {
            splitTest: 'user-test-5',
            phase: 'release',
            versionNumber: 2,
            variant: 'variant-1',
          },
        },
      })
      user1 = await getUser('abc123abc123')
      assert.deepEqualExcludingEvery(
        user1.splitTests,
        {
          'user-test-5': [
            {
              variantName: 'default',
              versionNumber: 1,
              phase: 'release',
            },
            {
              variantName: 'variant-1',
              versionNumber: 2,
              phase: 'release',
            },
          ],
        },
        ['assignedAt']
      )
    })

    it('User is reassigned from control to striped variant after update, and reverted to control', async function () {
      await this.sendAdminRequest({
        method: 'POST',
        path: '/admin/createSplitTest',
        payload: {
          name: 'user-test-6',
          configuration: {
            active: true,
            phase: 'alpha',
            variants: [
              {
                name: 'variant-1',
                active: true,
                rolloutPercent: 10,
              },
              {
                name: 'variant-2',
                active: true,
                rolloutPercent: 10,
              },
            ],
          },
        },
      })
      await this.sendAdminRequest({
        method: 'POST',
        path: '/admin/splitTest/switchToNextPhase',
        payload: {
          name: 'user-test-6',
        },
      })
      await this.sendAdminRequest({
        method: 'POST',
        path: '/admin/splitTest/switchToNextPhase',
        payload: {
          name: 'user-test-6',
        },
      })
      await this.sendAdminRequest({
        method: 'POST',
        path: '/admin/updateSplitTest',
        payload: {
          name: 'user-test-6',
          configuration: {
            active: true,
            phase: 'release',
            variants: [
              {
                name: 'variant-1',
                active: true,
                rolloutPercent: 10,
              },
              {
                name: 'variant-2',
                active: true,
                rolloutPercent: 10,
              },
            ],
          },
        },
      })

      let user1 = await createUserWithId('abc123abc123')
      const assignment1 = await SplitTestV2Handler.promises.getAssignment(
        user1._id,
        'user-test-6',
        { sync: true }
      ) // percentile: 47
      assert.deepEqual(assignment1, {
        variant: 'default',
        analytics: {
          segmentation: {
            splitTest: 'user-test-6',
            phase: 'release',
            versionNumber: 4,
            variant: 'default',
          },
        },
      })
      user1 = await getUser('abc123abc123')
      assert.deepEqualExcludingEvery(
        user1.splitTests,
        {
          'user-test-6': [
            {
              variantName: 'default',
              versionNumber: 4,
              phase: 'release',
            },
          ],
        },
        ['assignedAt']
      )

      await this.sendAdminRequest({
        method: 'POST',
        path: '/admin/updateSplitTest',
        payload: {
          name: 'user-test-6',
          configuration: {
            active: true,
            phase: 'release',
            variants: [
              {
                name: 'variant-1',
                active: true,
                rolloutPercent: 40,
              },
              {
                name: 'variant-2',
                active: true,
                rolloutPercent: 40,
              },
            ],
          },
        },
      })
      await CacheFlow.reset('split-test')

      const assignment2 = await SplitTestV2Handler.promises.getAssignment(
        user1._id,
        'user-test-6',
        { sync: true }
      ) // percentile: 47
      assert.deepEqual(assignment2, {
        variant: 'variant-1',
        analytics: {
          segmentation: {
            splitTest: 'user-test-6',
            phase: 'release',
            versionNumber: 5,
            variant: 'variant-1',
          },
        },
      })
      user1 = await getUser('abc123abc123')
      assert.deepEqualExcludingEvery(
        user1.splitTests,
        {
          'user-test-6': [
            {
              variantName: 'default',
              versionNumber: 4,
              phase: 'release',
            },
            {
              variantName: 'variant-1',
              versionNumber: 5,
              phase: 'release',
            },
          ],
        },
        ['assignedAt']
      )

      await this.sendAdminRequest({
        method: 'POST',
        path: '/admin/splitTest/revertToPreviousVersion',
        payload: {
          name: 'user-test-6',
          versionNumber: 4,
        },
      })
      await CacheFlow.reset('split-test')

      const assignment3 = await SplitTestV2Handler.promises.getAssignment(
        user1._id,
        'user-test-6',
        { sync: true }
      ) // percentile: 47
      assert.deepEqual(assignment3, {
        variant: 'default',
        analytics: {
          segmentation: {
            splitTest: 'user-test-6',
            phase: 'release',
            versionNumber: 6,
            variant: 'default',
          },
        },
      })
      user1 = await getUser('abc123abc123')
      assert.deepEqualExcludingEvery(
        user1.splitTests,
        {
          'user-test-6': [
            {
              variantName: 'default',
              versionNumber: 4,
              phase: 'release',
            },
            {
              variantName: 'variant-1',
              versionNumber: 5,
              phase: 'release',
            },
            {
              variantName: 'default',
              versionNumber: 6,
              phase: 'release',
            },
          ],
        },
        ['assignedAt']
      )

      await this.sendAdminRequest({
        method: 'POST',
        path: '/admin/splitTest/revertToPreviousVersion',
        payload: {
          name: 'user-test-6',
          versionNumber: 2,
        },
      })
      await CacheFlow.reset('split-test')
      const assignment4 = await SplitTestV2Handler.promises.getAssignment(
        user1._id,
        'user-test-6',
        { sync: true }
      ) // percentile: 47
      assert.deepEqual(assignment4, {
        variant: 'default',
        analytics: {
          segmentation: {},
        },
      })
      user1 = await getUser('abc123abc123')
      assert.deepEqualExcludingEvery(
        user1.splitTests,
        {
          'user-test-6': [
            {
              variantName: 'default',
              versionNumber: 4,
              phase: 'release',
            },
            {
              variantName: 'variant-1',
              versionNumber: 5,
              phase: 'release',
            },
            {
              variantName: 'default',
              versionNumber: 6,
              phase: 'release',
            },
          ],
        },
        ['assignedAt']
      )
    })
  })
})

async function createUserWithId(id, { alpha = false, beta = false } = {}) {
  const newUser = new User()
  const user = await promisify(newUser.register).bind(newUser)()
  await db.users.remove({ _id: user._id })
  user._id = ObjectId(id)
  user.alphaProgram = alpha
  user.betaProgram = beta
  await db.users.insert(user)
  return db.users.findOne(
    { _id: ObjectId(id) },
    { splitTests: 1, alphaProgram: 1, betaProgram: 1 }
  )
}

async function getUser(id) {
  return db.users.findOne(
    { _id: ObjectId(id) },
    { splitTests: 1, alphaProgram: 1, betaProgram: 1 }
  )
}
