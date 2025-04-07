const _ = require('lodash')
const logger = require('@overleaf/logger')
const OError = require('@overleaf/o-error')
const async = require('async')
const ProjectGetter = require('./ProjectGetter')
const Errors = require('../Errors/Errors')
const { promisifyMultiResult } = require('@overleaf/promise-utils')
const { iterablePaths } = require('./IterablePath')

/**
 * @param project
 * @param predicate
 * @returns {{path: string, value: *}}
 */
function findDeep(project, predicate) {
  function find(value, path) {
    if (predicate(value)) {
      return { value, path: path.join('.') }
    }
    if (typeof value === 'object' && value !== null) {
      for (const [childKey, childVal] of Object.entries(value)) {
        const found = find(childVal, [...path, childKey])
        if (found) {
          return found
        }
      }
    }
  }
  return find(project.rootFolder, ['rootFolder'])
}

function findElement(options, _callback) {
  // The search algorithm below potentially invokes the callback multiple
  // times.
  const callback = _.once(_callback)

  const {
    project,
    project_id: projectId,
    element_id: elementId,
    type,
  } = options
  const elementType = sanitizeTypeOfElement(type)

  let count = 0
  const endOfBranch = function () {
    if (--count === 0) {
      logger.warn(
        `element ${elementId} could not be found for project ${
          projectId || project._id
        }`
      )
      callback(new Errors.NotFoundError('entity not found'))
    }
  }

  function search(searchFolder, path) {
    count++
    const element = _.find(
      searchFolder[elementType],
      el => (el != null ? el._id : undefined) + '' === elementId + ''
    ) // need to ToString both id's for robustness
    if (
      element == null &&
      searchFolder.folders != null &&
      searchFolder.folders.length !== 0
    ) {
      _.forEach(searchFolder.folders, (folder, index) => {
        if (folder == null) {
          return
        }
        const newPath = {}
        for (const key of Object.keys(path)) {
          const value = path[key]
          newPath[key] = value
        } // make a value copy of the string
        newPath.fileSystem += `/${folder.name}`
        newPath.mongo += `.folders.${index}`
        search(folder, newPath)
      })
      endOfBranch()
    } else if (element != null) {
      const elementPlaceInArray = getIndexOf(
        searchFolder[elementType],
        elementId
      )
      path.fileSystem += `/${element.name}`
      path.mongo += `.${elementType}.${elementPlaceInArray}`
      callback(null, element, path, searchFolder)
    } else if (element == null) {
      endOfBranch()
    }
  }

  const path = { fileSystem: '', mongo: 'rootFolder.0' }

  const startSearch = project => {
    if (elementId + '' === project.rootFolder[0]._id + '') {
      callback(null, project.rootFolder[0], path, null)
    } else {
      search(project.rootFolder[0], path)
    }
  }

  if (project != null) {
    startSearch(project)
  } else {
    ProjectGetter.getProject(
      projectId,
      { rootFolder: true, rootDoc_id: true },
      (err, project) => {
        if (err != null) {
          return callback(err)
        }
        if (project == null) {
          return callback(new Errors.NotFoundError('project not found'))
        }
        startSearch(project)
      }
    )
  }
}

function findRootDoc(opts, callback) {
  const getRootDoc = project => {
    if (project.rootDoc_id != null) {
      findElement(
        { project, element_id: project.rootDoc_id, type: 'docs' },
        (error, ...args) => {
          if (error != null) {
            if (error instanceof Errors.NotFoundError) {
              return callback(null, null)
            } else {
              return callback(error)
            }
          }
          callback(null, ...args)
        }
      )
    } else {
      callback(null, null)
    }
  }
  const { project, project_id: projectId } = opts
  if (project != null) {
    getRootDoc(project)
  } else {
    ProjectGetter.getProject(
      projectId,
      { rootFolder: true, rootDoc_id: true },
      (err, project) => {
        if (err != null) {
          logger.warn({ err }, 'error getting project')
          callback(err)
        } else {
          getRootDoc(project)
        }
      }
    )
  }
}

function findElementByPath(options, callback) {
  const { project, project_id: projectId, path, exactCaseMatch } = options
  if (path == null) {
    return new Error('no path provided for findElementByPath')
  }

  if (project != null) {
    _findElementByPathWithProject(project, path, exactCaseMatch, callback)
  } else {
    ProjectGetter.getProject(
      projectId,
      { rootFolder: true, rootDoc_id: true },
      (err, project) => {
        if (err != null) {
          return callback(err)
        }
        _findElementByPathWithProject(project, path, exactCaseMatch, callback)
      }
    )
  }
}

function _findElementByPathWithProject(
  project,
  needlePath,
  exactCaseMatch,
  callback
) {
  let matchFn
  if (exactCaseMatch) {
    matchFn = (a, b) => a === b
  } else {
    matchFn = (a, b) =>
      (a != null ? a.toLowerCase() : undefined) ===
      (b != null ? b.toLowerCase() : undefined)
  }

  function getParentFolder(haystackFolder, foldersList, level, cb) {
    if (foldersList.length === 0) {
      return cb(null, haystackFolder)
    }
    const needleFolderName = foldersList[level]
    let found = false
    for (const folder of haystackFolder.folders) {
      if (matchFn(folder.name, needleFolderName)) {
        found = true
        if (level === foldersList.length - 1) {
          return cb(null, folder)
        } else {
          return getParentFolder(folder, foldersList, level + 1, cb)
        }
      }
    }
    if (!found) {
      cb(
        new Error(
          `not found project: ${project._id} search path: ${needlePath}, folder ${foldersList[level]} could not be found`
        )
      )
    }
  }

  function getEntity(folder, entityName, cb) {
    let result, type
    if (entityName == null) {
      return cb(null, folder, 'folder', null)
    }
    for (const file of iterablePaths(folder, 'fileRefs')) {
      if (matchFn(file != null ? file.name : undefined, entityName)) {
        result = file
        type = 'file'
      }
    }
    for (const doc of iterablePaths(folder, 'docs')) {
      if (matchFn(doc != null ? doc.name : undefined, entityName)) {
        result = doc
        type = 'doc'
      }
    }
    for (const childFolder of iterablePaths(folder, 'folders')) {
      if (
        matchFn(childFolder != null ? childFolder.name : undefined, entityName)
      ) {
        result = childFolder
        type = 'folder'
      }
    }

    if (result != null) {
      cb(null, result, type, folder)
    } else {
      cb(
        new Error(
          `not found project: ${project._id} search path: ${needlePath}, entity ${entityName} could not be found`
        )
      )
    }
  }

  if (project == null) {
    return callback(new Error('Tried to find an element for a null project'))
  }
  if (needlePath === '' || needlePath === '/') {
    return callback(null, project.rootFolder[0], 'folder', null)
  }

  if (needlePath.indexOf('/') === 0) {
    needlePath = needlePath.substring(1)
  }
  const foldersList = needlePath.split('/')
  const needleName = foldersList.pop()
  const rootFolder = project.rootFolder[0]

  const jobs = []
  jobs.push(cb => getParentFolder(rootFolder, foldersList, 0, cb))
  jobs.push((folder, cb) => getEntity(folder, needleName, cb))
  async.waterfall(jobs, callback)
}

function sanitizeTypeOfElement(elementType) {
  const lastChar = elementType.slice(-1)
  if (lastChar !== 's') {
    elementType += 's'
  }
  if (elementType === 'files') {
    elementType = 'fileRefs'
  }
  return elementType
}

function getIndexOf(searchEntity, id) {
  const { length } = searchEntity
  let count = 0
  while (count < length) {
    if (
      (searchEntity[count] != null ? searchEntity[count]._id : undefined) +
        '' ===
      id + ''
    ) {
      return count
    }
    count++
  }
}

/**
 * Follow the given Mongo path (as returned by findElement) and return the
 * entity at the end of it.
 */
function findElementByMongoPath(project, mongoPath) {
  const components = mongoPath.split('.')
  let node = project
  for (const component of components) {
    const key = Array.isArray(node) ? parseInt(component, 10) : component
    node = node[key]
    if (node == null) {
      throw new OError('entity not found', {
        projectId: project._id,
        mongoPath,
      })
    }
  }
  return node
}

module.exports = {
  findElement,
  findElementByPath,
  findRootDoc,
  findElementByMongoPath,
  findDeep,
  promises: {
    findElement: promisifyMultiResult(findElement, [
      'element',
      'path',
      'folder',
    ]),
    findElementByPath: promisifyMultiResult(findElementByPath, [
      'element',
      'type',
      'folder',
    ]),
    findRootDoc: promisifyMultiResult(findRootDoc, [
      'element',
      'path',
      'folder',
    ]),
  },
}
