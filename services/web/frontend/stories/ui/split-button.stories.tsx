import { Fragment } from 'react'
import type { Meta } from '@storybook/react'
import { useTranslation } from 'react-i18next'
import {
  Dropdown,
  DropdownHeader,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
} from '@/features/ui/components/bootstrap-5/dropdown-menu'
import Button from '@/features/ui/components/bootstrap-5/button'
import { ButtonGroup } from 'react-bootstrap-5'

type Args = React.ComponentProps<typeof Dropdown>

export const Sizes = (args: Args) => {
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
  title: 'Shared/Components/Bootstrap 5/SplitButton',
  component: Dropdown,
  args: {
    align: { sm: 'start' },
  },
  parameters: {
    bootstrap5: true,
  },
}

export default meta
