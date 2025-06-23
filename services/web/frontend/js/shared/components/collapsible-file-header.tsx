import MaterialIcon from '@/shared/components/material-icon'
import { Dispatch, FC, SetStateAction } from 'react'

export const CollapsibleFileHeader: FC<{
  name: string
  count: number
  collapsed: boolean
  toggleCollapsed: Dispatch<SetStateAction<any>>
}> = ({ name, count, collapsed, toggleCollapsed }) => (
  <button
    type="button"
    className="collapsible-file-header"
    onClick={toggleCollapsed}
    translate="no"
  >
    <MaterialIcon
      type={collapsed ? 'keyboard_arrow_right' : 'keyboard_arrow_down'}
    />
    {name}
    <div className="collapsible-file-header-count">{count}</div>
  </button>
)
