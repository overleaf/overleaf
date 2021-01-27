import React from 'react'
import Icon from '../../../shared/components/icon'
import { useTranslation } from 'react-i18next'

function BackToProjectsButton() {
  const { t } = useTranslation()
  return (
    <a className="toolbar-header-back-projects" href="/project">
      <Icon
        type="fw"
        modifier="level-up"
        accessibilityLabel={t('back_to_your_projects')}
      />
    </a>
  )
}

export default BackToProjectsButton
