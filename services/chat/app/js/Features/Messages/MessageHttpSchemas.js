import { z, zz } from '@overleaf/validation-tools'

export const MAX_MESSAGE_LENGTH = 10 * 1024 // 10kb, about 1,500 words
const DEFAULT_MESSAGE_LIMIT = 50

const projectParams = z.strictObject({ projectId: zz.objectId() })
const threadParams = projectParams.extend({ threadId: zz.objectId() })
const messageParams = projectParams.extend({ messageId: zz.objectId() })
const threadMessageParams = threadParams.extend({ messageId: zz.objectId() })
const userMessageParams = threadMessageParams.extend({ userId: zz.objectId() })

const messageContent = z
  .string({ error: 'No content provided' })
  .min(1, 'No content provided')
  .max(MAX_MESSAGE_LENGTH, `Content too long (> ${MAX_MESSAGE_LENGTH} bytes)`)

const sendMessageBody = z.strictObject({
  user_id: zz.objectId(),
  content: messageContent,
})

// web sends `userId` (camelCase) when editing, unlike `user_id` when sending.
const editMessageBody = z.strictObject({
  content: messageContent,
  userId: zz.objectId().optional(),
})

const threadsBody = z.strictObject({ threads: z.array(zz.objectId()) })

export const getGlobalMessages = z.object({
  params: projectParams,
  query: z.strictObject({
    before: z.coerce.number().int().optional(),
    limit: z.coerce.number().int().default(DEFAULT_MESSAGE_LIMIT),
  }),
})

export const sendGlobalMessage = z.object({
  params: projectParams,
  body: sendMessageBody,
})

export const getGlobalMessage = z.object({ params: messageParams })

export const deleteGlobalMessage = z.object({ params: messageParams })

export const editGlobalMessage = z.object({
  params: messageParams,
  body: editMessageBody,
})

export const sendMessage = z.object({
  params: threadParams,
  body: sendMessageBody,
})

export const getThreadMessage = z.object({ params: threadMessageParams })

export const deleteMessage = z.object({ params: threadMessageParams })

export const editMessage = z.object({
  params: threadMessageParams,
  body: editMessageBody,
})

export const deleteUserMessage = z.object({ params: userMessageParams })

export const resolveThread = z.object({
  params: threadParams,
  body: z.strictObject({ user_id: zz.objectId() }),
})

export const reopenThread = z.object({ params: threadParams })

export const getThread = z.object({ params: threadParams })

export const deleteThread = z.object({ params: threadParams })

export const getThreads = z.object({ params: projectParams })

export const getResolvedThreadIds = z.object({ params: projectParams })

export const destroyProject = z.object({ params: projectParams })

export const duplicateCommentThreads = z.object({
  params: projectParams,
  body: threadsBody,
})

export const generateThreadData = z.object({
  params: projectParams,
  body: threadsBody,
})

export const cloneCommentThreads = z.object({
  params: projectParams,
  body: z.strictObject({ targetProjectId: zz.objectId() }),
})
