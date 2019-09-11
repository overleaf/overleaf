/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-array-constructor,
    no-return-assign,
    no-undef,
    no-unused-vars,
    standard/no-callback-literal,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS203: Remove `|| {}` from converted for-own loops
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ProjectLocator
const { Project } = require('../../models/Project')
const ProjectGetter = require('./ProjectGetter')
const ProjectHelper = require('./ProjectHelper')
const Errors = require('../Errors/Errors')
const _ = require('underscore')
const logger = require('logger-sharelatex')
const async = require('async')

module.exports = ProjectLocator = {
  findElement(options, _callback) {
    if (_callback == null) {
      _callback = function(err, element, path, parentFolder) {}
    }
    const callback = function(...args) {
      _callback(...Array.from(args || []))
      return (_callback = function() {})
    }

    const { project, project_id, element_id, type } = options
    const elementType = sanitizeTypeOfElement(type)

    let count = 0
    const endOfBranch = function() {
      if (--count === 0) {
        logger.warn(
          `element ${element_id} could not be found for project ${project_id ||
            project._id}`
        )
        return callback(new Errors.NotFoundError('entity not found'))
      }
    }

    var search = function(searchFolder, path) {
      count++
      const element = _.find(
        searchFolder[elementType],
        el => (el != null ? el._id : undefined) + '' === element_id + ''
      ) // need to ToString both id's for robustness
      if (
        element == null &&
        searchFolder.folders != null &&
        searchFolder.folders.length !== 0
      ) {
        _.each(searchFolder.folders, function(folder, index) {
          if (folder == null) {
            return
          }
          const newPath = {}
          for (let key of Object.keys(path || {})) {
            const value = path[key]
            newPath[key] = value
          } // make a value copy of the string
          newPath.fileSystem += `/${folder.name}`
          newPath.mongo += `.folders.${index}`
          return search(folder, newPath)
        })
        endOfBranch()
      } else if (element != null) {
        const elementPlaceInArray = getIndexOf(
          searchFolder[elementType],
          element_id
        )
        path.fileSystem += `/${element.name}`
        path.mongo += `.${elementType}.${elementPlaceInArray}`
        return callback(null, element, path, searchFolder)
      } else if (element == null) {
        return endOfBranch()
      }
    }

    const path = { fileSystem: '', mongo: 'rootFolder.0' }

    const startSearch = function(project) {
      if (element_id + '' === project.rootFolder[0]._id + '') {
        return callback(null, project.rootFolder[0], path, null)
      } else {
        return search(project.rootFolder[0], path)
      }
    }

    if (project != null) {
      return startSearch(project)
    } else {
      return ProjectGetter.getProject(
        project_id,
        { rootFolder: true, rootDoc_id: true },
        function(err, project) {
          if (err != null) {
            return callback(err)
          }
          if (project == null) {
            return callback(new Errors.NotFoundError('project not found'))
          }
          return startSearch(project)
        }
      )
    }
  },

  findRootDoc(opts, callback) {
    const getRootDoc = project => {
      if (project.rootDoc_id != null) {
        return this.findElement(
          { project, element_id: project.rootDoc_id, type: 'docs' },
          function(error, ...args) {
            if (error != null) {
              if (error instanceof Errors.NotFoundError) {
                return callback(null, null)
              } else {
                return callback(error)
              }
            }
            return callback(null, ...Array.from(args))
          }
        )
      } else {
        return callback(null, null)
      }
    }
    const { project, project_id } = opts
    if (project != null) {
      return getRootDoc(project)
    } else {
      return ProjectGetter.getProject(
        project_id,
        { rootFolder: true, rootDoc_id: true },
        function(err, project) {
          if (err != null) {
            logger.warn({ err }, 'error getting project')
            return callback(err)
          } else {
            return getRootDoc(project)
          }
        }
      )
    }
  },

  findElementByPath(options, callback) {
    if (callback == null) {
      callback = function(err, foundEntity, type) {}
    }
    const { project, project_id, path, exactCaseMatch } = options
    if (path == null) {
      return new Error('no path provided for findElementByPath')
    }

    if (project != null) {
      return ProjectLocator._findElementByPathWithProject(
        project,
        path,
        exactCaseMatch,
        callback
      )
    } else {
      return ProjectGetter.getProject(
        project_id,
        { rootFolder: true, rootDoc_id: true },
        function(err, project) {
          if (err != null) {
            return callback(err)
          }
          return ProjectLocator._findElementByPathWithProject(
            project,
            path,
            exactCaseMatch,
            callback
          )
        }
      )
    }
  },

  _findElementByPathWithProject(project, needlePath, exactCaseMatch, callback) {
    let matchFn
    if (callback == null) {
      callback = function(err, foundEntity, type) {}
    }
    if (exactCaseMatch) {
      matchFn = (a, b) => a === b
    } else {
      matchFn = (a, b) =>
        (a != null ? a.toLowerCase() : undefined) ===
        (b != null ? b.toLowerCase() : undefined)
    }

    var getParentFolder = function(haystackFolder, foldersList, level, cb) {
      if (foldersList.length === 0) {
        return cb(null, haystackFolder)
      }
      const needleFolderName = foldersList[level]
      let found = false
      for (let folder of Array.from(haystackFolder.folders)) {
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
        return cb(
          `not found project: ${
            project._id
          } search path: ${needlePath}, folder ${
            foldersList[level]
          } could not be found`
        )
      }
    }

    const getEntity = function(folder, entityName, cb) {
      let result, type
      if (entityName == null) {
        return cb(null, folder, 'folder')
      }
      for (let file of Array.from(folder.fileRefs || [])) {
        if (matchFn(file != null ? file.name : undefined, entityName)) {
          result = file
          type = 'file'
        }
      }
      for (let doc of Array.from(folder.docs || [])) {
        if (matchFn(doc != null ? doc.name : undefined, entityName)) {
          result = doc
          type = 'doc'
        }
      }
      for (let childFolder of Array.from(folder.folders || [])) {
        if (
          matchFn(
            childFolder != null ? childFolder.name : undefined,
            entityName
          )
        ) {
          result = childFolder
          type = 'folder'
        }
      }

      if (result != null) {
        return cb(null, result, type)
      } else {
        return cb(
          `not found project: ${
            project._id
          } search path: ${needlePath}, entity ${entityName} could not be found`
        )
      }
    }

    if (typeof err !== 'undefined' && err !== null) {
      logger.warn(
        { err, project_id: project._id },
        'error getting project for finding element'
      )
      return callback(err)
    }
    if (project == null) {
      return callback('Tried to find an element for a null project')
    }
    if (needlePath === '' || needlePath === '/') {
      return callback(null, project.rootFolder[0], 'folder')
    }

    if (needlePath.indexOf('/') === 0) {
      needlePath = needlePath.substring(1)
    }
    const foldersList = needlePath.split('/')
    const needleName = foldersList.pop()
    const rootFolder = project.rootFolder[0]

    logger.log(
      { project_id: project._id, path: needlePath, foldersList },
      'looking for element by path'
    )
    const jobs = new Array()
    jobs.push(cb => getParentFolder(rootFolder, foldersList, 0, cb))
    jobs.push((folder, cb) => getEntity(folder, needleName, cb))
    return async.waterfall(jobs, callback)
  },

  findUsersProjectByName(user_id, projectName, callback) {
    return ProjectGetter.findAllUsersProjects(
      user_id,
      'name archived trashed',
      function(err, allProjects) {
        if (typeof error !== 'undefined' && error !== null) {
          return callback(error)
        }
        const { owned, readAndWrite } = allProjects
        const projects = owned.concat(readAndWrite)
        projectName = projectName.toLowerCase()
        const project = _.find(
          projects,
          project =>
            project.name.toLowerCase() === projectName &&
            !ProjectHelper.isArchivedOrTrashed(project, user_id)
        )
        logger.log(
          { user_id, projectName, totalProjects: projects.length, project },
          'looking for project by name'
        )
        return callback(null, project)
      }
    )
  }
}

var sanitizeTypeOfElement = function(elementType) {
  const lastChar = elementType.slice(-1)
  if (lastChar !== 's') {
    elementType += 's'
  }
  if (elementType === 'files') {
    elementType = 'fileRefs'
  }
  return elementType
}

var getIndexOf = function(searchEntity, id) {
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
