import React from 'react'
import { createFileModalDecorator } from './create-file-modal-decorator'
import FileTreeModalCreateFile from '../../../js/features/file-tree/components/modals/file-tree-modal-create-file'

export const MinimalFeatures = args => <FileTreeModalCreateFile {...args} />
MinimalFeatures.decorators = [
  createFileModalDecorator({
    userHasFeature: () => false
  })
]

export const WithExtraFeatures = args => <FileTreeModalCreateFile {...args} />
WithExtraFeatures.decorators = [createFileModalDecorator()]

export const FileLimitReached = args => <FileTreeModalCreateFile {...args} />
FileLimitReached.decorators = [
  createFileModalDecorator({
    rootFolder: [
      {
        docs: Array.from({ length: 10 }, (_, index) => ({
          _id: `entity-${index}`
        })),
        fileRefs: [],
        folders: []
      }
    ]
  })
]

export default {
  title: 'Modals / Create File',
  component: FileTreeModalCreateFile
}
