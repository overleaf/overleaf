import { FC, Fragment, ReactElement, useCallback } from 'react'
import {
  Message,
  MessageContent,
  Response,
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
  PromptInputProvider,
  PromptInputMessage,
  Skeleton,
  Alert,
} from '../'
import { cn } from '../utils'
import { ShadowRootPortal } from './shadow-root-portal'
import {
  DefaultChatTransport,
  getToolName,
  isFileUIPart,
  isReasoningUIPart,
  isTextUIPart,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithToolCalls,
  UIMessage,
  UIMessagePart,
} from 'ai'
import { useChat, UseChatHelpers } from '@ai-sdk/react'
import { ChatPromptInput } from './chat-prompt-input'

export type ChatRunners = Record<string, (input: any) => any | Promise<any>>

export type ChatRenderers = Record<
  string,
  (
    part: UIMessagePart<any, any>,
    chat: UseChatHelpers<UIMessage>
  ) => ReactElement
>

export const Chat: FC<{
  className: string
  chatId: string
  api: string
  headers: Record<string, string>
  runners: ChatRunners
  renderers: ChatRenderers
}> = ({ className, chatId, api, headers, runners, renderers }) => {
  const chat = useChat({
    id: chatId,
    transport: new DefaultChatTransport({ api, headers }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    async onToolCall({ toolCall }) {
      if (toolCall.dynamic) {
        return
      }

      const run = runners[toolCall.toolName]

      if (run) {
        const output = run(toolCall.input)

        chat.addToolResult({
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          output,
        })
      }
    },
  })

  const handleSubmit = useCallback(
    async (message: PromptInputMessage) => {
      if (chat.status === 'streaming' || chat.status === 'submitted') {
        await chat.stop()
        return false
      }

      if (chat.status !== 'ready') {
        return false
      }

      const text = message.text?.trim()
      if (!text || text.length === 0) {
        return false
      }

      chat.sendMessage({ text }) // TODO: files, metadata
      return true
    },
    [chat]
  )

  return (
    <ShadowRootPortal>
      <Conversation
        className={cn('workbench-conversation', 'h-full', className)}
      >
        <ConversationContent>
          {chat.messages.length === 0 ? (
            <ConversationEmptyState />
          ) : (
            chat.messages.map(message => (
              <div key={message.id}>
                <Message from={message.role}>
                  <MessageContent variant="flat">
                    {message.parts.map((part, i) => {
                      const key = `${message.role}-${i}`

                      if (isTextUIPart(part)) {
                        return <Response key={key}>{part.text}</Response>
                      }

                      if (isReasoningUIPart(part)) {
                        const isStreaming =
                          chat.status === 'streaming' &&
                          i === message.parts.length - 1 &&
                          message.id === chat.messages.at(-1)?.id

                        return (
                          <Reasoning
                            key={key}
                            className="w-full"
                            isStreaming={isStreaming}
                            defaultOpen={false}
                          >
                            <ReasoningTrigger />
                            <ReasoningContent>{part.text}</ReasoningContent>
                          </Reasoning>
                        )
                      }

                      if (isFileUIPart(part)) {
                        return <div>{part.filename}</div>
                      }

                      if (isToolUIPart(part)) {
                        switch (part.state) {
                          case 'input-streaming':
                            return (
                              <Skeleton
                                key={key}
                                className="h-[40px] w-full rounded-full"
                              />
                            )

                          case 'input-available':
                          case 'output-available': {
                            const toolName = getToolName(part)
                            const render = renderers[toolName]

                            if (!render) {
                              // TODO: error message
                              return null
                            }

                            return (
                              <Fragment key={key}>
                                {render(part, chat)}
                              </Fragment>
                            )
                          }

                          case 'output-error':
                            return <Alert key={key}>{part.errorText}</Alert>
                        }
                      }

                      return null
                    })}
                  </MessageContent>
                </Message>
              </div>
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <PromptInputProvider>
        <ChatPromptInput status={chat.status} onSubmit={handleSubmit} />
      </PromptInputProvider>
    </ShadowRootPortal>
  )
}
