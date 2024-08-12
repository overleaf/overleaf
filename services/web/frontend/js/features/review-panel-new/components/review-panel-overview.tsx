import { FC, useEffect, useMemo, useState } from 'react'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { Ranges, useRangesContext } from '../context/ranges-context'
import { getJSON } from '@/infrastructure/fetch-json'
import { useProjectContext } from '@/shared/context/project-context'
import { useTranslation } from 'react-i18next'
import { ReviewPanelOverviewFile } from './review-panel-overview-file'
import ReviewPanelEmptyState from './review-panel-empty-state'

export const ReviewPanelOverview: FC = () => {
  const { t } = useTranslation()
  const { _id: projectId } = useProjectContext()
  const { docs } = useFileTreeData()
  const [error, setError] = useState<Error>()
  const [projectRanges, setProjectRanges] = useState<Map<string, Ranges>>()
  const docRanges = useRangesContext()

  useEffect(() => {
    getJSON<{ id: string; ranges: Ranges }[]>(`/project/${projectId}/ranges`)
      .then(data =>
        setProjectRanges(
          new Map(
            data.map(item => [
              item.id,
              {
                docId: item.id,
                changes: item.ranges.changes ?? [],
                comments: item.ranges.comments ?? [],
                total: 0, // TODO
              },
            ])
          )
        )
      )
      .catch(error => setError(error))
  }, [projectId])

  const rangesForDocs = useMemo(() => {
    if (docs && docRanges && projectRanges) {
      const rangesForDocs = new Map<string, Ranges>()

      for (const doc of docs) {
        const ranges =
          doc.doc.id === docRanges.docId
            ? docRanges
            : projectRanges.get(doc.doc.id)

        if (ranges) {
          rangesForDocs.set(doc.doc.id, ranges)
        }
      }

      return rangesForDocs
    }
  }, [docRanges, docs, projectRanges])

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
                <>
                  <ReviewPanelOverviewFile
                    key={doc.doc.id}
                    doc={doc}
                    ranges={ranges}
                  />
                  <div className="review-panel-overfile-divider" />
                </>
              )
            )
          })}
        </div>
      )}
    </div>
  )
}
