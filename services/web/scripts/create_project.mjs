// Script to create projects with sharelatex history for testing
// Example:
// node scripts/create_project.mjs --user-id=5dca84e11e71ae002ff73bd4 --name="My Test Project" --old-history

import fs from 'node:fs'

import path from 'node:path'
import _ from 'lodash'
import parseArgs from 'minimist'
import OError from '@overleaf/o-error'
import { User } from '../app/src/models/User.js'
import ProjectCreationHandler from '../app/src/Features/Project/ProjectCreationHandler.js'
import ProjectEntityUpdateHandler from '../app/src/Features/Project/ProjectEntityUpdateHandler.js'
import ProjectEntityHandler from '../app/src/Features/Project/ProjectEntityHandler.js'
import EditorController from '../app/src/Features/Editor/EditorController.js'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const argv = parseArgs(process.argv.slice(2), {
  string: ['user-id', 'name', 'random-operations', 'extend-project-id'],
  boolean: ['random-content'],
  unknown: function (arg) {
    console.error('unrecognised argument', arg)
    process.exit(1)
  },
})

console.log('argv', argv)

const userId = argv['user-id']
const projectName = argv.name || `Test Project ${new Date().toISOString()}`
let randomOperations = 0
if (argv['random-content'] === true || argv['random-operations']) {
  randomOperations = parseInt(argv['random-operations'] || '1000', 10)
}
const extendProjectId = argv['extend-project-id']

console.log('userId', userId)

async function _createRootDoc(project, ownerId, docLines) {
  try {
    const { doc } = await ProjectEntityUpdateHandler.promises.addDoc(
      project._id,
      project.rootFolder[0]._id,
      'main.tex',
      docLines,
      ownerId,
      'create-project-script'
    )
    await ProjectEntityUpdateHandler.promises.setRootDoc(project._id, doc._id)
  } catch (error) {
    throw OError.tag(error, 'error adding root doc when creating project')
  }
}

async function _addDefaultExampleProjectFiles(ownerId, projectName, project) {
  const mainDocLines = await _buildTemplate(
    'example-project/main.tex',
    ownerId,
    projectName
  )
  await _createRootDoc(project, ownerId, mainDocLines)

  const bibDocLines = await _buildTemplate(
    'example-project/sample.bib',
    ownerId,
    projectName
  )
  await ProjectEntityUpdateHandler.promises.addDoc(
    project._id,
    project.rootFolder[0]._id,
    'sample.bib',
    bibDocLines,
    ownerId,
    'create-project-script'
  )

  const frogPath = path.join(
    __dirname,
    '/../app/templates/project_files/example-project/frog.jpg'
  )
  await ProjectEntityUpdateHandler.promises.addFile(
    project._id,
    project.rootFolder[0]._id,
    'frog.jpg',
    frogPath,
    null,
    ownerId,
    'create-project-script'
  )
}

async function _buildTemplate(templateName, userId, projectName) {
  const user = await User.findById(userId, 'first_name last_name')

  const templatePath = path.join(
    __dirname,
    `/../app/templates/project_files/${templateName}`
  )
  const template = fs.readFileSync(templatePath)
  const data = {
    project_name: projectName,
    user,
    year: new Date().getUTCFullYear(),
    month: new Date().getUTCMonth(),
  }
  const output = _.template(template.toString())(data)
  return output.split('\n')
}

// Create a project with some random content and file operations for testing history migrations
// Unfortunately we cannot easily change the timestamps of the history entries, so everything
// will be created at the same time.

async function _pickRandomDoc(projectId) {
  const result = await ProjectEntityHandler.promises.getAllDocs(projectId)
  const keys = Object.keys(result)
  if (keys.length === 0) {
    return null
  }
  const filepath = _.sample(keys)
  result[filepath].path = filepath
  return result[filepath]
}

let COUNTER = 0
// format counter as a 6 digit zero padded number
function nextId() {
  return ('000000' + COUNTER++).slice(-6)
}

async function _applyRandomDocUpdate(ownerId, projectId) {
  const action = _.sample(['create', 'edit', 'delete', 'rename'])
  switch (action) {
    case 'create': // create a new doc
      await EditorController.promises.upsertDocWithPath(
        projectId,
        `subdir/new-doc-${nextId()}.tex`,
        [`This is a new doc ${new Date().toISOString()}`],
        'create-project-script',
        ownerId
      )
      break
    case 'edit': {
      // edit an existing doc
      const doc = await _pickRandomDoc(projectId)
      if (!doc) {
        return
      }
      // pick a random line and either insert or delete a character
      const lines = doc.lines
      const index = _.random(0, lines.length - 1)
      let thisLine = lines[index]
      const pos = _.random(0, thisLine.length - 1)
      if (Math.random() > 0.5) {
        // insert a character
        thisLine = thisLine.slice(0, pos) + 'x' + thisLine.slice(pos)
      } else {
        // delete a character
        thisLine = thisLine.slice(0, pos) + thisLine.slice(pos + 1)
      }
      lines[index] = thisLine
      await EditorController.promises.upsertDocWithPath(
        projectId,
        doc.path,
        lines,
        'create-project-script',
        ownerId
      )
      break
    }
    case 'delete': {
      // delete an existing doc (but not the root doc)
      const doc = await _pickRandomDoc(projectId)
      if (!doc || doc.path === '/main.tex') {
        return
      }

      await EditorController.promises.deleteEntityWithPath(
        projectId,
        doc.path,
        'create-project-script',
        ownerId
      )
      break
    }
    case 'rename': {
      // rename an existing doc (but not the root doc)
      const doc = await _pickRandomDoc(projectId)
      if (!doc || doc.path === '/main.tex') {
        return
      }
      const newName = `renamed-${nextId()}.tex`
      await EditorController.promises.renameEntity(
        projectId,
        doc._id,
        'doc',
        newName,
        ownerId,
        'create-project-script'
      )
      break
    }
  }
}

async function createProject() {
  const user = await User.findById(userId)
  console.log('Will create project')
  console.log('user_id:', userId, '=>', user.email)
  let projectId
  if (extendProjectId) {
    console.log('extending existing project', extendProjectId)
    projectId = extendProjectId
  } else {
    console.log('project name:', projectName)
    const project = await ProjectCreationHandler.promises.createBlankProject(
      userId,
      projectName
    )
    await _addDefaultExampleProjectFiles(userId, projectName, project)
    projectId = project._id
  }
  for (let i = 0; i < randomOperations; i++) {
    await _applyRandomDocUpdate(userId, projectId)
  }
  return projectId
}

try {
  const projectId = await createProject()
  console.log('Created project', projectId)
  process.exit()
} catch (error) {
  console.error(error)
  process.exit(1)
}
