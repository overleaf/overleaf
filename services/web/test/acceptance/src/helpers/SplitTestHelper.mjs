import { assert } from 'chai'
import { CacheFlow } from 'cache-flow'

const sendStaffRequest = async function (
  staffUser,
  { method, path, payload, clearCache = true }
) {
  const response = await staffUser.doRequest(method, {
    uri: path,
    json: payload,
  })
  if (clearCache) {
    await CacheFlow.reset('split-test')
  }
  return response
}

const createTest = async function (staffUser, payload) {
  const response = await sendStaffRequest(staffUser, {
    method: 'POST',
    path: '/admin/api/split-test/create',
    payload,
  })
  return response.body
}

const updateTestConfig = async function (staffUser, payload) {
  const response = await sendStaffRequest(staffUser, {
    method: 'POST',
    path: '/admin/api/split-test/update-config',
    payload,
  })
  return response.body
}

const expectResponse = async function (
  staffUser,
  { method, path, payload },
  { status, body, excluding, excludingEvery }
) {
  const result = await sendStaffRequest(staffUser, { method, path, payload })

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

export default {
  sendStaffRequest,
  createTest,
  updateTestConfig,
  expectResponse,
}
