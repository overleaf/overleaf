import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import NewProjectButtonModal from './new-project-button/new-project-button-modal'
import type { NewProjectButtonModalVariant } from './new-project-button/new-project-button-modal'
import type { Nullable } from '../../../../../types/utils'
import WelcomeMessageLink from './welcome-message-new/welcome-message-link'
import WelcomeMessageCreateNewProjectDropdown from './welcome-message-new/welcome-message-create-new-project-dropdown'

export default function WelcomeMessage() {
  const { t } = useTranslation()
  const [activeModal, setActiveModal] =
    useState<Nullable<NewProjectButtonModalVariant>>(null)

  return (
    <>
      <div className="card welcome-new-wrapper">
        <div className="welcome text-centered">
          <h2 className="welcome-title">{t('welcome_to_sl')}</h2>
          <div className="welcome-message-cards-wrapper">
            <WelcomeMessageCreateNewProjectDropdown
              setActiveModal={modal => setActiveModal(modal)}
            />
            <WelcomeMessageLink
              imgSrc="/img/welcome-page/learn-latex.svg"
              title="Learn LaTeX with a tutorial"
              href="/learn/latex/Learn_LaTeX_in_30_minutes"
              target="_blank"
            />
            <WelcomeMessageLink
              imgSrc="/img/welcome-page/browse-templates.svg"
              title="Browse templates"
              href="/templates"
            />
          </div>
        </div>
      </div>
      <NewProjectButtonModal
        modal={activeModal}
        onHide={() => setActiveModal(null)}
      />
    </>
  )
}
