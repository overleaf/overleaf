import { Brand } from '../helpers/brand'
import { UserId } from '../user'

export type SubView = 'cur_file' | 'overview'

export type ThreadId = Brand<string, 'ThreadId'>

export interface ReviewPanelUser {
  avatar_text: string
  email: string
  hue: number
  id: UserId
  isSelf: boolean
  name: string
}

export type CommentId = Brand<string, 'CommentId'>

export interface ReviewPanelCommentThreadMessage {
  content: string
  id: CommentId
  timestamp: Date
  user?: ReviewPanelUser
  user_id: UserId
}
