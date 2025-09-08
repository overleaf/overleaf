// @ts-check
const { ObjectId } = require('mongodb-legacy')
const _ = require('lodash')
const { promisify } = require('util')
const Settings = require('@overleaf/settings')

/**
 * @import { MongoProject } from "./types"
 */

const ENGINE_TO_COMPILER_MAP = {
  latex_dvipdf: 'latex',
  pdflatex: 'pdflatex',
  xelatex: 'xelatex',
  lualatex: 'lualatex',
}

module.exports = {
  compilerFromV1Engine,
  isArchived,
  isTrashed,
  isArchivedOrTrashed,
  ensureNameIsUnique,
  getAllowedImagesForUser,
  promises: {
    ensureNameIsUnique: promisify(ensureNameIsUnique),
  },
}

function compilerFromV1Engine(engine) {
  return ENGINE_TO_COMPILER_MAP[engine]
}

/**
 @param {MongoProject} project
 @param {string} rawUserId
 * @returns {boolean}
 */
function isArchived(project, rawUserId) {
  const userId = new ObjectId(rawUserId)

  return (project.archived || []).some(id => id.equals(userId))
}

/**
 * @param {MongoProject} project
 * @param {string} rawUserId
 * @returns {boolean}
 */
function isTrashed(project, rawUserId) {
  const userId = new ObjectId(rawUserId)

  return (project.trashed || []).some(id => id.equals(userId))
}

/**
 * @param {MongoProject} project
 * @param {string} userId
 * @returns {boolean}
 */
function isArchivedOrTrashed(project, userId) {
  return isArchived(project, userId) || isTrashed(project, userId)
}

/**
 * @param {string[]} nameList
 * @param {string} name
 * @param {string[]} suffixes
 * @param {number} maxLength
 */
function ensureNameIsUnique(nameList, name, suffixes, maxLength, callback) {
  // create a set of all project names
  if (suffixes == null) {
    suffixes = []
  }
  const allNames = new Set(nameList)
  const isUnique = x => !allNames.has(x)
  // check if the supplied name is already unique
  if (isUnique(name)) {
    return callback(null, name)
  }
  // the name already exists, try adding the user-supplied suffixes to generate a unique name
  for (const suffix of suffixes) {
    const candidateName = _addSuffixToProjectName(name, suffix, maxLength)
    if (isUnique(candidateName)) {
      return callback(null, candidateName)
    }
  }
  // if there are no (more) suffixes, use a numeric one
  const uniqueName = _addNumericSuffixToProjectName(name, allNames, maxLength)
  if (uniqueName != null) {
    callback(null, uniqueName)
  } else {
    callback(new Error(`Failed to generate a unique name for: ${name}`))
  }
}

function _addSuffixToProjectName(name, suffix, maxLength) {
  // append the suffix and truncate the project title if needed
  if (suffix == null) {
    suffix = ''
  }
  const truncatedLength = maxLength - suffix.length
  return name.substr(0, truncatedLength) + suffix
}

/**
 * @param {string} name
 * @param {Set<string>} allProjectNames
 * @param {number} maxLength
 */
function _addNumericSuffixToProjectName(name, allProjectNames, maxLength) {
  const NUMERIC_SUFFIX_MATCH = / \((\d+)\)$/
  const suffixedName = function (basename, number) {
    const suffix = ` (${number})`
    return basename.substr(0, maxLength - suffix.length) + suffix
  }

  const match = name.match(NUMERIC_SUFFIX_MATCH)
  let basename = name
  let n = 1

  if (match != null) {
    basename = name.replace(NUMERIC_SUFFIX_MATCH, '')
    n = parseInt(match[1])
  }

  const prefixMatcher = new RegExp(`^${_.escapeRegExp(basename)} \\(\\d+\\)$`)

  const projectNamesWithSamePrefix = Array.from(allProjectNames).filter(name =>
    prefixMatcher.test(name)
  )
  const last = allProjectNames.size + n
  const nIsLikelyAYear = n > 1000 && projectNamesWithSamePrefix.length < n / 2
  if (nIsLikelyAYear) {
    basename = name
    n = 1
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

function getAllowedImagesForUser(user) {
  const images = Settings.allowedImageNames || []
  if (user?.alphaProgram) {
    return images
  } else {
    return images.filter(image => !image.alphaOnly)
  }
}
