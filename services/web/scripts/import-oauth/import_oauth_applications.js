/* eslint-disable max-len */
/**
 * run with: node import_oauth_applications /path/oauth_applications.csv
 *
 * where csv is generated from v1 with sql statement like:
 *
 * \copy (SELECT * FROM oauth_applications) to 'oauth_applications.csv' WITH CSV HEADER;
 */
/* eslint-enable */

'use strict'

const OauthApplication = require('../../app/src/models/OauthApplication')
  .OauthApplication
const async = require('async')
const csvParser = require('csv-parser')
const fs = require('fs')
const minimist = require('minimist')

const argv = minimist(process.argv.slice(2))

const records = []

fs.createReadStream(argv._[0])
  .pipe(csvParser())
  .on('data', data => records.push(data))
  .on('end', () => {
    async.mapSeries(records, loadRecord, function(err) {
      if (err) console.error(err)
      process.exit()
    })
  })

function loadRecord(record, cb) {
  const newRecord = {
    clientSecret: record.secret,
    id: record.uid,
    // doorkeeper does not define grant types so add all supported
    grants: ['authorization_code', 'refresh_token', 'password'],
    name: record.name,
    // redirect uris are stored new-line separated
    redirectUris: record.redirect_uri.split(/\r?\n/),
    // scopes are stored space separated
    scopes: record.scopes.split(/\s+/)
  }
  console.log('Creating OauthApplication ' + newRecord.name)
  OauthApplication.update(newRecord, newRecord, { upsert: true }, cb)
}
