#!/usr/bin/env node

/**
 * Checks collections for potential issues with batchedUpdate missing
 * entries at the start of the collection.
 */

import assert from 'node:assert/strict'
import { describe, it, before, after } from 'node:test'
import { db, connectionPromise } from '../lib/mongodb.mjs'

/**
 * Finds IDs where the natural order and _id sorted order differ.
 * This identifies records that might have been moved or updated in a way
 * that affected their storage position in MongoDB.
 */
async function findDivergentRecords(coll) {
  const [firstNatural, firstSorted] = await Promise.all([
    db[coll].find().limit(1).next(),
    db[coll].find().sort({ _id: 1 }).limit(1).next(),
  ])

  if (!firstNatural || !firstSorted || firstNatural._id.equals(firstSorted._id))
    return []

  const [minId, maxId] =
    firstNatural._id.toString() < firstSorted._id.toString()
      ? [firstNatural._id, firstSorted._id]
      : [firstSorted._id, firstNatural._id]

  const found = await db[coll]
    .find({ _id: { $gte: minId, $lte: maxId } })
    .toArray()
  return found
}

describe('Batched update audit', async () => {
  let client

  before(async () => {
    client = await connectionPromise
  })

  after(async () => {
    if (client) await client.close()
  })

  describe('users collection', async () => {
    const records = await findDivergentRecords('users')
    if (records.length === 0) {
      it('no divergent records found', () => assert.ok(true))
    } else {
      for (const record of records) {
        describe(`Record: ${record._id}`, () => {
          // tools/migrations/20210726083523_convert_confirmedAt_strings_to_dates.mjs
          // any confirmedAt field must be a date
          it('confirmedAt is a Date object in email records', () => {
            record.emails?.forEach(emailObj => {
              if ('confirmedAt' in emailObj) {
                assert.ok(emailObj.confirmedAt instanceof Date)
              }
            })
          })
          // tools/migrations/20210726083523_convert_split_tests_assigned_at_strings_to_dates.mjs
          // each split test entry has a date in the assignedAt field if set
          it('splitTests entry assignedAt fields are Date objects', () => {
            // splitTests is stored as an object keyed by test name
            Object.values(record.splitTests || {}).forEach(test => {
              if (test.assignedAt) assert.ok(test.assignedAt instanceof Date)
            })
          })
          // tools/migrations/20220826104236_disable_alpha_beta_program.mjs
          // should be strictly false, but allow undefined for simplicity
          it('alpha/beta program are disabled', () => {
            assert.ok(
              record.alphaProgram === false || record.alphaProgram === undefined
            )
            assert.ok(
              record.betaProgram === false || record.betaProgram === undefined
            )
          })
          // tools/migrations/20220913125500_migrate_auditLog_to_collections.mjs
          it('obsolete auditLog field is not present', () => {
            assert.equal(record.auditLog, undefined)
          })
          // tools/migrations/20230124092607_clear_old_2fa_setup.mjs
          it('obsolete 2fa field is not present', () => {
            assert.equal(record.twoFactorAuthentication, undefined)
          })
          // tools/migrations/20240618125145_cleanup_user_features_templates.mjs
          // unsets features.templates
          it('features does not contain a templates field', () => {
            assert.equal(
              record.features?.templates,
              undefined,
              `features ${JSON.stringify(record.features)}`
            )
          })
          // tools/migrations/20240713110905_emails_reversed_hostname.mjs
          it('reversedHostname matches reversed email domain', () => {
            record.emails.forEach((emailObj, index) => {
              if (emailObj.email) {
                const expected = emailObj.email
                  .split('@')[1]
                  .split('')
                  .reverse()
                  .join('')
                assert.equal(
                  emailObj.reversedHostname,
                  expected,
                  `Email ${index} mismatch`
                )
              }
            })
          })
        })
      }
    }
  })

  describe('subscriptions collection', async () => {
    const records = await findDivergentRecords('subscriptions')
    if (records.length === 0) {
      it('no divergent records found', () => assert.ok(true))
    } else {
      for (const record of records) {
        describe(`Record: ${record._id}`, () => {
          // tools/migrations/20230110140452_rename_recurly_cached_status.mjs
          // renames recurly to recurlyStatus
          it('recurly field does not exist', () =>
            assert.equal(record.recurly, undefined))
          // tools/migrations/20230207134844_group_invite_emails_to_lowercase.mjs
          // changes array entries to lowercase
          it('teamInvites emails are lowercase', () => {
            record.teamInvites?.forEach(invite => {
              if (invite.email)
                assert.equal(invite.email, invite.email.toLowerCase())
            })
          })
          // tools/migrations/20230928092537_backfill_subscriptions_managed_users_feature_flag.mjs
          // unsets features.managedUsers if $ne:true
          // Note this is superseded by the 20241111133330_remove_null_managed_users_sso_from_subscriptions.mjs below
          it('features.managedUsers is either true or null', () => {
            const managedUsers = record.features?.managedUsers
            assert.ok(
              managedUsers === true || managedUsers === null,
              'features.managedUsers must be either true or null'
            )
          })
          // tools/migrations/20231030160030_managed_users_enabled.mjs
          // sets managedUsersEnabled to true when groupPolicy exists
          it('managedUsersEnabled is true if groupPolicy exists', () => {
            if ('groupPolicy' in record) {
              assert(record.managedUsersEnabled === true)
            }
          })
          // tools/migrations/20241111133330_remove_null_managed_users_sso_from_subscriptions.mjs
          it('features.managedUsers is true if set', () => {
            if (record.features && 'managedUsers' in record.features) {
              assert.strictEqual(
                record.features.managedUsers,
                true,
                'features.managedUsers must be true when set'
              )
            }
          })
          // also in tools/migrations/20241111133330_remove_null_managed_users_sso_from_subscriptions.mjs
          it('features.groupSSO is true if set', () => {
            if (record.features && 'groupSSO' in record.features) {
              assert.strictEqual(
                record.features.groupSSO,
                true,
                'features.groupSSO must be true when set'
              )
            }
          })
        })
      }
    }
  })
})
