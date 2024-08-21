export type LinkedFileData = {
  url: {
    provider: 'url'
    url: string
  }
  project_file: {
    provider: 'project_file'
    v1_source_doc_id?: string
    source_project_id: string
    source_entity_path: string
  }
  project_output_file: {
    provider: 'project_output_file'
    v1_source_doc_id?: string
    source_project_id: string
    source_output_file_path: string
  }
}

export type BinaryFile<T extends keyof LinkedFileData = keyof LinkedFileData> =
  {
    _id: string
    name: string
    created: Date
    id: string
    type: string
    selected: boolean
    linkedFileData?: LinkedFileData[T]
    hash: string
  }

export type LinkedFile<T extends keyof LinkedFileData> = Required<BinaryFile<T>>

export const hasProvider = <T extends keyof LinkedFileData>(
  file: BinaryFile,
  provider: T
): file is LinkedFile<T> => file.linkedFileData?.provider === provider
