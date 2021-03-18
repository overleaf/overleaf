import React from 'react'
import FileTreeCreateNewDoc from './modes/file-tree-create-new-doc'
import FileTreeImportFromUrl from './modes/file-tree-import-from-url'
import FileTreeImportFromProject from './modes/file-tree-import-from-project'
import FileTreeUploadDoc from './modes/file-tree-upload-doc'
import FileTreeModalCreateFileMode from './file-tree-modal-create-file-mode'
import FileTreeCreateNameProvider from '../../contexts/file-tree-create-name'
import { useFileTreeActionable } from '../../contexts/file-tree-actionable'
import { useFileTreeMutable } from '../../contexts/file-tree-mutable'

import importOverleafModules from '../../../../../macros/import-overleaf-module.macro'

const createFileModeModules = importOverleafModules('createFileModes')

export default function FileTreeModalCreateFileBody() {
  const { newFileCreateMode } = useFileTreeActionable()
  const { fileCount } = useFileTreeMutable()

  if (!fileCount || fileCount.status === 'error') {
    return null
  }

  return (
    <table>
      <tbody>
        <tr>
          <td className="modal-new-file--list">
            <ul className="list-unstyled">
              <FileTreeModalCreateFileMode
                mode="doc"
                icon="file"
                label="New File"
              />

              <FileTreeModalCreateFileMode
                mode="upload"
                icon="upload"
                label="Upload"
              />

              <FileTreeModalCreateFileMode
                mode="project"
                icon="folder-open"
                label="From Another Project"
              />

              {window.ExposedSettings.hasLinkUrlFeature && (
                <FileTreeModalCreateFileMode
                  mode="url"
                  icon="globe"
                  label="From External URL"
                />
              )}

              {createFileModeModules.map(
                ({ import: { CreateFileMode }, path }) => (
                  <CreateFileMode key={path} />
                )
              )}
            </ul>
          </td>

          <td
            className={`modal-new-file--body modal-new-file--body-${newFileCreateMode}`}
          >
            {newFileCreateMode === 'doc' && (
              <FileTreeCreateNameProvider initialName="name.tex">
                <FileTreeCreateNewDoc />
              </FileTreeCreateNameProvider>
            )}

            {newFileCreateMode === 'url' && (
              <FileTreeCreateNameProvider>
                <FileTreeImportFromUrl />
              </FileTreeCreateNameProvider>
            )}

            {newFileCreateMode === 'project' && (
              <FileTreeCreateNameProvider>
                <FileTreeImportFromProject />
              </FileTreeCreateNameProvider>
            )}

            {newFileCreateMode === 'upload' && <FileTreeUploadDoc />}

            {createFileModeModules.map(
              ({ import: { CreateFilePane }, path }) => (
                <CreateFilePane key={path} />
              )
            )}
          </td>
        </tr>
      </tbody>
    </table>
  )
}
