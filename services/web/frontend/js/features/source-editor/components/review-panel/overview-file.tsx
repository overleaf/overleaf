import { useMemo } from 'react'
import Icon from '../../../../shared/components/icon'
import {
  useReviewPanelUpdaterFnsContext,
  useReviewPanelValueContext,
} from '../../context/review-panel/review-panel-context'
import classnames from 'classnames'
import { ReviewPanelDocEntries } from '../../../../../../types/review-panel/review-panel'
import { MainDocument } from '../../../../../../types/project-settings'
import OverviewFileEntries from '@/features/source-editor/components/review-panel/entries/overview-file-entries'
import MaterialIcon from '@/shared/components/material-icon'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

type OverviewFileProps = {
  docId: MainDocument['doc']['id']
  docPath: MainDocument['path']
}

function OverviewFile({ docId, docPath }: OverviewFileProps) {
  const { entries, collapsed } = useReviewPanelValueContext()
  const { setCollapsed } = useReviewPanelUpdaterFnsContext()

  const docCollapsed = collapsed[docId]
  const docEntries = useMemo(() => {
    return docId in entries ? entries[docId] : ({} as ReviewPanelDocEntries)
  }, [docId, entries])
  const entryCount = useMemo(() => {
    return Object.keys(docEntries).filter(
      key => key !== 'add-comment' && key !== 'bulk-actions'
    ).length
  }, [docEntries])

  const handleToggleCollapsed = () => {
    setCollapsed({ ...collapsed, [docId]: !docCollapsed })
  }

  return (
    <div className="rp-overview-file">
      {entryCount > 0 && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div
          className="rp-overview-file-header"
          onClick={handleToggleCollapsed}
        >
          <span
            className={classnames('rp-overview-file-header-collapse', {
              'rp-overview-file-header-collapse-on': docCollapsed,
            })}
          >
            <BootstrapVersionSwitcher
              bs3={<Icon type="angle-down" />}
              bs5={<MaterialIcon type="expand_more" />}
            />
          </span>
          {docPath}
          {docCollapsed && (
            <>
              &nbsp;
              <span className="rp-overview-file-num-entries">
                ({entryCount})
              </span>
            </>
          )}
        </div>
      )}
      {!docCollapsed && (
        <OverviewFileEntries docId={docId} docEntries={docEntries} />
      )}
    </div>
  )
}

export default OverviewFile
