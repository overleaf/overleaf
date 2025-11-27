import FileWriter from '../../infrastructure/FileWriter.mjs'
import EditorController from '../Editor/EditorController.mjs'
import ProjectLocator from '../Project/ProjectLocator.mjs'
import { Project } from '../../models/Project.mjs'
import ProjectGetter from '../Project/ProjectGetter.mjs'
import LinkedFilesErrors from './LinkedFilesErrors.mjs'
import { callbackifyAll } from '@overleaf/promise-utils'

const { ProjectNotFoundError, V1ProjectNotFoundError, BadDataError } =
  LinkedFilesErrors

const LinkedFilesHandler = {
  async getFileById(projectId, fileId) {
    const { element, path, folder } = await ProjectLocator.promises.findElement(
      {
        project_id: projectId,
        element_id: fileId,
        type: 'file',
      }
    )
    return { file: element, path, parentFolder: folder }
  },

  async getSourceProject(data) {
    const projection = { _id: 1, name: 1, overleaf: 1 } // include the historyId for future use
    if (data.v1_source_doc_id != null) {
      const project = await Project.findOne(
        { 'overleaf.id': data.v1_source_doc_id },
        projection
      ).exec()

      if (project == null) {
        throw new V1ProjectNotFoundError()
      }

      return project
    } else if (data.source_project_id != null) {
      const project = await ProjectGetter.promises.getProject(
        data.source_project_id,
        projection
      )

      if (project == null) {
        throw new ProjectNotFoundError()
      }

      return project
    } else {
      throw new BadDataError('neither v1 nor v2 id present')
    }
  },

  async importFromStream(
    projectId,
    readStream,
    linkedFileData,
    name,
    parentFolderId,
    userId
  ) {
    const fsPath = await FileWriter.promises.writeStreamToDisk(
      projectId,
      readStream
    )

    return await EditorController.promises.upsertFile(
      projectId,
      parentFolderId,
      name,
      fsPath,
      linkedFileData,
      'upload',
      userId
    )
  },

  async importContent(
    projectId,
    content,
    linkedFileData,
    name,
    parentFolderId,
    userId
  ) {
    const fsPath = await FileWriter.promises.writeContentToDisk(
      projectId,
      content
    )

    return await EditorController.promises.upsertFile(
      projectId,
      parentFolderId,
      name,
      fsPath,
      linkedFileData,
      'upload',
      userId
    )
  },
}

export default {
  promises: LinkedFilesHandler,
  ...callbackifyAll(LinkedFilesHandler, {
    multiResult: { getFileById: ['file', 'path', 'parentFolder'] },
  }),
}
