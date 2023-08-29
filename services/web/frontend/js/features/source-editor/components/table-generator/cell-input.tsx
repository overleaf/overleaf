import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react'

interface CellInputProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string
}

export type CellInputRef = {
  focus: () => void
}

export const CellInput = forwardRef<CellInputRef, CellInputProps>(
  function CellInput({ value, ...props }: CellInputProps, ref) {
    const inputRef = useRef<HTMLTextAreaElement>(null)
    useImperativeHandle(ref, () => {
      return {
        focus() {
          inputRef.current?.focus()
          inputRef.current?.setSelectionRange(value.length, value.length)
        },
      }
    })

    useLayoutEffect(() => {
      if (inputRef?.current) {
        inputRef.current.style.height = '1px'
        inputRef.current.style.height = `${inputRef.current.scrollHeight}px`
      }
    }, [value])

    return <textarea {...props} value={value} ref={inputRef} />
  }
)
