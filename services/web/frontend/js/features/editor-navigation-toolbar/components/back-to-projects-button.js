import Icon from '../../../shared/components/icon'
import { useTranslation } from 'react-i18next'
import { OverlayTrigger, Tooltip } from 'react-bootstrap'

function BackToProjectsButton() {
  const { t } = useTranslation()

  return (
    <OverlayTrigger
      placement="right"
      overlay={
        <Tooltip id="back-to-projects-tooltip">
          {t('back_to_your_projects')}
        </Tooltip>
      }
    >
      <a className="toolbar-header-back-projects" href="/project">
        <Icon type="home" fw accessibilityLabel={t('back_to_your_projects')} />
      </a>
    </OverlayTrigger>
  )
}

export default BackToProjectsButton
