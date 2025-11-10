import { FC } from 'react'
import {
  PromptInput,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputMessage,
  PromptInputSubmit,
  PromptInputSubmitProps,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputController,
} from './ai-elements/prompt-input'

export const ChatPromptInput: FC<{
  status: PromptInputSubmitProps['status']
  onSubmit: (message: PromptInputMessage) => Promise<boolean>
}> = ({ status, onSubmit }) => {
  const controller = usePromptInputController()

  return (
    <PromptInput
      onSubmit={async message => {
        const result = await onSubmit(message)
        if (result) {
          controller.textInput.clear()
        }
      }}
      globalDrop
      multiple
      className="mt-4"
    >
      <PromptInputHeader>
        <PromptInputAttachments>
          {attachment => <PromptInputAttachment data={attachment} />}
        </PromptInputAttachments>
      </PromptInputHeader>

      <PromptInputBody>
        <PromptInputTextarea />
      </PromptInputBody>

      <PromptInputFooter>
        <PromptInputTools />
        <PromptInputSubmit status={status} />
      </PromptInputFooter>
    </PromptInput>
  )
}
