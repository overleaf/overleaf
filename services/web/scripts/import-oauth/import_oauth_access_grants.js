/* eslint-disable max-len */
/**
 * run with: node import_oauth_access_grants /path/oauth_access_grants.csv
 *
 * where csv is generated from v1 with sql statement like:
 *
 * \copy ( SELECT oag.token, oag.scopes, oag.redirect_uri, resource_owner_id AS user_id, oa.uid AS client_id, oag.created_at + oag.expires_in * interval '1 second' AS expires_at FROM oauth_access_grants oag JOIN oauth_applications oa ON oag.application_id = oa.id WHERE oa.id = 1 AND oag.revoked_at IS NULL AND oag.created_at + oag.expires_in * interval '1 second' > NOW() ) to 'oauth_access_grants.csv' WITH CSV HEADER;
 *
 * this query exports the most non-expired oauth authorization codes for collabractec (1)
 *
 /* eslint-enable */

'use strict'

const OauthApplication = require('../../app/src/models/OauthApplication')
  .OauthApplication
const OauthAuthorizationCode = require('../../app/src/models/OauthAuthorizationCode')
  .OauthAuthorizationCode
const User = require('../../app/src/models/User').User
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
    User.findOne(
      { 'overleaf.id': parseInt(record.user_id) },
      { _id: 1 },
      function(err, user) {
        if (err) return cb(err)
        if (!user) {
          console.log(
            record.lineNum +
              ': User not found for ' +
              record.user_id +
              ' - skipping'
          )
          return cb()
        }
        const newRecord = {
          authorizationCode: record.token,
          expiresAt: record.expires_at,
          oauthApplication_id: oauthApplication._id,
          redirectUri: record.redirect_uri,
          scope: record.scopes,
          user_id: user._id
        }
        console.log(
          record.lineNum +
            'Creating OauthAuthorizationCode for User ' +
            user._id
        )
        OauthAuthorizationCode.update(
          newRecord,
          newRecord,
          { upsert: true },
          cb
        )
      }
    )
  })
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
