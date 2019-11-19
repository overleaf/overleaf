const ProjectGetter = require('./ProjectGetter')
const ProjectHelper = require('./ProjectHelper')
const Errors = require('../Errors/Errors')
const _ = require('underscore')
const logger = require('logger-sharelatex')
const async = require('async')
const { promisifyAll } = require('../../util/promises')

const ProjectLocator = {
  findElement(options, _callback) {
    // The search algorithm below potentially invokes the callback multiple
    // times.
    const callback = _.once(_callback)

    const {
      project,
      project_id: projectId,
      element_id: elementId,
      type
    } = options
    const elementType = sanitizeTypeOfElement(type)

    let count = 0
    const endOfBranch = function() {
      if (--count === 0) {
        logger.warn(
          `element ${elementId} could not be found for project ${projectId ||
            project._id}`
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
        _.each(searchFolder.folders, (folder, index) => {
          if (folder == null) {
            return
          }
          const newPath = {}
          for (let key of Object.keys(path)) {
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
  },

  findRootDoc(opts, callback) {
    const getRootDoc = project => {
      if (project.rootDoc_id != null) {
        this.findElement(
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
  },

  findElementByPath(options, callback) {
    const { project, project_id: projectId, path, exactCaseMatch } = options
    if (path == null) {
      return new Error('no path provided for findElementByPath')
    }

    if (project != null) {
      ProjectLocator._findElementByPathWithProject(
        project,
        path,
        exactCaseMatch,
        callback
      )
    } else {
      ProjectGetter.getProject(
        projectId,
        { rootFolder: true, rootDoc_id: true },
        (err, project) => {
          if (err != null) {
            return callback(err)
          }
          ProjectLocator._findElementByPathWithProject(
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
      for (let folder of haystackFolder.folders) {
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
            `not found project: ${
              project._id
            } search path: ${needlePath}, folder ${
              foldersList[level]
            } could not be found`
          )
        )
      }
    }

    function getEntity(folder, entityName, cb) {
      let result, type
      if (entityName == null) {
        return cb(null, folder, 'folder')
      }
      for (let file of folder.fileRefs || []) {
        if (matchFn(file != null ? file.name : undefined, entityName)) {
          result = file
          type = 'file'
        }
      }
      for (let doc of folder.docs || []) {
        if (matchFn(doc != null ? doc.name : undefined, entityName)) {
          result = doc
          type = 'doc'
        }
      }
      for (let childFolder of folder.folders || []) {
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
        cb(null, result, type)
      } else {
        cb(
          new Error(
            `not found project: ${
              project._id
            } search path: ${needlePath}, entity ${entityName} could not be found`
          )
        )
      }
    }

    if (project == null) {
      return callback(new Error('Tried to find an element for a null project'))
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

    const jobs = []
    jobs.push(cb => getParentFolder(rootFolder, foldersList, 0, cb))
    jobs.push((folder, cb) => getEntity(folder, needleName, cb))
    async.waterfall(jobs, callback)
  },

  findUsersProjectByName(userId, projectName, callback) {
    ProjectGetter.findAllUsersProjects(
      userId,
      'name archived trashed',
      (err, allProjects) => {
        if (err != null) {
          return callback(err)
        }
        const { owned, readAndWrite } = allProjects
        const projects = owned.concat(readAndWrite)
        projectName = projectName.toLowerCase()
        const project = _.find(
          projects,
          project =>
            project.name.toLowerCase() === projectName &&
            !ProjectHelper.isArchivedOrTrashed(project, userId)
        )
        callback(null, project)
      }
    )
  }
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

module.exports = ProjectLocator
module.exports.promises = promisifyAll(ProjectLocator, {
  multiResult: {
    findElement: ['element', 'path', 'folder'],
    findElementByPath: ['element', 'type']
  }
})
