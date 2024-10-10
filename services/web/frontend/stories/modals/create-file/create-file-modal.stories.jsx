import {
  createFileModalDecorator,
  mockCreateFileModalFetch,
} from './create-file-modal-decorator'
import FileTreeModalCreateFile from '../../../js/features/file-tree/components/modals/file-tree-modal-create-file'
import useFetchMock from '../../hooks/use-fetch-mock'
import { ScopeDecorator } from '../../decorators/scope'
import { useScope } from '../../hooks/use-scope'
import getMeta from '@/utils/meta'
import { bsVersionDecorator } from '../../../../.storybook/utils/with-bootstrap-switcher'

export const MinimalFeatures = args => {
  useFetchMock(mockCreateFileModalFetch)
  Object.assign(getMeta('ol-ExposedSettings'), {
    hasLinkUrlFeature: false,
    hasLinkedProjectFileFeature: false,
    hasLinkedProjectOutputFileFeature: false,
  })

  return <FileTreeModalCreateFile {...args} />
}
MinimalFeatures.decorators = [createFileModalDecorator()]

export const WithExtraFeatures = args => {
  useFetchMock(mockCreateFileModalFetch)

  getMeta('ol-ExposedSettings').hasLinkUrlFeature = true

  return <FileTreeModalCreateFile {...args} />
}
WithExtraFeatures.decorators = [
  createFileModalDecorator({
    refProviders: { mendeley: true, zotero: true },
  }),
]

export const ErrorImportingFileFromExternalURL = args => {
  useFetchMock(fetchMock => {
    mockCreateFileModalFetch(fetchMock)

    fetchMock.post('express:/project/:projectId/linked_file', 500, {
      overwriteRoutes: true,
    })
  })

  getMeta('ol-ExposedSettings').hasLinkUrlFeature = true

  return <FileTreeModalCreateFile {...args} />
}
ErrorImportingFileFromExternalURL.decorators = [createFileModalDecorator()]

export const ErrorImportingFileFromReferenceProvider = args => {
  useFetchMock(fetchMock => {
    mockCreateFileModalFetch(fetchMock)

    fetchMock.post('express:/project/:projectId/linked_file', 500, {
      overwriteRoutes: true,
    })
  })

  return <FileTreeModalCreateFile {...args} />
}
ErrorImportingFileFromReferenceProvider.decorators = [
  createFileModalDecorator({
    refProviders: { mendeley: true, zotero: true },
  }),
]

export const FileLimitReached = args => {
  useFetchMock(mockCreateFileModalFetch)

  useScope({
    project: {
      rootFolder: {
        _id: 'root-folder-id',
        name: 'rootFolder',
        docs: Array.from({ length: 10 }, (_, index) => ({
          _id: `entity-${index}`,
        })),
        fileRefs: [],
        folders: [],
      },
    },
  })

  return <FileTreeModalCreateFile {...args} />
}
FileLimitReached.decorators = [createFileModalDecorator()]

export default {
  title: 'Editor / Modals / Create File',
  component: FileTreeModalCreateFile,
  decorators: [ScopeDecorator],
  argTypes: {
    ...bsVersionDecorator.argTypes,
  },
}
