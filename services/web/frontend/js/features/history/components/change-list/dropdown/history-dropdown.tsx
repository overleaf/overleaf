import ActionsDropdown from './actions-dropdown'

type HistoryDropdownProps = {
  children: React.ReactNode
  id: string
  isOpened: boolean
  setIsOpened: (isOpened: boolean) => void
}

function HistoryDropdown({
  children,
  id,
  isOpened,
  setIsOpened,
}: HistoryDropdownProps) {
  return (
    <ActionsDropdown id={id} isOpened={isOpened} setIsOpened={setIsOpened}>
      {children}
    </ActionsDropdown>
  )
}

export default HistoryDropdown
