import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import NewProjectButtonModal from './new-project-button/new-project-button-modal'
import type { NewProjectButtonModalVariant } from './new-project-button/new-project-button-modal'
import type { Nullable } from '../../../../../types/utils'
import WelcomeMessageLink from './welcome-message-new/welcome-message-link'
import WelcomeMessageCreateNewProjectDropdown from './welcome-message-new/welcome-message-create-new-project-dropdown'
import learnLatexImage from '../images/learn-latex.svg'
import browseTemplatesImage from '../images/browse-templates.svg'
import getMeta from '@/utils/meta'
import OLPageContentCard from '@/shared/components/ol/ol-page-content-card'

export default function WelcomeMessage() {
  const { t } = useTranslation()
  const [activeModal, setActiveModal] =
    useState<Nullable<NewProjectButtonModalVariant>>(null)

  const { wikiEnabled, templatesEnabled } = getMeta('ol-ExposedSettings')

  return (
    <>
      <OLPageContentCard>
        <div className="welcome-new-wrapper">
          <div className="welcome text-center">
            <h2 className="welcome-title">{t('welcome_to_sl')}</h2>
            <div className="welcome-message-cards-wrapper">
              <WelcomeMessageCreateNewProjectDropdown
                setActiveModal={modal => setActiveModal(modal)}
              />
              {wikiEnabled && (
                <WelcomeMessageLink
                  imgSrc={learnLatexImage}
                  title="Learn LaTeX with a tutorial"
                  href="/learn/latex/Learn_LaTeX_in_30_minutes"
                  target="_blank"
                />
              )}
              {templatesEnabled && (
                <WelcomeMessageLink
                  imgSrc={browseTemplatesImage}
                  title="Browse templates"
                  href="/templates"
                />
              )}
            </div>
          </div>
        </div>
      </OLPageContentCard>
      <NewProjectButtonModal
        modal={activeModal}
        onHide={() => setActiveModal(null)}
      />
    </>
  )
}
