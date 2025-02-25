const stopPropagation = (e: React.FocusEvent | React.MouseEvent) =>
  e.stopPropagation()

export const PreventSelectingEntry = ({
  children,
}: {
  children: React.ReactNode
}) => {
  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div onFocus={stopPropagation} onMouseUp={stopPropagation}>
      {children}
    </div>
  )
}
