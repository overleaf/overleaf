import { Fragment } from 'react'
import type { Meta } from '@storybook/react'
import { useTranslation } from 'react-i18next'
import {
  Dropdown,
  DropdownHeader,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
} from '@/shared/components/dropdown/dropdown-menu'
import Button from '@/shared/components/button/button'
import { ButtonGroup } from 'react-bootstrap'
import { figmaDesignUrl } from '../../../.storybook/utils/figma-design-url'

export const Sizes = () => {
  const { t } = useTranslation()
  const sizes = {
    Large: 'lg',
    Regular: undefined,
    Small: 'sm',
  } as const
  const variants = ['primary', 'secondary', 'danger'] as const

  return Object.entries(sizes).map(([label, size]) => (
    <Fragment key={`${label}-${size}`}>
      <h4>{label}</h4>
      <div style={{ display: 'inline-flex', gap: '10px' }}>
        {variants.map(variant => (
          <Dropdown key={variant} as={ButtonGroup}>
            <Button variant={variant} size={size}>
              Split Button
            </Button>
            <DropdownToggle
              split
              variant={variant}
              id={`split-btn-${variant}-${size}`}
              size={size}
              aria-label={t('expand')}
            />
            <DropdownMenu>
              <DropdownHeader>Header</DropdownHeader>
              <DropdownItem as="button">Action 1</DropdownItem>
              <DropdownItem as="button">Action 2</DropdownItem>
              <DropdownItem as="button">Action 3</DropdownItem>
            </DropdownMenu>
          </Dropdown>
        ))}
      </div>
    </Fragment>
  ))
}
const meta: Meta<typeof Dropdown> = {
  title: 'Shared/Components/SplitButton',
  component: Dropdown,
  args: {
    align: { sm: 'start' },
  },
  parameters: figmaDesignUrl(
    'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3460-194077&m=dev'
  ),
}

export default meta
