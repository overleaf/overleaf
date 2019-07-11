/* eslint-disable max-len */
/**
 * run with: node import_user_collabratec_ids /path/user_collabratec_ids.csv
 *
 * where csv is generated from v1 with sql statement like:
 *
 * \copy ( SELECT ut.user_id, u.email, u.confirmed_at, ut.team_user_id AS collabratec_id FROM user_teams ut JOIN teams t ON ut.team_id = t.id JOIN users u ON ut.user_id = u.id WHERE t.name = 'IEEECollabratec' AND ut.removed_at IS NULL AND ut.team_user_id IS NOT NULL ) to 'user_collabratec_ids.csv' WITH CSV HEADER;
 */
/* eslint-enable */

'use strict'

const UserMapper = require('../../modules/overleaf-integration/app/src/OverleafUsers/UserMapper')
const User = require('../../app/src/models/User').User
const UserStub = require('../../app/src/models/UserStub').UserStub
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
  const overleafId = parseInt(record.user_id)
  User.findOne(
    { 'overleaf.id': overleafId },
    { _id: 1, thirdPartyIdentifiers: 1 },
    function(err, user) {
      if (err) return cb(err)
      const query = {
        'thirdPartyIdentifiers.providerId': {
          $ne: 'collabratec'
        }
      }
      const update = {
        $push: {
          thirdPartyIdentifiers: {
            externalUserId: record.collabratec_id,
            externalData: {},
            providerId: 'collabratec'
          }
        }
      }
      if (user) {
        console.log(record.lineNum + ': setting TPI for User ' + user._id)
        query._id = user._id
        User.update(query, update, cb)
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
            record.lineNum + ': setting TPI for UserStub ' + userStubId
          )
          query._id = userStubId
          UserStub.update(query, update, cb)
        })
      }
    }
  )
}
