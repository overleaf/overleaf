// Script to create projects with sharelatex history for testing
// Example:
// node scripts/create_project.js --user-id=5dca84e11e71ae002ff73bd4 --name="My Test Project" --old-history

const fs = require('fs')
const path = require('path')
const _ = require('underscore')
const parseArgs = require('minimist')
const OError = require('@overleaf/o-error')
const { waitForDb } = require('../app/src/infrastructure/mongodb')
const { User } = require('../app/src/models/User')
const ProjectCreationHandler = require('../app/src/Features/Project/ProjectCreationHandler')
const ProjectEntityUpdateHandler = require('../app/src/Features/Project/ProjectEntityUpdateHandler')

const argv = parseArgs(process.argv.slice(2), {
  string: ['user-id', 'name'],
  boolean: ['old-history'],
  unknown: function (arg) {
    console.error('unrecognised argument', arg)
    process.exit(1)
  },
})

console.log('argv', argv)

const userId = argv['user-id']
const projectName = argv.name || `Test Project ${new Date().toISOString()}`
const oldHistory = argv['old-history']

console.log('userId', userId)

async function _createRootDoc(project, ownerId, docLines) {
  try {
    const { doc } = await ProjectEntityUpdateHandler.promises.addDoc(
      project._id,
      project.rootFolder[0]._id,
      'main.tex',
      docLines,
      ownerId
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
    ownerId
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
    ownerId
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

async function createProject() {
  await waitForDb()
  const user = await User.findById(userId)
  console.log('Will create project')
  console.log('user_id:', userId, '=>', user.email)
  console.log('project name:', projectName)
  const attributes = oldHistory ? { overleaf: {} } : {}
  const project = await ProjectCreationHandler.promises.createBlankProject(
    userId,
    projectName,
    attributes
  )
  await _addDefaultExampleProjectFiles(userId, projectName, project)
  return project
}

createProject()
  .then(project => {
    console.log('Created project', project._id)
    process.exit()
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
