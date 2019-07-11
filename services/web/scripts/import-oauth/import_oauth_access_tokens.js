/* eslint-disable max-len */
/**
 * run with: node import_oauth_access_tokens /path/import_oauth_access_tokens.csv
 *
 * where csv is generated from v1 with sql statement like:
 *
 * \copy ( SELECT oat.token, oat.refresh_token, oat.scopes, oat.resource_owner_id AS user_id, u.email, u.confirmed_at, oa.uid AS client_id, oat.created_at + oat.expires_in * interval '1 second' AS expires_at FROM  oauth_access_tokens oat LEFT JOIN oauth_access_tokens oat2 ON oat2.previous_refresh_token = oat.refresh_token JOIN oauth_applications oa ON oat.application_id = oa.id JOIN users u ON u.id = oat.resource_owner_id WHERE (oat2.id IS NULL OR oat2.created_at > NOW() - interval '24 hour') AND oat.revoked_at IS NULL AND (oat.application_id = 1 OR (oat.application_id = 2 AND oat.created_at + oat.expires_in * interval '1 second' > NOW())) ) to 'oauth_access_tokens.csv' WITH CSV HEADER;
 *
 * this query exports the most recent collabractec (1) and gitbridge (2) tokens for
 * each user. expired tokens are exported for collabratec but not for gitbridge.
 *
 * tokens that have been refreshed are not exported if it has been over 24 hours
 * since the new token was issued.
 */
/* eslint-enable */

'use strict'

const OauthApplication = require('../../app/src/models/OauthApplication')
  .OauthApplication
const OauthAccessToken = require('../../app/src/models/OauthAccessToken')
  .OauthAccessToken
const User = require('../../app/src/models/User').User
const UserMapper = require('../../modules/overleaf-integration/app/src/OverleafUsers/UserMapper')
const async = require('async')
const csvParser = require('csv-parser')
const fs = require('fs')
const minimist = require('minimist')

const argv = minimist(process.argv.slice(2))

let lineNum = 0
const records = []

fs.createReadStream(argv._[0])
  .pipe(csvParser())
  .on('data', data => {
    data.lineNum = ++lineNum
    records.push(data)
  })
  .on('end', () => {
    async.mapSeries(records, loadRecord, function(err) {
      if (err) console.error(err)
      process.exit()
    })
  })

function loadRecord(record, cb) {
  getOauthApplication(record.client_id, function(err, oauthApplication) {
    if (err) return cb(err)
    const overleafId = parseInt(record.user_id)
    User.findOne({ 'overleaf.id': overleafId }, { _id: 1 }, function(
      err,
      user
    ) {
      if (err) return cb(err)
      if (user) {
        console.log(
          record.lineNum + ': Creating OauthAccessToken for User ' + user._id
        )
        createOauthAccessToken(user._id, oauthApplication._id, record, cb)
      } else {
        // create user stub
        const olUser = {
          confirmed_at: record.confirmed_at,
          email: record.email,
          id: overleafId
        }
        console.log(record.lineNum + ': User not found for ' + record.user_id)
        return UserMapper.getSlIdFromOlUser(olUser, function(err, userStubId) {
          if (err) return cb(err)
          console.log(
            record.lineNum +
              ': Creating OauthAccessToken for UserStub ' +
              userStubId
          )
          createOauthAccessToken(userStubId, oauthApplication._id, record, cb)
        })
      }
    })
  })
}

function createOauthAccessToken(userId, oauthApplicationId, record, cb) {
  const newRecord = {
    accessToken: record.token,
    accessTokenExpiresAt: record.expires_at,
    oauthApplication_id: oauthApplicationId,
    refreshToken: record.refresh_token,
    scope: record.scopes,
    user_id: userId
  }
  OauthAccessToken.update(newRecord, newRecord, { upsert: true }, cb)
}

const oauthApplications = {}

function getOauthApplication(clientId, cb) {
  if (oauthApplications[clientId]) return cb(null, oauthApplications[clientId])
  OauthApplication.findOne({ id: clientId }, { _id: 1 }, function(
    err,
    oauthApplication
  ) {
    if (err) return cb(err)
    if (!oauthApplication) return cb(new Error('oauthApplication not found'))
    oauthApplications[clientId] = oauthApplication
    cb(null, oauthApplication)
  })
}
