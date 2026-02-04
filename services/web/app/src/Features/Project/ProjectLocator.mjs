import _ from 'lodash'
import logger from '@overleaf/logger'
import OError from '@overleaf/o-error'
import ProjectGetter from './ProjectGetter.mjs'
import Errors from '../Errors/Errors.js'
import { callbackifyMultiResult } from '@overleaf/promise-utils'
import { iterablePaths } from './IterablePath.mjs'

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

async function findElement(options) {
  const { project_id: projectId, element_id: elementId, type } = options
  const elementType = sanitizeTypeOfElement(type)

  function search(searchFolder, path) {
    const element = _.find(
      searchFolder[elementType],
      el => (el != null ? el._id : undefined) + '' === elementId + ''
    ) // need to ToString both id's for robustness
    if (element) {
      const elementPlaceInArray = getIndexOf(
        searchFolder[elementType],
        elementId
      )
      path.fileSystem += `/${element.name}`
      path.mongo += `.${elementType}.${elementPlaceInArray}`
      return { element, path, folder: searchFolder }
    }
    if (searchFolder.folders != null && searchFolder.folders.length !== 0) {
      for (const [index, folder] of searchFolder.folders.entries()) {
        if (folder == null) {
          continue
        }
        const newPath = {}
        for (const key of Object.keys(path)) {
          const value = path[key]
          newPath[key] = value
        } // make a value copy of the string
        newPath.fileSystem += `/${folder.name}`
        newPath.mongo += `.folders.${index}`
        const result = search(folder, newPath)
        if (result) {
          return result
        }
      }
    }
  }

  const path = { fileSystem: '', mongo: 'rootFolder.0' }

  const startSearch = project => {
    if (
      elementId + '' === project.rootFolder[0]._id + '' &&
      elementType === 'folders'
    ) {
      return { element: project.rootFolder[0], path, folder: null }
    }
    const result = search(project.rootFolder[0], path)
    if (!result) {
      logger.warn(
        `element ${elementId} could not be found for project ${
          projectId || project._id
        }`
      )
      throw new Errors.NotFoundError('entity not found')
    }
    return result
  }

  const project =
    options.project ||
    (await ProjectGetter.promises.getProject(projectId, {
      rootFolder: true,
      rootDoc_id: true,
    }))

  if (project == null) {
    throw new Errors.NotFoundError('project not found')
  }
  return startSearch(project)
}

async function findRootDoc(opts) {
  const getRootDoc = async project => {
    if (project.rootDoc_id == null) {
      return { element: null, path: null, folder: null }
    }
    try {
      return await findElement({
        project,
        element_id: project.rootDoc_id,
        type: 'docs',
      })
    } catch (err) {
      if (err instanceof Errors.NotFoundError) {
        return { element: null, path: null, folder: null }
      }
      throw err
    }
  }
  const { project_id: projectId } = opts
  const project =
    opts.project ||
    (await ProjectGetter.promises.getProject(projectId, {
      rootFolder: true,
      rootDoc_id: true,
    }))
  return await getRootDoc(project)
}

async function findElementByPath(options) {
  const { project_id: projectId, path, exactCaseMatch } = options
  if (path == null) {
    throw new Error('no path provided for findElementByPath')
  }
  const project =
    options.project ||
    (await ProjectGetter.promises.getProject(projectId, {
      rootFolder: true,
      rootDoc_id: true,
    }))
  return await _findElementByPathWithProject(project, path, exactCaseMatch)
}

async function _findElementByPathWithProject(
  project,
  needlePath,
  exactCaseMatch
) {
  let matchFn
  if (exactCaseMatch) {
    matchFn = (a, b) => a === b
  } else {
    matchFn = (a, b) =>
      (a != null ? a.toLowerCase() : undefined) ===
      (b != null ? b.toLowerCase() : undefined)
  }

  function getParentFolder(haystackFolder, foldersList, level) {
    if (foldersList.length === 0) {
      return haystackFolder
    }
    const needleFolderName = foldersList[level]
    let found = false
    for (const folder of haystackFolder.folders) {
      if (matchFn(folder.name, needleFolderName)) {
        found = true
        if (level === foldersList.length - 1) {
          return folder
        }
        return getParentFolder(folder, foldersList, level + 1)
      }
    }
    if (!found) {
      throw new Error(
        `not found project: ${project._id} search path: ${needlePath}, folder ${foldersList[level]} could not be found`
      )
    }
  }

  function getEntity(folder, entityName) {
    let result, type
    if (entityName == null) {
      return { element: folder, type: 'folder', folder: null }
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
      return { element: result, type, folder }
    }
    throw new Error(
      `not found project: ${project._id} search path: ${needlePath}, entity ${entityName} could not be found`
    )
  }

  if (project == null) {
    throw new Error('Tried to find an element for a null project')
  }
  if (needlePath === '' || needlePath === '/') {
    return { element: project.rootFolder[0], type: 'folder', folder: null }
  }

  if (needlePath.indexOf('/') === 0) {
    needlePath = needlePath.substring(1)
  }
  const foldersList = needlePath.split('/')
  const needleName = foldersList.pop()
  const rootFolder = project.rootFolder[0]
  const parentFolder = getParentFolder(rootFolder, foldersList, 0)
  return getEntity(parentFolder, needleName)
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

export default {
  findElement: callbackifyMultiResult(findElement, [
    'element',
    'path',
    'folder',
  ]),
  findElementByPath: callbackifyMultiResult(findElementByPath, [
    'element',
    'type',
    'folder',
  ]),
  findRootDoc: callbackifyMultiResult(findRootDoc, [
    'element',
    'path',
    'folder',
  ]),
  findElementByMongoPath,
  findDeep,
  promises: {
    findElement,
    findElementByPath,
    findRootDoc,
  },
}
