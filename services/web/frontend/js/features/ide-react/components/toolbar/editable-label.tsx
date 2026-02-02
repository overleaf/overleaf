import OLFormControl from '@/shared/components/ol/ol-form-control'
import {
  ChangeEventHandler,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

type EditableLabelProps = {
  initialText: string
  className?: string
  onChange: (name: string) => void
  onCancel: () => void
  maxLength?: number
}

const EditableLabel = ({
  initialText,
  className,
  onChange,
  onCancel,
  maxLength,
}: EditableLabelProps) => {
  const [name, setName] = useState(initialText)

  const inputRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    inputRef.current?.select()
  }, [])

  const onInputChange: ChangeEventHandler<HTMLInputElement> = useCallback(
    event => {
      setName(event.target.value)
    },
    []
  )

  const finishRenaming = useCallback(() => {
    onChange(name)
  }, [onChange, name])

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        finishRenaming()
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
      }
    },
    [finishRenaming, onCancel]
  )

  return (
    <OLFormControl
      className={className}
      ref={inputRef}
      type="text"
      value={name}
      onChange={onInputChange}
      onKeyDown={onKeyDown}
      onBlur={finishRenaming}
      maxLength={maxLength}
    />
  )
}
export default EditableLabel
