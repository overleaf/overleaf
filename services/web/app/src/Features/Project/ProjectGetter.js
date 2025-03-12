const { db } = require('../../infrastructure/mongodb')
const { normalizeQuery } = require('../Helpers/Mongo')
const OError = require('@overleaf/o-error')
const { Project } = require('../../models/Project')
const LockManager = require('../../infrastructure/LockManager')
const { DeletedProject } = require('../../models/DeletedProject')
const { callbackifyAll } = require('@overleaf/promise-utils')

const ProjectGetter = {
  EXCLUDE_DEPTH: 8,

  async getProjectWithoutDocLines(projectId) {
    const excludes = {}
    for (let i = 1; i <= ProjectGetter.EXCLUDE_DEPTH; i++) {
      excludes[`rootFolder${Array(i).join('.folders')}.docs.lines`] = 0
    }
    return await ProjectGetter.getProject(projectId, excludes)
  },

  async getProjectWithOnlyFolders(projectId) {
    const excludes = {}
    for (let i = 1; i <= ProjectGetter.EXCLUDE_DEPTH; i++) {
      excludes[`rootFolder${Array(i).join('.folders')}.docs`] = 0
      excludes[`rootFolder${Array(i).join('.folders')}.fileRefs`] = 0
    }
    return await ProjectGetter.getProject(projectId, excludes)
  },

  async getProject(projectId, projection = {}) {
    if (projectId == null) {
      throw new Error('no project id provided')
    }
    if (typeof projection !== 'object') {
      throw new Error('projection is not an object')
    }

    if (projection.rootFolder || Object.keys(projection).length === 0) {
      const ProjectEntityMongoUpdateHandler = require('./ProjectEntityMongoUpdateHandler')
      return await LockManager.promises.runWithLock(
        ProjectEntityMongoUpdateHandler.LOCK_NAMESPACE,
        projectId,
        () => ProjectGetter.getProjectWithoutLock(projectId, projection)
      )
    } else {
      return await ProjectGetter.getProjectWithoutLock(projectId, projection)
    }
  },

  async getProjectWithoutLock(projectId, projection = {}) {
    if (projectId == null) {
      throw new Error('no project id provided')
    }
    if (typeof projection !== 'object') {
      throw new Error('projection is not an object')
    }

    const query = normalizeQuery(projectId)

    let project
    try {
      project = await db.projects.findOne(query, { projection })
    } catch (error) {
      OError.tag(error, 'error getting project', {
        query,
        projection,
      })
      throw error
    }

    return project
  },

  async getProjectIdByReadAndWriteToken(token) {
    const project = await Project.findOne(
      { 'tokens.readAndWrite': token },
      { _id: 1 }
    ).exec()

    if (project == null) {
      return
    }

    return project._id
  },

  async findAllUsersProjects(userId, fields) {
    const CollaboratorsGetter = require('../Collaborators/CollaboratorsGetter')
    const ownedProjects = await Project.find(
      { owner_ref: userId },
      fields
    ).exec()

    const projects =
      await CollaboratorsGetter.promises.getProjectsUserIsMemberOf(
        userId,
        fields
      )

    const result = {
      owned: ownedProjects || [],
      readAndWrite: projects.readAndWrite || [],
      readOnly: projects.readOnly || [],
      tokenReadAndWrite: projects.tokenReadAndWrite || [],
      tokenReadOnly: projects.tokenReadOnly || [],
      review: projects.review || [],
    }

    // Remove duplicate projects. The order of result values is determined by the order they occur.
    const tempAddedProjectsIds = new Set()
    const filteredProjects = Object.entries(result).reduce((prev, current) => {
      const [key, projects] = current

      prev[key] = []

      projects.forEach(project => {
        const projectId = project._id.toString()

        if (!tempAddedProjectsIds.has(projectId)) {
          prev[key].push(project)
          tempAddedProjectsIds.add(projectId)
        }
      })

      return prev
    }, {})

    return filteredProjects
  },

  /**
   * Return all projects with the given name that belong to the given user.
   *
   * Projects include the user's own projects as well as collaborations with
   * read/write access.
   */
  async findUsersProjectsByName(userId, projectName) {
    const allProjects = await ProjectGetter.findAllUsersProjects(
      userId,
      'name archived trashed'
    )

    const { owned, readAndWrite } = allProjects
    const projects = owned.concat(readAndWrite)
    const lowerCasedProjectName = projectName.toLowerCase()
    return projects.filter(
      project => project.name.toLowerCase() === lowerCasedProjectName
    )
  },

  async getUsersDeletedProjects(userId) {
    return await DeletedProject.find({
      'deleterData.deletedProjectOwnerId': userId,
    }).exec()
  },
}

module.exports = {
  ...callbackifyAll(ProjectGetter),
  promises: ProjectGetter,
}
