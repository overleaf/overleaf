/* eslint-disable
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ClsiFormatChecker
const _ = require('lodash')
const async = require('async')
const settings = require('settings-sharelatex')

module.exports = ClsiFormatChecker = {
  checkRecoursesForProblems(resources, callback) {
    const jobs = {
      conflictedPaths(cb) {
        return ClsiFormatChecker._checkForConflictingPaths(resources, cb)
      },

      sizeCheck(cb) {
        return ClsiFormatChecker._checkDocsAreUnderSizeLimit(resources, cb)
      }
    }

    return async.series(jobs, function(err, problems) {
      if (err != null) {
        return callback(err)
      }

      problems = _.omitBy(problems, _.isEmpty)

      if (_.isEmpty(problems)) {
        return callback()
      } else {
        return callback(null, problems)
      }
    })
  },

  _checkForConflictingPaths(resources, callback) {
    const paths = _.map(resources, 'path')

    const conflicts = _.filter(paths, function(path) {
      const matchingPaths = _.filter(
        paths,
        checkPath => checkPath.indexOf(path + '/') !== -1
      )

      return matchingPaths.length > 0
    })

    const conflictObjects = _.map(conflicts, conflict => ({ path: conflict }))

    return callback(null, conflictObjects)
  },

  _checkDocsAreUnderSizeLimit(resources, callback) {
    const sizeLimit = 1000 * 1000 * settings.compileBodySizeLimitMb

    let totalSize = 0

    let sizedResources = _.map(resources, function(resource) {
      const result = { path: resource.path }
      if (resource.content != null) {
        result.size = resource.content.replace(/\n/g).length
        result.kbSize = Math.ceil(result.size / 1000)
      } else {
        result.size = 0
      }
      totalSize += result.size
      return result
    })

    const tooLarge = totalSize > sizeLimit
    if (!tooLarge) {
      return callback()
    } else {
      sizedResources = _.sortBy(sizedResources, 'size')
        .reverse()
        .slice(0, 10)
      return callback(null, { resources: sizedResources, totalSize })
    }
  }
}
