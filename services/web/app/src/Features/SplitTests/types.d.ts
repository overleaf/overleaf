type AssignmentMetadata = {
  phase?: 'alpha' | 'beta' | 'release'
  versionNumber?: boolean
  // only returned when `analyticsEnabled` is set to `true` on the current version
  // of the split test, and an assignment is queried for the user for the first time
  isFirstNonDefaultAssignment?: boolean
}

export type Assignment = {
  variant: string
  metadata: AssignmentMetadata
}
