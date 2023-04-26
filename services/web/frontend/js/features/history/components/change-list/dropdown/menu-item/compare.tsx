import { useTranslation } from 'react-i18next'
import { MenuItem, MenuItemProps } from 'react-bootstrap'
import Icon from '../../../../../../shared/components/icon'
import { useHistoryContext } from '../../../../context/history-context'
import { UpdateRange } from '../../../../services/types/update'

type CompareProps = {
  projectId: string
  updateMetaEndTimestamp: number
} & Pick<UpdateRange, 'fromV' | 'toV'>

function Compare({
  projectId,
  fromV,
  toV,
  updateMetaEndTimestamp,
  ...props
}: CompareProps) {
  const { t } = useTranslation()
  const { selection, setSelection } = useHistoryContext()

  function compare() {
    const { updateRange } = selection
    if (!updateRange) {
      return
    }
    const fromVersion = Math.min(fromV, updateRange.fromV)
    const toVersion = Math.max(toV, updateRange.toV)
    const fromVTimestamp = Math.min(
      updateMetaEndTimestamp,
      updateRange.fromVTimestamp
    )
    const toVTimestamp = Math.max(
      updateMetaEndTimestamp,
      updateRange.toVTimestamp
    )

    setSelection({
      updateRange: {
        fromV: fromVersion,
        toV: toVersion,
        fromVTimestamp,
        toVTimestamp,
      },
      comparing: true,
      files: [],
      pathname: null,
    })
  }

  const handleCompareVersion = (e: React.MouseEvent<MenuItemProps>) => {
    e.stopPropagation()
    compare()
  }

  return (
    <MenuItem onClick={handleCompareVersion} {...props}>
      <Icon type="exchange" fw /> {t('history_compare_with_this_version')}
    </MenuItem>
  )
}

export default Compare
