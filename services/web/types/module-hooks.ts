/**
 * Types for module hook events fired across the application
 */

export type CommentAddedEvent = {
  projectId: string
  userId: string
  threadId: string
  messageId: string
}
