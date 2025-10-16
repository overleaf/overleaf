import _ from 'lodash'
import settings from '@overleaf/settings'

const ClsiFormatChecker = {
  checkRecoursesForProblems(resources) {
    let problems = {
      conflictedPaths: ClsiFormatChecker._checkForConflictingPaths(resources),
      sizeCheck: ClsiFormatChecker._checkDocsAreUnderSizeLimit(resources),
    }

    problems = _.omitBy(problems, _.isEmpty)
    if (!_.isEmpty(problems)) {
      return problems
    }
  },

  _checkForConflictingPaths(resources) {
    const paths = resources.map(resource => resource.path)

    const conflicts = _.filter(paths, function (path) {
      const matchingPaths = _.filter(
        paths,
        checkPath => checkPath.indexOf(path + '/') !== -1
      )

      return matchingPaths.length > 0
    })

    const conflictObjects = conflicts.map(conflict => ({ path: conflict }))

    return conflictObjects
  },

  _checkDocsAreUnderSizeLimit(resources) {
    const sizeLimit = 1000 * 1000 * settings.compileBodySizeLimitMb

    let totalSize = 0

    let sizedResources = resources.map(function (resource) {
      const result = { path: resource.path }
      if (resource.content != null) {
        result.size = resource.content.replace(/\n/g, '').length
        result.kbSize = Math.ceil(result.size / 1000)
      } else {
        result.size = 0
      }
      totalSize += result.size
      return result
    })

    const tooLarge = totalSize > sizeLimit
    if (tooLarge) {
      sizedResources = _.sortBy(sizedResources, 'size').reverse().slice(0, 10)
      return { resources: sizedResources, totalSize }
    }
  },
}

export default ClsiFormatChecker
