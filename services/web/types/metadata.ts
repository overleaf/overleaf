import { Folder } from './folder'

export type Package = {
  caption: string
  meta: string
  score: number
  snippet: string
}

export type MetadataDocument = {
  labels: string[]
  packages: Record<string, Package[]>
}

export type Metadata = {
  documents: Record<string, MetadataDocument>
  references: string[]
  fileTreeData: Folder
}
