import { useTranslation } from 'react-i18next'
import Tooltip from '../../../shared/components/tooltip'
import Icon from '../../../shared/components/icon'

function BackToProjectsButton() {
  const { t } = useTranslation()

  return (
    <Tooltip
      id="back-to-projects"
      description={t('back_to_your_projects')}
      overlayProps={{ placement: 'right' }}
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
    </Tooltip>
  )
}

export default BackToProjectsButton
