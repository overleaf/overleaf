import { Fragment } from 'react'
import type { Meta } from '@storybook/react-webpack5'
import { useTranslation } from 'react-i18next'
import {
  OLDropdown,
  OLDropdownHeader,
  OLDropdownItem,
  OLDropdownMenu,
  OLDropdownToggle,
} from '@/shared/components/ol/ol-dropdown-menu'
import OLButton from '@/shared/components/ol/ol-button'
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
          <OLDropdown key={variant} as={ButtonGroup}>
            <OLButton variant={variant} size={size}>
              Split Button
            </OLButton>
            <OLDropdownToggle
              split
              variant={variant}
              id={`split-btn-${variant}-${size}`}
              size={size}
              aria-label={t('expand')}
            />
            <OLDropdownMenu>
              <OLDropdownHeader>Header</OLDropdownHeader>
              <OLDropdownItem as="button">Action 1</OLDropdownItem>
              <OLDropdownItem as="button">Action 2</OLDropdownItem>
              <OLDropdownItem as="button">Action 3</OLDropdownItem>
            </OLDropdownMenu>
          </OLDropdown>
        ))}
      </div>
    </Fragment>
  ))
}
const meta: Meta<typeof OLDropdown> = {
  title: 'Shared/Components/SplitButton',
  component: OLDropdown,
  args: {
    align: { sm: 'start' },
  },
  parameters: figmaDesignUrl(
    'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3460-194077&m=dev'
  ),
}

export default meta
