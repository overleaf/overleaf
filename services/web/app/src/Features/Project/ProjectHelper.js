/* eslint-disable
    handle-callback-err,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const ENGINE_TO_COMPILER_MAP = {
  latex_dvipdf: 'latex',
  pdflatex: 'pdflatex',
  xelatex: 'xelatex',
  lualatex: 'lualatex'
}
const { ObjectId } = require('../../infrastructure/mongojs')
const { promisify } = require('util')

const ProjectHelper = {
  compilerFromV1Engine(engine) {
    return ENGINE_TO_COMPILER_MAP[engine]
  },

  isArchived(project, userId) {
    userId = ObjectId(userId)

    if (Array.isArray(project.archived)) {
      return project.archived.find(id => id.equals(userId)) !== undefined
    } else {
      return !!project.archived
    }
  },

  isTrashed(project, userId) {
    userId = ObjectId(userId)

    if (project.trashed) {
      return project.trashed.find(id => id.equals(userId)) !== undefined
    } else {
      return false
    }
  },

  isArchivedOrTrashed(project, userId) {
    return (
      ProjectHelper.isArchived(project, userId) ||
      ProjectHelper.isTrashed(project, userId)
    )
  },

  ensureNameIsUnique(nameList, name, suffixes, maxLength, callback) {
    // create a set of all project names
    if (suffixes == null) {
      suffixes = []
    }
    if (callback == null) {
      callback = function(error, name) {}
    }
    const allNames = new Set(nameList)
    const isUnique = x => !allNames.has(x)
    // check if the supplied name is already unique
    if (isUnique(name)) {
      return callback(null, name)
    }
    // the name already exists, try adding the user-supplied suffixes to generate a unique name
    for (let suffix of Array.from(suffixes)) {
      const candidateName = ProjectHelper._addSuffixToProjectName(
        name,
        suffix,
        maxLength
      )
      if (isUnique(candidateName)) {
        return callback(null, candidateName)
      }
    }
    // if there are no (more) suffixes, use a numeric one
    const uniqueName = ProjectHelper._addNumericSuffixToProjectName(
      name,
      allNames,
      maxLength
    )
    if (uniqueName != null) {
      return callback(null, uniqueName)
    } else {
      return callback(
        new Error(`Failed to generate a unique name for: ${name}`)
      )
    }
  },

  _addSuffixToProjectName(name, suffix, maxLength) {
    // append the suffix and truncate the project title if needed
    if (suffix == null) {
      suffix = ''
    }
    const truncatedLength = maxLength - suffix.length
    return name.substr(0, truncatedLength) + suffix
  },

  _addNumericSuffixToProjectName(name, allProjectNames, maxLength) {
    const NUMERIC_SUFFIX_MATCH = / \((\d+)\)$/
    const suffixedName = function(basename, number) {
      const suffix = ` (${number})`
      return basename.substr(0, maxLength - suffix.length) + suffix
    }

    const match = name.match(NUMERIC_SUFFIX_MATCH)
    let basename = name
    let n = 1
    const last = allProjectNames.size + n

    if (match != null) {
      basename = name.replace(NUMERIC_SUFFIX_MATCH, '')
      n = parseInt(match[1])
    }

    while (n <= last) {
      const candidate = suffixedName(basename, n)
      if (!allProjectNames.has(candidate)) {
        return candidate
      }
      n += 1
    }

    return null
  }
}

ProjectHelper.promises = {
  ensureNameIsUnique: promisify(ProjectHelper.ensureNameIsUnique)
}
module.exports = ProjectHelper
