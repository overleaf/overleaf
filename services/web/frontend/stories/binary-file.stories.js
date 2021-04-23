import React from 'react'

import BinaryFile from '../js/features/binary-file/components/binary-file'
import fetchMock from 'fetch-mock'

window.project_id = 'proj123'
fetchMock.restore()
fetchMock.head('express:/project/:project_id/file/:file_id', {
  status: 201,
  headers: { 'Content-Length': 10000 }
})
fetchMock.get('express:/project/:project_id/file/:file_id', 'Text file content')

fetchMock.post('express:/project/:project_id/linked_file/:file_id/refresh', {
  status: 204
})

fetchMock.post('express:/project/:project_id/references/indexAll', {
  status: 204
})

window.project_id = '1234'

export const FileFromUrl = args => {
  return <BinaryFile {...args} />
}
FileFromUrl.args = {
  file: {
    linkedFileData: {
      url: 'https://overleaf.com',
      provider: 'url'
    }
  }
}

export const FileFromProjectWithLinkableProjectId = args => {
  return <BinaryFile {...args} />
}
FileFromProjectWithLinkableProjectId.args = {
  file: {
    linkedFileData: {
      source_project_id: 'source-project-id',
      source_entity_path: '/source-entity-path.ext',
      provider: 'project_file'
    }
  }
}

export const FileFromProjectWithoutLinkableProjectId = args => {
  return <BinaryFile {...args} />
}
FileFromProjectWithoutLinkableProjectId.args = {
  file: {
    linkedFileData: {
      v1_source_doc_id: 'v1-source-id',
      source_entity_path: '/source-entity-path.ext',
      provider: 'project_file'
    }
  }
}

export const FileFromProjectOutputWithLinkableProject = args => {
  return <BinaryFile {...args} />
}
FileFromProjectOutputWithLinkableProject.args = {
  file: {
    linkedFileData: {
      source_project_id: 'source_project_id',
      source_output_file_path: '/source-entity-path.ext',
      provider: 'project_output_file'
    }
  }
}

export const FileFromProjectOutputWithoutLinkableProjectId = args => {
  return <BinaryFile {...args} />
}
FileFromProjectOutputWithoutLinkableProjectId.args = {
  file: {
    linkedFileData: {
      v1_source_doc_id: 'v1-source-id',
      source_output_file_path: '/source-entity-path.ext',
      provider: 'project_output_file'
    }
  }
}

export const ImageFile = args => {
  return <BinaryFile {...args} />
}
ImageFile.args = {
  file: {
    id: '60097ca20454610027c442a8',
    name: 'file.jpg',
    linkedFileData: {
      source_project_id: 'source_project_id',
      source_entity_path: '/source-entity-path',
      provider: 'project_file'
    }
  }
}

export const ThirdPartyReferenceFile = args => {
  return <BinaryFile {...args} />
}

ThirdPartyReferenceFile.args = {
  file: {
    name: 'example.tex',
    linkedFileData: {
      provider: 'zotero'
    }
  }
}

export const ThirdPartyReferenceFileWithError = args => {
  return <BinaryFile {...args} />
}

ThirdPartyReferenceFileWithError.args = {
  file: {
    id: '500500500500500500500500',
    name: 'example.tex',
    linkedFileData: {
      provider: 'zotero'
    }
  }
}

export const TextFile = args => {
  return <BinaryFile {...args} />
}
TextFile.args = {
  file: {
    linkedFileData: {
      source_project_id: 'source-project-id',
      source_entity_path: '/source-entity-path.ext',
      provider: 'project_file'
    },
    name: 'file.txt'
  }
}

export const UploadedFile = args => {
  return <BinaryFile {...args} />
}
UploadedFile.args = {
  file: {
    linkedFileData: null,
    name: 'file.jpg'
  }
}

export default {
  title: 'BinaryFile',
  component: BinaryFile,
  args: {
    file: {
      id: 'file-id',
      name: 'file.tex',
      created: new Date()
    },
    storeReferencesKeys: () => {}
  },
  decorators: [
    BinaryFile => (
      <>
        <style>{'html, body { height: 100%; }'}</style>
        <BinaryFile />
      </>
    )
  ]
}
