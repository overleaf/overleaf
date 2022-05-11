import { useEffect } from 'react'
import { withContextRoot } from './../../utils/with-context-root'
import FileTreeContext from '../../../js/features/file-tree/components/file-tree-context'
import FileTreeCreateNameProvider from '../../../js/features/file-tree/contexts/file-tree-create-name'
import FileTreeCreateFormProvider from '../../../js/features/file-tree/contexts/file-tree-create-form'
import { useFileTreeActionable } from '../../../js/features/file-tree/contexts/file-tree-actionable'
import PropTypes from 'prop-types'

export const DEFAULT_PROJECT = {
  _id: '123abc',
  name: 'Some Project',
  rootDocId: '5e74f1a7ce17ae0041dfd056',
  rootFolder: [
    {
      _id: 'root-folder-id',
      name: 'rootFolder',
      docs: [],
      folders: [],
      fileRefs: [],
    },
  ],
  features: { mendeley: true, zotero: true },
}

const defaultFileTreeContextProps = {
  refProviders: { mendeley: false, zotero: false },
  reindexReferences: () => {
    console.log('reindex references')
  },
  setRefProviderEnabled: provider => {
    console.log(`ref provider ${provider} enabled`)
  },
  setStartedFreeTrial: () => {
    console.log('started free trial')
  },
  initialSelectedEntityId: 'entity-1',
  onSelect: () => {
    console.log('selected')
  },
}

export const mockCreateFileModalFetch = fetchMock =>
  fetchMock
    .get('path:/user/projects', {
      projects: [
        {
          _id: 'project-1',
          name: 'Project One',
        },
        {
          _id: 'project-2',
          name: 'Project Two',
        },
      ],
    })
    .get('path:/mendeley/groups', {
      groups: [
        {
          id: 'group-1',
          name: 'Group One',
        },
        {
          id: 'group-2',
          name: 'Group Two',
        },
      ],
    })
    .get('path:/zotero/groups', {
      groups: [
        {
          id: 'group-1',
          name: 'Group One',
        },
        {
          id: 'group-2',
          name: 'Group Two',
        },
      ],
    })
    .get('express:/project/:projectId/entities', {
      entities: [
        {
          path: '/foo.tex',
        },
        {
          path: '/bar.tex',
        },
      ],
    })
    .post('express:/project/:projectId/compile', {
      status: 'success',
      outputFiles: [
        {
          build: 'foo',
          path: 'baz.jpg',
        },
        {
          build: 'foo',
          path: 'ball.jpg',
        },
      ],
    })
    .post('express:/project/:projectId/doc', (path, req) => {
      console.log({ path, req })
      return 204
    })
    .post('express:/project/:projectId/upload', (path, req) => {
      console.log({ path, req })
      return 204
    })
    .post('express:/project/:projectId/linked_file', (path, req) => {
      console.log({ path, req })
      return 204
    })

export const createFileModalDecorator =
  (
    fileTreeContextProps = {},
    projectProps = {},
    createMode = 'doc'
    // eslint-disable-next-line react/display-name
  ) =>
  Story => {
    return withContextRoot(
      <FileTreeContext
        {...defaultFileTreeContextProps}
        {...fileTreeContextProps}
      >
        <FileTreeCreateNameProvider>
          <FileTreeCreateFormProvider>
            <OpenCreateFileModal createMode={createMode}>
              <Story />
            </OpenCreateFileModal>
          </FileTreeCreateFormProvider>
        </FileTreeCreateNameProvider>
      </FileTreeContext>,
      {
        project: { ...DEFAULT_PROJECT, ...projectProps },
        permissionsLevel: 'owner',
      }
    )
  }

function OpenCreateFileModal({ children, createMode }) {
  const { startCreatingFile } = useFileTreeActionable()

  useEffect(() => {
    startCreatingFile(createMode)
  }, [createMode]) // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>
}
OpenCreateFileModal.propTypes = {
  createMode: PropTypes.string,
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]).isRequired,
}
