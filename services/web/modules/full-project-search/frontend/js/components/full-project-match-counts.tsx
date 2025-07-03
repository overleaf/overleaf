import React, { FC } from 'react'
import LoadingSpinner from '@/shared/components/loading-spinner'
import { MatchedFile } from '../util/search-snapshot'
import { useTranslation } from 'react-i18next'

export const FullProjectMatchCounts: FC<{
  loading: boolean
  matchedFiles?: MatchedFile[]
}> = ({ loading, matchedFiles }) => {
  const { t } = useTranslation()

  if (loading) {
    return <LoadingSpinner delay={500} />
  }

  if (matchedFiles === undefined) {
    return null
  }

  const totalResults = matchedFiles.flatMap(file => file.hits).length

  if (totalResults === 0) {
    return <>{t('project_search_result_count', { count: totalResults })}</>
  }

  return (
    <>
      {t('project_search_result_count', { count: totalResults })}{' '}
      {t('project_search_file_count', { count: matchedFiles.length })}
    </>
  )
}
