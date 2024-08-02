const OError = require('@overleaf/o-error')
const metrics = require('@overleaf/metrics')
const Settings = require('@overleaf/settings')
const { ObjectId } = require('mongodb-legacy')
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
const _ = require('lodash')
const AnalyticsManager = require('../Analytics/AnalyticsManager')
const TpdsUpdateSender = require('../ThirdPartyDataStore/TpdsUpdateSender')
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

const templateProjectDir = Features.hasFeature('saas')
  ? 'example-project'
  : 'example-project-sp'

async function createBlankProject(
  ownerId,
  projectName,
  attributes = {},
  options
) {
  const isImport = attributes && attributes.overleaf
  const project = await _createBlankProject(
    ownerId,
    projectName,
    attributes,
    options
  )
  const segmentation = _.pick(attributes, [
    'fromV1TemplateId',
    'fromV1TemplateVersionId',
  ])
  Object.assign(segmentation, attributes.segmentation)
  segmentation.projectId = project._id
  if (isImport) {
    AnalyticsManager.recordEventForUserInBackground(
      ownerId,
      'project-imported',
      segmentation
    )
  } else {
    AnalyticsManager.recordEventForUserInBackground(
      ownerId,
      'project-created',
      segmentation
    )
  }
  return project
}

async function createProjectFromSnippet(ownerId, projectName, docLines) {
  const project = await _createBlankProject(ownerId, projectName)
  AnalyticsManager.recordEventForUserInBackground(ownerId, 'project-created', {
    projectId: project._id,
  })
  await _createRootDoc(project, ownerId, docLines)
  return project
}

async function createBasicProject(ownerId, projectName) {
  const project = await _createBlankProject(ownerId, projectName)

  const docLines = await _buildTemplate('mainbasic.tex', ownerId, projectName)
  await _createRootDoc(project, ownerId, docLines)

  AnalyticsManager.recordEventForUserInBackground(ownerId, 'project-created', {
    projectId: project._id,
  })

  return project
}

async function createExampleProject(ownerId, projectName) {
  const project = await _createBlankProject(ownerId, projectName)

  await _addExampleProjectFiles(ownerId, projectName, project)

  AnalyticsManager.recordEventForUserInBackground(ownerId, 'project-created', {
    projectId: project._id,
  })

  return project
}

async function _addExampleProjectFiles(ownerId, projectName, project) {
  const mainDocLines = await _buildTemplate(
    `${templateProjectDir}/main.tex`,
    ownerId,
    projectName
  )
  await _createRootDoc(project, ownerId, mainDocLines)

  const bibDocLines = await _buildTemplate(
    `${templateProjectDir}/sample.bib`,
    ownerId,
    projectName
  )
  await ProjectEntityUpdateHandler.promises.addDoc(
    project._id,
    project.rootFolder[0]._id,
    'sample.bib',
    bibDocLines,
    ownerId,
    null
  )

  const frogPath = path.join(
    __dirname,
    `/../../../templates/project_files/${templateProjectDir}/frog.jpg`
  )
  await ProjectEntityUpdateHandler.promises.addFile(
    project._id,
    project.rootFolder[0]._id,
    'frog.jpg',
    frogPath,
    null,
    ownerId,
    null
  )
}

async function _createBlankProject(
  ownerId,
  projectName,
  attributes = {},
  { skipCreatingInTPDS = false } = {}
) {
  metrics.inc('project-creation')
  const timer = new metrics.Timer('project-creation')
  await ProjectDetailsHandler.promises.validateProjectName(projectName)

  const rootFolder = new Folder({ name: 'rootFolder' })

  attributes.lastUpdatedBy = attributes.owner_ref = new ObjectId(ownerId)
  attributes.name = projectName
  const project = new Project(attributes)

  // Initialise the history unless the caller has overridden it in the attributes
  // (to allow scripted creation of projects without full project history)
  if (project.overleaf.history.id == null && !attributes.overleaf) {
    const historyId = await HistoryManager.promises.initializeProject(
      project._id
    )
    if (historyId != null) {
      project.overleaf.history.id = historyId
    }
  }

  // All the projects are initialised with Full Project History. This property
  // is still set for backwards compatibility: Server Pro requires all projects
  // have it set to `true` since SP 4.0
  project.overleaf.history.display = true

  if (Settings.currentImageName) {
    // avoid clobbering any imageName already set in attributes (e.g. importedImageName)
    if (!project.imageName) {
      project.imageName = Settings.currentImageName
    }
  }
  project.rootFolder[0] = rootFolder
  const user = await User.findById(ownerId, {
    'ace.spellCheckLanguage': 1,
    _id: 1,
  })
  project.spellCheckLanguage = user.ace.spellCheckLanguage
  const historyRangesSupportAssignment =
    await SplitTestHandler.promises.getAssignmentForUser(
      user._id,
      'history-ranges-support'
    )
  if (historyRangesSupportAssignment.variant === 'enabled') {
    project.overleaf.history.rangesSupportEnabled = true
  }
  await project.save()
  if (!skipCreatingInTPDS) {
    await TpdsUpdateSender.promises.createProject({
      projectId: project._id,
      projectName,
      ownerId,
      userId: ownerId,
    })
  }
  timer.done()
  return project
}

async function _createRootDoc(project, ownerId, docLines) {
  try {
    const { doc } = await ProjectEntityUpdateHandler.promises.addDoc(
      project._id,
      project.rootFolder[0]._id,
      'main.tex',
      docLines,
      ownerId,
      null
    )
    await ProjectEntityUpdateHandler.promises.setRootDoc(project._id, doc._id)
  } catch (error) {
    throw OError.tag(error, 'error adding root doc when creating project')
  }
}

async function _buildTemplate(templateName, userId, projectName) {
  const user = await User.findById(userId, 'first_name last_name')

  const templatePath = path.join(
    __dirname,
    `/../../../templates/project_files/${templateName}`
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
