import mongodb from 'mongodb-legacy'

import _ from 'lodash'
import Settings from '@overleaf/settings'

const { ObjectId } = mongodb

/**
 * @import { MongoProject } from "./types"
 */

const ENGINE_TO_COMPILER_MAP = {
  latex_dvipdf: 'latex',
  pdflatex: 'pdflatex',
  xelatex: 'xelatex',
  lualatex: 'lualatex',
}

export default {
  compilerFromV1Engine,
  isArchived,
  isTrashed,
  isArchivedOrTrashed,
  getAllowedImagesForUser,
  ensureNameIsUnique,
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
 * @returns string
 */
function ensureNameIsUnique(nameList, name, suffixes, maxLength) {
  // create a set of all project names
  if (suffixes == null) {
    suffixes = []
  }
  const allNames = new Set(nameList)
  const isUnique = x => !allNames.has(x)
  // check if the supplied name is already unique
  if (isUnique(name)) {
    return name
  }
  // the name already exists, try adding the user-supplied suffixes to generate a unique name
  for (const suffix of suffixes) {
    const candidateName = _addSuffixToProjectName(name, suffix, maxLength)
    if (isUnique(candidateName)) {
      return candidateName
    }
  }
  // if there are no (more) suffixes, use a numeric one
  const uniqueName = _addNumericSuffixToProjectName(name, allNames, maxLength)
  if (uniqueName != null) {
    return uniqueName
  } else {
    throw new Error(`Failed to generate a unique name for: ${name}`)
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

function _imageAllowed(user, image) {
  if (image.alphaOnly) {
    return Boolean(user?.alphaProgram)
  }
  if (image.monthlyExperimental) {
    return Boolean(
      user?.labsProgram && user.labsExperiments.includes('monthly-texlive')
    )
  }
  return true
}

function getAllowedImagesForUser(user) {
  let images = Settings.allowedImageNames || []

  images = images.map(image => {
    return {
      ...image,
      allowed: _imageAllowed(user, image),
      rolling: image.monthlyExperimental,
    }
  })

  return images
}
