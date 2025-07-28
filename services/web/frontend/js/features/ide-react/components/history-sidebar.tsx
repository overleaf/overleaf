import React from 'react'
import { useTranslation } from 'react-i18next'

export function HistorySidebar() {
  const { t } = useTranslation()
  return (
    <nav
      id="history-file-tree"
      className="ide-react-editor-sidebar history-file-tree"
      aria-label={t('project_files_history')}
    />
  )
}
