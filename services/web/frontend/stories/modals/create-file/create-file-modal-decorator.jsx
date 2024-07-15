import { useEffect } from 'react'
import FileTreeContext from '../../../js/features/file-tree/components/file-tree-context'
import FileTreeCreateNameProvider from '../../../js/features/file-tree/contexts/file-tree-create-name'
import FileTreeCreateFormProvider from '../../../js/features/file-tree/contexts/file-tree-create-form'
import { useFileTreeActionable } from '../../../js/features/file-tree/contexts/file-tree-actionable'
import PropTypes from 'prop-types'

const defaultFileTreeContextProps = {
  refProviders: { mendeley: false, zotero: false },
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
  (fileTreeContextProps = {}, createMode = 'doc') =>
  // eslint-disable-next-line react/display-name
  Story => {
    return (
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
      </FileTreeContext>
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
