import { useEffect } from 'react'
import {
  createFileModalDecorator,
  mockCreateFileModalFetch,
} from './create-file-modal-decorator'
import FileTreeModalCreateFile from '../../../js/features/file-tree/components/modals/file-tree-modal-create-file'
import useFetchMock from '../../hooks/use-fetch-mock'

export const MinimalFeatures = args => {
  useFetchMock(mockCreateFileModalFetch)

  return <FileTreeModalCreateFile {...args} />
}
MinimalFeatures.decorators = [createFileModalDecorator()]

export const WithExtraFeatures = args => {
  useFetchMock(mockCreateFileModalFetch)

  useEffect(() => {
    const originalValue = window.ExposedSettings.hasLinkUrlFeature
    window.ExposedSettings.hasLinkUrlFeature = true

    return () => {
      window.ExposedSettings.hasLinkUrlFeature = originalValue
    }
  }, [])

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

  useEffect(() => {
    const originalValue = window.ExposedSettings.hasLinkUrlFeature
    window.ExposedSettings.hasLinkUrlFeature = true

    return () => {
      window.ExposedSettings.hasLinkUrlFeature = originalValue
    }
  }, [])

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

  return <FileTreeModalCreateFile {...args} />
}
FileLimitReached.decorators = [
  createFileModalDecorator(
    {},
    {
      rootFolder: [
        {
          _id: 'root-folder-id',
          name: 'rootFolder',
          docs: Array.from({ length: 10 }, (_, index) => ({
            _id: `entity-${index}`,
          })),
          fileRefs: [],
          folders: [],
        },
      ],
    }
  ),
]

export default {
  title: 'Editor / Modals / Create File',
  component: FileTreeModalCreateFile,
}
