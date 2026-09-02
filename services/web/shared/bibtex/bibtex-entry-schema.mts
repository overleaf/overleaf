export type BibEntryInput = {
  key: string
  label: string
  helperText: string
}

export type BibEntryType = {
  key: string
  label: string
  fields: string[]
  optionalFields: string[]
  requiredFields: (string | string[])[]
}
