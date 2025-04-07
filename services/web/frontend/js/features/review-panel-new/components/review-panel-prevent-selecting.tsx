const stopPropagation = (e: React.FocusEvent | React.MouseEvent) => {
  e.stopPropagation()
  e.preventDefault()
}

export const PreventSelectingEntry = ({
  children,
}: {
  children: React.ReactNode
}) => {
  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      onMouseDown={stopPropagation}
      onFocus={stopPropagation}
      onMouseUp={stopPropagation}
    >
      {children}
    </div>
  )
}
