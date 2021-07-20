const logger = require('logger-sharelatex')
const OError = require('@overleaf/o-error')
const metrics = require('@overleaf/metrics')
const Settings = require('@overleaf/settings')
const { ObjectId } = require('mongodb')
const Features = require('../../infrastructure/Features')
const { Project } = require('../../models/Project')
const { Folder } = require('../../models/Folder')
const ProjectEntityUpdateHandler = require('./ProjectEntityUpdateHandler')
const ProjectDetailsHandler = require('./ProjectDetailsHandler')
const HistoryManager = require('../History/HistoryManager')
const { User } = require('../../models/User')
const fs = require('fs')
const path = require('path')
const { callbackify } = require('util')
const _ = require('underscore')
const AnalyticsManager = require('../Analytics/AnalyticsManager')
const SplitTestHandler = require('../SplitTests/SplitTestHandler')

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const EXAMPLE_PROJECT_SPLITTEST_ID = 'example-project-v2'

async function createBlankProject(ownerId, projectName, attributes = {}) {
  const isImport = attributes && attributes.overleaf
  const project = await _createBlankProject(ownerId, projectName, attributes)
  if (isImport) {
    AnalyticsManager.recordEvent(ownerId, 'project-imported', {
      projectId: project._id,
      attributes,
    })
  } else {
    AnalyticsManager.recordEvent(ownerId, 'project-created', {
      projectId: project._id,
      attributes,
    })
  }
  return project
}

async function createProjectFromSnippet(ownerId, projectName, docLines) {
  const project = await _createBlankProject(ownerId, projectName)
  AnalyticsManager.recordEvent(ownerId, 'project-created', {
    projectId: project._id,
  })
  await _createRootDoc(project, ownerId, docLines)
  return project
}

async function createBasicProject(ownerId, projectName) {
  const project = await _createBlankProject(ownerId, projectName)
  AnalyticsManager.recordEvent(ownerId, 'project-created', {
    projectId: project._id,
  })
  const docLines = await _buildTemplate('mainbasic.tex', ownerId, projectName)
  await _createRootDoc(project, ownerId, docLines)
  return project
}

async function createExampleProject(ownerId, projectName) {
  const project = await _createBlankProject(ownerId, projectName)

  const testSegmentation = await SplitTestHandler.promises.getTestSegmentation(
    ownerId,
    EXAMPLE_PROJECT_SPLITTEST_ID
  )

  if (testSegmentation.variant === 'example-frog') {
    await _addSplitTestExampleProjectFiles(ownerId, projectName, project)
  } else {
    await _addDefaultExampleProjectFiles(ownerId, projectName, project)
  }

  if (testSegmentation.enabled) {
    AnalyticsManager.recordEvent(ownerId, 'project-created', {
      projectId: project._id,
      splitTestId: EXAMPLE_PROJECT_SPLITTEST_ID,
      splitTestVariantId: testSegmentation.variant,
    })
  } else {
    AnalyticsManager.recordEvent(ownerId, 'project-created', {
      projectId: project._id,
    })
  }

  return project
}

async function _addDefaultExampleProjectFiles(ownerId, projectName, project) {
  const mainDocLines = await _buildTemplate('main.tex', ownerId, projectName)
  await _createRootDoc(project, ownerId, mainDocLines)

  const referenceDocLines = await _buildTemplate(
    'references.bib',
    ownerId,
    projectName
  )
  await ProjectEntityUpdateHandler.promises.addDoc(
    project._id,
    project.rootFolder[0]._id,
    'references.bib',
    referenceDocLines,
    ownerId
  )

  const universePath = path.resolve(
    __dirname + '/../../../templates/project_files/universe.jpg'
  )
  await ProjectEntityUpdateHandler.promises.addFile(
    project._id,
    project.rootFolder[0]._id,
    'universe.jpg',
    universePath,
    null,
    ownerId
  )
}

async function _addSplitTestExampleProjectFiles(ownerId, projectName, project) {
  const mainDocLines = await _buildTemplate(
    'test-example-project/main.tex',
    ownerId,
    projectName
  )
  await _createRootDoc(project, ownerId, mainDocLines)

  const bibDocLines = await _buildTemplate(
    'test-example-project/sample.bib',
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

  const frogPath = path.resolve(
    __dirname +
      '/../../../templates/project_files/test-example-project/frog.jpg'
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

async function _createBlankProject(ownerId, projectName, attributes = {}) {
  metrics.inc('project-creation')
  await ProjectDetailsHandler.promises.validateProjectName(projectName)

  if (!attributes.overleaf) {
    const history = await HistoryManager.promises.initializeProject()
    attributes.overleaf = {
      history: { id: history ? history.overleaf_id : undefined },
    }
  }

  const rootFolder = new Folder({ name: 'rootFolder' })

  attributes.lastUpdatedBy = attributes.owner_ref = new ObjectId(ownerId)
  attributes.name = projectName
  const project = new Project(attributes)

  Object.assign(project, attributes)

  // only display full project history when the project has the overleaf history id attribute
  // (to allow scripted creation of projects without full project history)
  const historyId = _.get(attributes, ['overleaf', 'history', 'id'])
  if (
    Features.hasFeature('history-v1') &&
    Settings.apis.project_history.displayHistoryForNewProjects &&
    historyId
  ) {
    project.overleaf.history.display = true
  }
  if (Settings.currentImageName) {
    // avoid clobbering any imageName already set in attributes (e.g. importedImageName)
    if (!project.imageName) {
      project.imageName = Settings.currentImageName
    }
  }
  project.rootFolder[0] = rootFolder
  const user = await User.findById(ownerId, 'ace.spellCheckLanguage')
  project.spellCheckLanguage = user.ace.spellCheckLanguage
  return await project.save()
}

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

async function _buildTemplate(templateName, userId, projectName) {
  const user = await User.findById(userId, 'first_name last_name')

  const templatePath = path.resolve(
    __dirname + `/../../../templates/project_files/${templateName}`
  )
  const template = fs.readFileSync(templatePath)
  const data = {
    project_name: projectName,
    user,
    year: new Date().getUTCFullYear(),
    month: MONTH_NAMES[new Date().getUTCMonth()],
  }
  const output = _.template(template.toString())(data)
  return output.split('\n')
}

module.exports = {
  createBlankProject: callbackify(createBlankProject),
  createProjectFromSnippet: callbackify(createProjectFromSnippet),
  createBasicProject: callbackify(createBasicProject),
  createExampleProject: callbackify(createExampleProject),
  promises: {
    createBlankProject,
    createProjectFromSnippet,
    createBasicProject,
    createExampleProject,
  },
}

metrics.timeAsyncMethod(
  module.exports,
  'createBlankProject',
  'mongo.ProjectCreationHandler',
  logger
)
