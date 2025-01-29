import { useCallback, useState, Dispatch, SetStateAction } from 'react'

export default function useSubmittableTextInput(
  handleSubmit: (
    content: string,
    setContent: Dispatch<SetStateAction<string>>
  ) => void
) {
  const [content, setContent] = useState('')

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        if (content.trim().length > 0) {
          handleSubmit(content, setContent)
        }
      }
    },
    [content, handleSubmit]
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setContent(e.target.value)
    },
    []
  )

  return { handleChange, handleKeyPress, content }
}
