import { useTranslation } from 'react-i18next'
import Icon from '../../../shared/components/icon'
import * as eventTracking from '../../../infrastructure/event-tracking'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import MaterialIcon from '@/shared/components/material-icon'

function BackToProjectsButton() {
  const { t } = useTranslation()

  return (
    <OLTooltip
      id="back-to-projects"
      description={t('back_to_your_projects')}
      overlayProps={{ placement: 'right' }}
    >
      <div className="toolbar-item">
        <a
          className="btn btn-full-height"
          draggable="false"
          href="/project"
          onClick={() => {
            eventTracking.sendMB('navigation-clicked-home')
          }}
        >
          <BootstrapVersionSwitcher
            bs3={
              <Icon
                type="home"
                fw
                accessibilityLabel={t('back_to_your_projects')}
              />
            }
            bs5={
              <MaterialIcon
                type="home"
                className="align-text-bottom"
                accessibilityLabel={t('back_to_your_projects')}
              />
            }
          />
        </a>
      </div>
    </OLTooltip>
  )
}

export default BackToProjectsButton
