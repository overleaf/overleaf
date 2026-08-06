import { expect } from 'chai'
import mongodb from 'mongodb-legacy'
import { fetchNothing } from '@overleaf/fetch-utils'
import { expectValidationError } from '@overleaf/validation-tools/testUtils.js'
import * as ProjectHistoryApp from './helpers/ProjectHistoryApp.js'
const { ObjectId } = mongodb

describe('Validation', function () {
  beforeEach(async function () {
    await ProjectHistoryApp.ensureRunning()
  })

  it('should return 404 for a malformed project id in the URL path', async function () {
    let err
    try {
      await fetchNothing(
        'http://127.0.0.1:3054/project/not-a-valid-id/snapshot'
      )
      expect.fail('should have thrown')
    } catch (error) {
      err = error
    }
    expectValidationError(err, 404, 'project_id')
  })

  it('should return 404 for a path-traversal pathname param', async function () {
    const projectId = new ObjectId().toString()
    let err
    try {
      await fetchNothing(
        `http://127.0.0.1:3054/project/${projectId}/version/1/${encodeURIComponent(
          '../../../etc/passwd'
        )}`
      )
      expect.fail('should have thrown')
    } catch (error) {
      err = error
    }
    expectValidationError(err, 404, 'pathname')
  })

  it('should return 400 for a path-traversal pathname query param', async function () {
    const projectId = new ObjectId().toString()
    let err
    try {
      await fetchNothing(
        `http://127.0.0.1:3054/project/${projectId}/diff?pathname=${encodeURIComponent(
          '../../../etc/passwd'
        )}&from=1&to=2`
      )
      expect.fail('should have thrown')
    } catch (error) {
      err = error
    }
    expectValidationError(err, 400, 'pathname')
  })

  it('should return 400 for an unknown field in the resync body', async function () {
    const projectId = new ObjectId().toString()
    let err
    try {
      await fetchNothing(`http://127.0.0.1:3054/project/${projectId}/resync`, {
        method: 'POST',
        json: { notAField: true },
      })
      expect.fail('should have thrown')
    } catch (error) {
      err = error
    }
    expectValidationError(err, 400, 'notAField')
  })

  it('should return 400 for a non-datetime created_at in the label body', async function () {
    const projectId = new ObjectId().toString()
    let err
    try {
      await fetchNothing(`http://127.0.0.1:3054/project/${projectId}/labels`, {
        method: 'POST',
        json: {
          comment: 'a comment',
          version: 1,
          created_at: 'not-a-datetime',
        },
      })
      expect.fail('should have thrown')
    } catch (error) {
      err = error
    }
    expectValidationError(err, 400, 'created_at')
  })
})
