import OError from '@overleaf/o-error'
import ProjectGetter from '../Project/ProjectGetter.mjs'
import ProjectHistoryHandler from '../Project/ProjectHistoryHandler.mjs'
import ProjectRootDocManager from '../Project/ProjectRootDocManager.mjs'
import UserGetter from '../User/UserGetter.mjs'
import logger from '@overleaf/logger'
import settings from '@overleaf/settings'
import {
  fetchString,
  fetchJson,
  RequestFailedError,
} from '@overleaf/fetch-utils'
let ExportsHandler

export default ExportsHandler = {
  async exportProject(exportParams) {
    const exportData = await ExportsHandler._buildExport(exportParams)
    const body = await ExportsHandler._requestExport(exportData)

    exportData.v1_id = body.exportId
    exportData.token = body.token
    exportData.message = body.message
    // TODO: possibly store the export data in Mongo
    return exportData
  },

  async _buildExport(exportParams) {
    const {
      project_id: projectId,
      user_id: userId,
      brand_variation_id: brandVariationId,
      title,
      description,
      author,
      license,
      show_source: showSource,
    } = exportParams

    let project, rootResourcePath, user, historyVersion

    try {
      project = await ProjectGetter.promises.getProject(projectId, {
        overleaf: 1,
        compiler: 1,
        imageName: 1,
      })

      const result =
        await ProjectRootDocManager.promises.ensureRootDocumentIsValid(
          projectId
        )
      if (!result) {
        throw new OError('cannot export project without root doc', {
          project_id: projectId,
        })
      }
      rootResourcePath = result.rootResourcePath

      user = await UserGetter.promises.getUser(userId, {
        first_name: 1,
        last_name: 1,
        email: 1,
        overleaf: 1,
      })
      await ProjectHistoryHandler.promises.ensureHistoryExistsForProject(
        projectId
      )
      historyVersion = await ExportsHandler._requestVersion(projectId)
    } catch (err) {
      throw OError.tag(err, 'error building project export', {
        project_id: projectId,
        user_id: userId,
        brand_variation_id: brandVariationId,
      })
    }

    if (exportParams.first_name && exportParams.last_name) {
      user.first_name = exportParams.first_name
      user.last_name = exportParams.last_name
    }

    return {
      project: {
        id: projectId,
        rootDocPath: rootResourcePath,
        historyId: project.overleaf?.history?.id,
        historyVersion,
        v1ProjectId: project.overleaf != null ? project.overleaf.id : undefined,
        metadata: {
          compiler: project.compiler,
          imageName: project.imageName,
          title,
          description,
          author,
          license,
          showSource,
        },
      },
      user: {
        id: userId,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        orcidId: null, // until v2 gets ORCID
        v1UserId: user.overleaf != null ? user.overleaf.id : undefined,
      },
      destination: {
        brandVariationId,
      },
      options: {
        callbackUrl: null,
      }, // for now, until we want v1 to call us back
    }
  },

  async _requestExport(exportData) {
    try {
      return await fetchJson(
        new URL('/api/v1/overleaf/exports', settings.apis.v1.url),
        {
          basicAuth: {
            user: settings.apis.v1.user,
            password: settings.apis.v1.pass,
          },
          json: exportData,
          signal: AbortSignal.timeout(settings.apis.v1.timeout),
          method: 'POST',
        }
      )
    } catch (err) {
      if (err instanceof RequestFailedError) {
        logger.warn(
          { export: exportData },
          `v1 export returned failure; forwarding: ${err.body}`
        )
        // pass the v1 error along for the publish modal to handle
        throw OError.tag(err, 'v1 export returned failure', {
          forwardResponse: err.body,
        })
      }
      throw OError.tag(err, 'error making request to v1 export', {
        export: exportData,
      })
    }
  },

  async _requestVersion(projectId) {
    const url = new URL(settings.apis.project_history.url)
    url.pathname = `/project/${projectId}/version`
    try {
      const body = await fetchJson(url)
      return body.version
    } catch (err) {
      if (err instanceof RequestFailedError) {
        throw new OError(
          'project history version returned a failure status code',
          { project_id: projectId, statusCode: err.response.status }
        )
      }
      throw OError.tag(err, 'error making request to project history', {
        project_id: projectId,
      })
    }
  },

  async fetchExport(exportId, token) {
    const url = new URL(settings.apis.v1.url)
    url.pathname = `/api/v1/overleaf/exports/${exportId}`
    if (token) {
      url.searchParams.append('token', token)
    }

    try {
      return await fetchString(url, {
        basicAuth: {
          user: settings.apis.v1.user,
          password: settings.apis.v1.pass,
        },
        signal: AbortSignal.timeout(settings.apis.v1.timeout),
      })
    } catch (err) {
      if (err instanceof RequestFailedError) {
        throw new OError('v1 export returned a failure status code', {
          export: exportId,
          statusCode: err.response.status,
        })
      }
      throw OError.tag(err, 'error making request to v1 export', {
        export: exportId,
      })
    }
  },

  async fetchDownload(exportId, type, token) {
    const url = new URL(settings.apis.v1.url)
    url.pathname = `/api/v1/overleaf/exports/${exportId}/${type}_url`
    if (token) {
      url.searchParams.append('token', token)
    }

    try {
      return await fetchString(url, {
        basicAuth: {
          user: settings.apis.v1.user,
          password: settings.apis.v1.pass,
        },
        signal: AbortSignal.timeout(settings.apis.v1.timeout),
      })
    } catch (err) {
      if (err instanceof RequestFailedError) {
        throw new OError('v1 export returned a failure status code', {
          export: exportId,
          statusCode: err.response.status,
        })
      }
      throw OError.tag(err, 'error making request to v1 export', {
        export: exportId,
      })
    }
  },
}
