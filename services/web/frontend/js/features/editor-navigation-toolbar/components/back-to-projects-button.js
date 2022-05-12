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
      <div className="toolbar-item">
        <a className="btn btn-full-height" href="/project">
          <Icon
            type="home"
            fw
            accessibilityLabel={t('back_to_your_projects')}
          />
        </a>
      </div>
    </OverlayTrigger>
  )
}

export default BackToProjectsButton
