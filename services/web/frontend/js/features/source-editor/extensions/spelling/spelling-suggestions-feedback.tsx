import { FC, memo } from 'react'
import { useTranslation } from 'react-i18next'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import classnames from 'classnames'
import MaterialIcon from '@/shared/components/material-icon'
import { Dropdown } from 'react-bootstrap-5'
import { bsVersion, isBootstrap5 } from '@/features/utils/bootstrap-5'
import PolymorphicComponent from '@/shared/components/polymorphic-component'

const SpellingSuggestionsFeedback: FC = () => {
  const { t } = useTranslation()
  return (
    <OLTooltip
      id="spell-check-client-tooltip"
      description={
        <>
          The spell-checker has been updated.
          <br />
          Click to give feedback
        </>
      }
      tooltipProps={{ className: 'split-test-badge-tooltip' }}
      overlayProps={{ placement: 'bottom', delay: 100 }}
    >
      <span>
        <PolymorphicComponent
          as={isBootstrap5() ? Dropdown.Item : 'a'}
          href="https://docs.google.com/forms/d/e/1FAIpQLSdD1wa5SiCZ7x_UF6e8vywTN82kSm6ou2rTKz-XBiEjNilOXQ/viewform"
          target="_blank"
          rel="noopener noreferrer"
          className={bsVersion({ bs3: 'dropdown-menu-button' })}
        >
          <BootstrapVersionSwitcher
            bs3={
              <span
                className={classnames('badge', 'info-badge')}
                style={{ width: 14, height: 14 }}
              />
            }
            bs5={
              <MaterialIcon
                type="info"
                className={classnames('align-middle', 'info-badge')}
              />
            }
          />
          <span className="mx-2">{t('give_feedback')}</span>
        </PolymorphicComponent>
      </span>
    </OLTooltip>
  )
}

export default memo(SpellingSuggestionsFeedback)
