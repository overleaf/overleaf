import OLButton from '@/features/ui/components/ol/ol-button'
import MaterialIcon from '@/shared/components/material-icon'
import {
  Dropdown,
  DropdownMenu,
  DropdownToggle,
} from '@/features/ui/components/bootstrap-5/dropdown-menu'
import React, { forwardRef } from 'react'
import ChangeLayoutOptions from './change-layout-options'

const LayoutDropdownToggleButton = forwardRef<
  HTMLButtonElement,
  {
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  }
>(({ onClick }, ref) => {
  return (
    <OLButton
      size="sm"
      variant="ghost"
      className="ide-redesign-toolbar-button-subdued"
      ref={ref}
      onClick={onClick}
      leadingIcon={<MaterialIcon unfilled type="space_dashboard" />}
    />
  )
})

LayoutDropdownToggleButton.displayName = 'LayoutDropdownToggleButton'

export default function ChangeLayoutButton() {
  return (
    <div className="ide-redesign-toolbar-button-container">
      <Dropdown className="toolbar-item layout-dropdown" align="end">
        <DropdownToggle
          id="layout-dropdown-btn"
          className="btn-full-height"
          as={LayoutDropdownToggleButton}
        />
        <DropdownMenu>
          <ChangeLayoutOptions />
        </DropdownMenu>
      </Dropdown>
    </div>
  )
}
