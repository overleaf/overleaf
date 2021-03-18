import React, { useEffect } from 'react'
import fetchMock from 'fetch-mock'
import FileTreeContext from '../../../js/features/file-tree/components/file-tree-context'
import FileTreeCreateNameProvider from '../../../js/features/file-tree/contexts/file-tree-create-name'
import FileTreeCreateFormProvider from '../../../js/features/file-tree/contexts/file-tree-create-form'
import { useFileTreeActionable } from '../../../js/features/file-tree/contexts/file-tree-actionable'
import PropTypes from 'prop-types'

const defaultContextProps = {
  projectId: 'project-1',
  hasWritePermissions: true,
  hasFeature: () => true,
  refProviders: {},
  reindexReferences: () => {
    console.log('reindex references')
  },
  setRefProviderEnabled: provider => {
    console.log(`ref provider ${provider} enabled`)
  },
  setStartedFreeTrial: () => {
    console.log('started free trial')
  },
  rootFolder: [
    {
      docs: [
        {
          _id: 'entity-1'
        }
      ],
      fileRefs: [],
      folders: []
    }
  ],
  initialSelectedEntityId: 'entity-1',
  onSelect: () => {
    console.log('selected')
  }
}

export const createFileModalDecorator = (
  contextProps = {},
  createMode = 'doc'
) => Story => {
  fetchMock
    .restore()
    .get('path:/user/projects', {
      projects: [
        {
          _id: 'project-1',
          name: 'Project One'
        },
        {
          _id: 'project-2',
          name: 'Project Two'
        }
      ]
    })
    .get('path:/mendeley/groups', {
      groups: [
        {
          id: 'group-1',
          name: 'Group One'
        },
        {
          id: 'group-2',
          name: 'Group Two'
        }
      ]
    })
    .get('express:/project/:projectId/entities', {
      entities: [
        {
          path: '/foo.tex'
        },
        {
          path: '/bar.tex'
        }
      ]
    })
    .post('express:/project/:projectId/compile', {
      status: 'success',
      outputFiles: [
        {
          build: 'foo',
          path: 'baz.jpg'
        },
        {
          build: 'foo',
          path: 'ball.jpg'
        }
      ]
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

  return (
    <FileTreeContext {...defaultContextProps} {...contextProps}>
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
  finishCreating: PropTypes.bool,
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node
  ]).isRequired
}
