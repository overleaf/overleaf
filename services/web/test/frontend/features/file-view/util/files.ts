import { BinaryFile } from '@/features/file-view/types/binary-file'

export const textFile: BinaryFile<'project_file'> = {
  _id: 'text-file',
  id: 'text-file',
  name: 'example.tex',
  linkedFileData: {
    v1_source_doc_id: 'v1-source-id',
    source_project_id: 'source-project-id',
    source_entity_path: '/source-entity-path.ext',
    provider: 'project_file',
  },
  hash: '012345678901234567890123',
  created: new Date(2021, 1, 17, 3, 24).toISOString(),
  type: 'file',
  selected: true,
}

export const imageFile: BinaryFile<'project_file'> = {
  _id: '60097ca20454610027c442a8',
  id: '60097ca20454610027c442a8',
  name: 'file.jpg',
  linkedFileData: {
    source_project_id: 'source-project-id',
    source_entity_path: '/source-entity-path',
    provider: 'project_file',
  },
  hash: '012345678901234567890123',
  created: new Date(2021, 1, 17, 3, 24).toISOString(),
  type: 'file',
  selected: true,
}

export const urlFile: BinaryFile<'url'> = {
  _id: 'url-file',
  id: 'url-file',
  name: 'example.tex',
  linkedFileData: {
    url: 'https://overleaf.com',
    provider: 'url',
  },
  created: new Date(2021, 1, 17, 3, 24).toISOString(),
  hash: 'some-hash',
  type: 'file',
  selected: true,
}

export const projectOutputFile: BinaryFile<'project_output_file'> = {
  _id: 'project-output-file',
  id: 'project-output-file',
  name: 'example.pdf',
  linkedFileData: {
    v1_source_doc_id: 'v1-source-id',
    source_output_file_path: '/source-entity-path.ext',
    provider: 'project_output_file',
    source_project_id: 'source-project-id',
  },
  created: new Date(2021, 1, 17, 3, 24).toISOString(),
  hash: 'some-hash',
  type: 'file',
  selected: true,
}
