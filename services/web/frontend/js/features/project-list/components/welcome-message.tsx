import { useCallback } from 'react'
import { Col, Row } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { sendMB } from '../../../infrastructure/event-tracking'
import NewProjectButton from './new-project-button'

export default function WelcomeMessage() {
  const { t } = useTranslation()

  const handleTemplatesClick = useCallback(() => {
    sendMB('welcome-page-templates-click', {
      'welcome-page-redesign': 'default',
    })
  }, [])

  const handleLatexHelpClick = useCallback(() => {
    sendMB('welcome-page-latex-help-click', {
      'welcome-page-redesign': 'default',
    })
  }, [])

  return (
    <div className="card card-thin">
      <div className="welcome text-centered">
        <h2>{t('welcome_to_sl')}</h2>
        <p>
          {t('new_to_latex_look_at')}&nbsp;
          <a href="/templates" onClick={handleTemplatesClick}>
            {t('templates').toLowerCase()}
          </a>
          &nbsp;{t('or')}&nbsp;
          <a href="/learn" onClick={handleLatexHelpClick}>
            {t('latex_help_guide')}
          </a>
        </p>
        <Row>
          <Col md={4} mdOffset={4}>
            <div className="dropdown minimal-create-proj-dropdown">
              <NewProjectButton
                id="new-project-button-welcome"
                menuClassName="minimal-create-proj-dropdown-menu"
                buttonText={t('create_first_project')}
                trackingKey="welcome-page-create-first-project-click"
              />
            </div>
          </Col>
        </Row>
      </div>
    </div>
  )
}
