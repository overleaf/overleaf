/**
 * Types for module hook events fired across the application
 */

export type SparseChangePreview = {
  sectionPath: string[]
  startLine: number
  changes: { i?: string; d?: string; p: number }[]
  slice: string
  sliceStart: number
  /** authors of the changes in this cluster */
  userIds: string[]
}

export type TrackChangesAcceptedEvent = {
  projectId: string
  docId: string
  userId: string
  changeContributors: string[]
  previews?: SparseChangePreview[] | null
}

export type TrackChangesRejectedEvent = {
  projectId: string
  docId: string
  userId: string
  changeContributors: string[]
  previews?: SparseChangePreview[] | null
}

export type CommentAddedEvent = {
  projectId: string
  userId: string
  threadId: string
  messageId: string
  content: string
}

export type CommentResolvedEvent = {
  projectId: string
  userId: string
  threadId: string
}

export type CommentReopenedEvent = {
  projectId: string
  userId: string
  threadId: string
}

export type CommentEditedEvent = {
  projectId: string
  userId: string
  threadId: string
  messageId: string
  content: string
}

export type CommentDeletedEvent = {
  projectId: string
  userId: string
  threadId: string
  messageId: string
}

export type ThreadDeletedEvent = {
  projectId: string
  userId: string
  threadId: string
}

export type ProjectModifiedEvent = {
  projectId: string
  timestamp: number
}
