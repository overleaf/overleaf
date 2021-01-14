import React from 'react'
import fetchMock from 'fetch-mock'
import MockedSocket from 'socket.io-mock'

import { rootFolderBase } from './fixtures/file-tree-base'
import { rootFolderLimit } from './fixtures/file-tree-limit'
import FileTreeRoot from '../js/features/file-tree/components/file-tree-root'
import FileTreeError from '../js/features/file-tree/components/file-tree-error'

const MOCK_DELAY = 2000

window._ide = {
  socket: new MockedSocket()
}

function defaultSetupMocks() {
  fetchMock
    .restore()
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
        delay: MOCK_DELAY
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
          _id: Math.random()
            .toString(16)
            .replace(/0\./, 'random-test-id-'),
          name: body.name
        }
        window._ide.socket.socketClient.emit(
          'reciveNewFolder',
          body.parent_folder_id,
          newFolder
        )
        return newFolder
      },
      {
        delay: MOCK_DELAY
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
        delay: MOCK_DELAY
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

export const FullTree = args => <FileTreeRoot {...args} />
FullTree.parameters = { setupMocks: defaultSetupMocks }

export const ReadOnly = args => <FileTreeRoot {...args} />
ReadOnly.args = { hasWritePermissions: false }

export const Disconnected = args => <FileTreeRoot {...args} />
Disconnected.args = { isConnected: false }

export const NetworkErrors = args => <FileTreeRoot {...args} />
NetworkErrors.parameters = {
  setupMocks: () => {
    fetchMock
      .restore()
      .post(/\/project\/\w+\/folder/, 500, {
        delay: MOCK_DELAY
      })
      .post(/\/project\/\w+\/(file|doc|folder)\/\w+\/rename/, 500, {
        delay: MOCK_DELAY
      })
      .delete(/\/project\/\w+\/(file|doc|folder)\/\w+/, 500, {
        delay: MOCK_DELAY
      })
  }
}

export const FallbackError = args => <FileTreeError {...args} />

export const FilesLimit = args => <FileTreeRoot {...args} />
FilesLimit.args = { rootFolder: rootFolderLimit }
FilesLimit.parameters = { setupMocks: defaultSetupMocks }

export default {
  title: 'File Tree',
  component: FileTreeRoot,
  args: {
    rootFolder: rootFolderBase,
    hasWritePermissions: true,
    projectId: '123abc',
    rootDocId: '5e74f1a7ce17ae0041dfd056',
    isConnected: true
  },
  argTypes: {
    onInit: { action: 'onInit' },
    onSelect: { action: 'onSelect' }
  },
  decorators: [
    (Story, { parameters: { setupMocks } }) => {
      if (setupMocks) setupMocks()
      return <Story />
    },
    Story => (
      <>
        <style>{'html, body, .file-tree { height: 100%; width: 100%; }'}</style>
        <div className="editor-sidebar full-size">
          <div className="file-tree">
            <Story />
          </div>
        </div>
      </>
    )
  ]
}
