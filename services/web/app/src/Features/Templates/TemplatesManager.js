const { Project } = require('../../models/Project')
const ProjectDetailsHandler = require('../Project/ProjectDetailsHandler')
const ProjectOptionsHandler =
  require('../Project/ProjectOptionsHandler').promises
const ProjectRootDocManager =
  require('../Project/ProjectRootDocManager').promises
const ProjectUploadManager = require('../Uploads/ProjectUploadManager')
const fs = require('fs')
const util = require('util')
const logger = require('@overleaf/logger')
const {
  fetchJson,
  fetchStreamWithResponse,
  RequestFailedError,
} = require('@overleaf/fetch-utils')
const settings = require('@overleaf/settings')
const crypto = require('crypto')
const Errors = require('../Errors/Errors')
const { pipeline } = require('stream/promises')

const TemplatesManager = {
  async createProjectFromV1Template(
    brandVariationId,
    compiler,
    mainFile,
    templateId,
    templateName,
    templateVersionId,
    userId,
    imageName
  ) {
    const zipUrl = `${settings.apis.v1.url}/api/v1/overleaf/templates/${templateVersionId}`
    const zipReq = await fetchStreamWithResponse(zipUrl, {
      basicAuth: {
        user: settings.apis.v1.user,
        password: settings.apis.v1.pass,
      },
      signal: AbortSignal.timeout(settings.apis.v1.timeout),
    })

    const projectName = ProjectDetailsHandler.fixProjectName(templateName)
    const dumpPath = `${settings.path.dumpFolder}/${crypto.randomUUID()}`
    const writeStream = fs.createWriteStream(dumpPath)
    try {
      const attributes = {
        fromV1TemplateId: templateId,
        fromV1TemplateVersionId: templateVersionId,
      }
      await pipeline(zipReq.stream, writeStream)

      if (zipReq.response.status !== 200) {
        logger.warn(
          { uri: zipUrl, statusCode: zipReq.response.status },
          'non-success code getting zip from template API'
        )
        throw new Error(`get zip failed: ${zipReq.response.status}`)
      }
      const project =
        await ProjectUploadManager.promises.createProjectFromZipArchiveWithName(
          userId,
          projectName,
          dumpPath,
          attributes
        )

      await TemplatesManager._setCompiler(project._id, compiler)
      await TemplatesManager._setImage(project._id, imageName)
      await TemplatesManager._setMainFile(project._id, mainFile)
      await TemplatesManager._setBrandVariationId(project._id, brandVariationId)

      const update = {
        fromV1TemplateId: templateId,
        fromV1TemplateVersionId: templateVersionId,
      }
      await Project.updateOne({ _id: project._id }, update, {})

      return project
    } finally {
      await fs.promises.unlink(dumpPath)
    }
  },

  async _setCompiler(projectId, compiler) {
    if (compiler == null) {
      return
    }
    await ProjectOptionsHandler.setCompiler(projectId, compiler)
  },

  async _setImage(projectId, imageName) {
    if (!imageName) {
      imageName = 'wl_texlive:2018.1'
    }

    await ProjectOptionsHandler.setImageName(projectId, imageName)
  },

  async _setMainFile(projectId, mainFile) {
    if (mainFile == null) {
      return
    }
    await ProjectRootDocManager.setRootDocFromName(projectId, mainFile)
  },

  async _setBrandVariationId(projectId, brandVariationId) {
    if (brandVariationId == null) {
      return
    }
    await ProjectOptionsHandler.setBrandVariationId(projectId, brandVariationId)
  },

  async fetchFromV1(templateId) {
    const url = new URL(`/api/v2/templates/${templateId}`, settings.apis.v1.url)

    try {
      return await fetchJson(url, {
        basicAuth: {
          user: settings.apis.v1.user,
          password: settings.apis.v1.pass,
        },
        signal: AbortSignal.timeout(settings.apis.v1.timeout),
      })
    } catch (err) {
      if (err instanceof RequestFailedError && err.response.status === 404) {
        throw new Errors.NotFoundError()
      } else {
        throw err
      }
    }
  },
}

module.exports = {
  promises: TemplatesManager,
  createProjectFromV1Template: util.callbackify(
    TemplatesManager.createProjectFromV1Template
  ),
  fetchFromV1: util.callbackify(TemplatesManager.fetchFromV1),
}
