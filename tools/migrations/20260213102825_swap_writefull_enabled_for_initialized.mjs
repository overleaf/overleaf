/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'

import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'
const tags = ['saas']

const migrate = async client => {
  const { db } = client
  // if writefull.enabled is unset or null then the account has no promotion attached yet
  await batchedUpdate(db.users, {}, [
    {
      $set: {
        'writefull.initialized': {
          $or: [
            { $eq: ['$writefull.enabled', true] },
            { $eq: ['$writefull.enabled', false] },
          ],
        },
      },
    },
  ])
  console.log('completed migration to writefull.initialized')
}

const rollback = async client => {
  const { db } = client
  // unset the user.writefull.initialized value only if its been set
  await batchedUpdate(
    db.users,
    { 'writefull.initialized': { $exists: true } },
    { $unset: { 'writefull.initialized': 1 } }
  )
  console.log('completed rollback of writefull.initialized migration')
}

export default {
  tags,
  migrate,
  rollback,
}
