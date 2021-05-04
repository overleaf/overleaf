import React from 'react'

import BinaryFile from '../js/features/binary-file/components/binary-file'
import fetchMock from 'fetch-mock'

window.project_id = 'proj123'
fetchMock.restore()
fetchMock.head('express:/project/:project_id/file/:file_id', {
  status: 201,
  headers: { 'Content-Length': 10000 },
})
fetchMock.get('express:/project/:project_id/file/:file_id', 'Text file content')

fetchMock.post('express:/project/:project_id/linked_file/:file_id/refresh', {
  status: 204,
})

fetchMock.post('express:/project/:project_id/references/indexAll', {
  status: 204,
})

window.project_id = '1234'

const fileData = {
  id: 'file-id',
  name: 'file.tex',
  created: new Date(),
}

export const FileFromUrl = args => {
  return <BinaryFile {...args} />
}
FileFromUrl.args = {
  file: {
    ...fileData,
    linkedFileData: {
      url: 'https://overleaf.com',
      provider: 'url',
    },
  },
}

export const FileFromProjectWithLinkableProjectId = args => {
  return <BinaryFile {...args} />
}
FileFromProjectWithLinkableProjectId.args = {
  file: {
    ...fileData,
    linkedFileData: {
      source_project_id: 'source-project-id',
      source_entity_path: '/source-entity-path.ext',
      provider: 'project_file',
    },
  },
}

export const FileFromProjectWithoutLinkableProjectId = args => {
  return <BinaryFile {...args} />
}
FileFromProjectWithoutLinkableProjectId.args = {
  file: {
    ...fileData,
    linkedFileData: {
      v1_source_doc_id: 'v1-source-id',
      source_entity_path: '/source-entity-path.ext',
      provider: 'project_file',
    },
  },
}

export const FileFromProjectOutputWithLinkableProject = args => {
  return <BinaryFile {...args} />
}
FileFromProjectOutputWithLinkableProject.args = {
  file: {
    ...fileData,
    linkedFileData: {
      source_project_id: 'source_project_id',
      source_output_file_path: '/source-entity-path.ext',
      provider: 'project_output_file',
    },
  },
}

export const FileFromProjectOutputWithoutLinkableProjectId = args => {
  return <BinaryFile {...args} />
}
FileFromProjectOutputWithoutLinkableProjectId.args = {
  file: {
    ...fileData,
    linkedFileData: {
      v1_source_doc_id: 'v1-source-id',
      source_output_file_path: '/source-entity-path.ext',
      provider: 'project_output_file',
    },
  },
}

export const ImageFile = args => {
  return <BinaryFile {...args} />
}
ImageFile.args = {
  file: {
    ...fileData,
    id: '60097ca20454610027c442a8',
    name: 'file.jpg',
    linkedFileData: {
      source_project_id: 'source_project_id',
      source_entity_path: '/source-entity-path',
      provider: 'project_file',
    },
  },
}

export const ThirdPartyReferenceFile = args => {
  return <BinaryFile {...args} />
}

ThirdPartyReferenceFile.args = {
  file: {
    ...fileData,
    name: 'example.tex',
    linkedFileData: {
      provider: 'zotero',
    },
  },
}

export const ThirdPartyReferenceFileWithError = args => {
  return <BinaryFile {...args} />
}
ThirdPartyReferenceFileWithError.args = {
  file: {
    ...fileData,
    id: '500500500500500500500500',
    name: 'example.tex',
    linkedFileData: {
      provider: 'zotero',
    },
  },
}

export const TextFile = args => {
  return <BinaryFile {...args} />
}
TextFile.args = {
  file: {
    ...fileData,
    linkedFileData: {
      source_project_id: 'source-project-id',
      source_entity_path: '/source-entity-path.ext',
      provider: 'project_file',
    },
    name: 'file.txt',
  },
}

export const UploadedFile = args => {
  return <BinaryFile {...args} />
}
UploadedFile.args = {
  file: {
    ...fileData,
    linkedFileData: null,
    name: 'file.jpg',
  },
}

export default {
  title: 'BinaryFile',
  component: BinaryFile,
  args: {
    storeReferencesKeys: () => {},
  },
  decorators: [
    BinaryFile => (
      <>
        <style>{'html, body { height: 100%; }'}</style>
        <BinaryFile />
      </>
    ),
  ],
}
