import ProjectDetailsHandler from '../Project/ProjectDetailsHandler.mjs'
import ProjectOptionsHandlerModule from '../Project/ProjectOptionsHandler.mjs'
import ProjectRootDocManagerModule from '../Project/ProjectRootDocManager.mjs'
import ProjectUploadManager from '../Uploads/ProjectUploadManager.mjs'
import fs from 'node:fs'
import util from 'node:util'
import logger from '@overleaf/logger'
import {
  fetchJson,
  fetchStreamWithResponse,
  RequestFailedError,
} from '@overleaf/fetch-utils'
import settings from '@overleaf/settings'
import crypto from 'node:crypto'
import Errors from '../Errors/Errors.js'
import { pipeline } from 'node:stream/promises'
import ClsiCacheManager from '../Compile/ClsiCacheManager.mjs'

const { promises: ProjectRootDocManager } = ProjectRootDocManagerModule
const { promises: ProjectOptionsHandler } = ProjectOptionsHandlerModule

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
    compiler = ProjectOptionsHandler.normalizeCompiler(compiler || 'pdflatex')
    imageName = ProjectOptionsHandler.normalizeImageName(
      imageName || 'wl_texlive:2018.1'
    )

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
        compiler,
        imageName,
      }
      if (brandVariationId) attributes.brandVariationId = brandVariationId

      await pipeline(zipReq.stream, writeStream)

      if (zipReq.response.status !== 200) {
        logger.warn(
          { uri: zipUrl, statusCode: zipReq.response.status },
          'non-success code getting zip from template API'
        )
        throw new Error(`get zip failed: ${zipReq.response.status}`)
      }
      const { fileEntries, docEntries, project } =
        await ProjectUploadManager.promises.createProjectFromZipArchiveWithName(
          userId,
          projectName,
          dumpPath,
          attributes
        )

      const prepareClsiCacheInBackground = ClsiCacheManager.prepareClsiCache(
        project._id,
        userId,
        { templateVersionId, imageName }
      ).catch(err => {
        logger.warn(
          { err, templateVersionId, projectId: project._id },
          'failed to prepare clsi-cache from template'
        )
        return undefined
      })

      await TemplatesManager._setMainFile(project, mainFile)

      const found = await prepareClsiCacheInBackground
      if (found === false && project.rootDoc_id) {
        ClsiCacheManager.createTemplateClsiCache({
          templateVersionId,
          project,
          fileEntries,
          docEntries,
        }).catch(err => {
          logger.error(
            { err, templateVersionId },
            'failed to create template clsi-cache'
          )
        })
      }

      return project
    } finally {
      await fs.promises.unlink(dumpPath)
    }
  },

  async _setMainFile(project, mainFile) {
    if (mainFile == null) {
      return
    }
    const rootDocId = await ProjectRootDocManager.setRootDocFromName(
      project._id,
      mainFile
    )
    if (rootDocId) project.rootDoc_id = rootDocId
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

export default {
  promises: TemplatesManager,
  createProjectFromV1Template: util.callbackify(
    TemplatesManager.createProjectFromV1Template
  ),
  fetchFromV1: util.callbackify(TemplatesManager.fetchFromV1),
}
