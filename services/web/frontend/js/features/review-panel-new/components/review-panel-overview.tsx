import { FC, useMemo } from 'react'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { Ranges } from '../context/ranges-context'
import { useTranslation } from 'react-i18next'
import { ReviewPanelOverviewFile } from './review-panel-overview-file'
import ReviewPanelEmptyState from './review-panel-empty-state'
import useProjectRanges from '../hooks/use-project-ranges'

export const ReviewPanelOverview: FC = () => {
  const { t } = useTranslation()
  const { docs } = useFileTreeData()

  const { projectRanges, error } = useProjectRanges()

  const rangesForDocs = useMemo(() => {
    if (docs && projectRanges) {
      const rangesForDocs = new Map<string, Ranges>()

      for (const doc of docs) {
        const ranges = projectRanges.get(doc.doc.id)

        if (ranges) {
          rangesForDocs.set(doc.doc.id, ranges)
        }
      }

      return rangesForDocs
    }
  }, [docs, projectRanges])

  const showEmptyState = useMemo((): boolean => {
    if (!rangesForDocs) {
      // data isn't loaded yet
      return false
    }

    for (const ranges of rangesForDocs.values()) {
      if (ranges.changes.length > 0 || ranges.comments.length > 0) {
        return false
      }
    }

    return true
  }, [rangesForDocs])

  return (
    <div className="review-panel-overview">
      {error && <div>{t('something_went_wrong')}</div>}

      {showEmptyState && <ReviewPanelEmptyState />}

      {docs && rangesForDocs && (
        <div>
          {docs.map(doc => {
            const ranges = rangesForDocs.get(doc.doc.id)
            return (
              ranges && (
                <ReviewPanelOverviewFile
                  key={doc.doc.id}
                  doc={doc}
                  ranges={ranges}
                />
              )
            )
          })}
        </div>
      )}
    </div>
  )
}
