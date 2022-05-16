import MockedSocket from 'socket.io-mock'

import { rootFolderBase } from './fixtures/file-tree-base'
import { rootFolderLimit } from './fixtures/file-tree-limit'
import FileTreeRoot from '../js/features/file-tree/components/file-tree-root'
import FileTreeError from '../js/features/file-tree/components/file-tree-error'
import useFetchMock from './hooks/use-fetch-mock'
import { ScopeDecorator } from './decorators/scope'
import { useScope } from './hooks/use-scope'

const MOCK_DELAY = 2000

window._ide = {
  ...window._ide,
  socket: new MockedSocket(),
}
const DEFAULT_PROJECT = {
  _id: '123abc',
  name: 'Some Project',
  rootDocId: '5e74f1a7ce17ae0041dfd056',
  rootFolder: rootFolderBase,
}

function defaultSetupMocks(fetchMock) {
  fetchMock
    .post(
      /\/project\/\w+\/(file|doc|folder)\/\w+\/rename/,
      (path, req) => {
        const body = JSON.parse(req.body)
        const entityId = path.match(/([^/]+)\/rename$/)[1]
        window._ide.socket.socketClient.emit(
          'reciveEntityRename',
          entityId,
          body.name
        )
        return 204
      },

      {
        delay: MOCK_DELAY,
      }
    )
    .post(
      /\/project\/\w+\/folder/,
      (_path, req) => {
        const body = JSON.parse(req.body)
        const newFolder = {
          folders: [],
          fileRefs: [],
          docs: [],
          _id: Math.random().toString(16).replace(/0\./, 'random-test-id-'),
          name: body.name,
        }
        window._ide.socket.socketClient.emit(
          'reciveNewFolder',
          body.parent_folder_id,
          newFolder
        )
        return newFolder
      },
      {
        delay: MOCK_DELAY,
      }
    )
    .delete(
      /\/project\/\w+\/(file|doc|folder)\/\w+/,
      path => {
        const entityId = path.match(/[^/]+$/)[0]
        window._ide.socket.socketClient.emit('removeEntity', entityId)
        return 204
      },
      {
        delay: MOCK_DELAY,
      }
    )
    .post(/\/project\/\w+\/(file|doc|folder)\/\w+\/move/, (path, req) => {
      const body = JSON.parse(req.body)
      const entityId = path.match(/([^/]+)\/move/)[1]
      window._ide.socket.socketClient.emit(
        'reciveEntityMove',
        entityId,
        body.folder_id
      )
      return 204
    })
}

export const FullTree = args => {
  useFetchMock(defaultSetupMocks)

  useScope({
    project: DEFAULT_PROJECT,
    permissionsLevel: 'owner',
  })

  return <FileTreeRoot {...args} />
}

export const ReadOnly = args => {
  useScope({
    project: DEFAULT_PROJECT,
    permissionsLevel: 'readOnly',
  })

  return <FileTreeRoot {...args} />
}

export const Disconnected = args => {
  useScope({
    project: DEFAULT_PROJECT,
    permissionsLevel: 'owner',
  })

  return <FileTreeRoot {...args} />
}
Disconnected.args = { isConnected: false }

export const NetworkErrors = args => {
  useFetchMock(fetchMock => {
    fetchMock
      .post(/\/project\/\w+\/folder/, 500, {
        delay: MOCK_DELAY,
      })
      .post(/\/project\/\w+\/(file|doc|folder)\/\w+\/rename/, 500, {
        delay: MOCK_DELAY,
      })
      .post(/\/project\/\w+\/(file|doc|folder)\/\w+\/move/, 500, {
        delay: MOCK_DELAY,
      })
      .delete(/\/project\/\w+\/(file|doc|folder)\/\w+/, 500, {
        delay: MOCK_DELAY,
      })
  })

  useScope({
    project: DEFAULT_PROJECT,
    permissionsLevel: 'owner',
  })

  return <FileTreeRoot {...args} />
}

export const FallbackError = args => {
  useScope({
    project: DEFAULT_PROJECT,
  })

  return <FileTreeError {...args} />
}

export const FilesLimit = args => {
  useFetchMock(defaultSetupMocks)

  useScope({
    project: {
      ...DEFAULT_PROJECT,
      rootFolder: rootFolderLimit,
    },
    permissionsLevel: 'owner',
  })

  return <FileTreeRoot {...args} />
}

export default {
  title: 'Editor / File Tree',
  component: FileTreeRoot,
  args: {
    setStartedFreeTrial: () => {
      console.log('started free trial')
    },
    refProviders: {},
    reindexReferences: () => {
      console.log('reindex references')
    },
    setRefProviderEnabled: provider => {
      console.log(`ref provider ${provider} enabled`)
    },
    isConnected: true,
  },
  argTypes: {
    onInit: { action: 'onInit' },
    onSelect: { action: 'onSelect' },
  },
  decorators: [
    ScopeDecorator,
    Story => (
      <>
        <style>{'html, body, .file-tree { height: 100%; width: 100%; }'}</style>
        <div className="editor-sidebar full-size">
          <div className="file-tree">
            <Story />
          </div>
        </div>
      </>
    ),
  ],
}
