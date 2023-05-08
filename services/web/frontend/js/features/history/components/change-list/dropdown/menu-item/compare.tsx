import { useTranslation } from 'react-i18next'
import { MenuItem, MenuItemProps } from 'react-bootstrap'
import Icon from '../../../../../../shared/components/icon'
import { useHistoryContext } from '../../../../context/history-context'
import { computeUpdateRange } from '../../../../utils/range'
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

  const handleCompareVersion = (e: React.MouseEvent<MenuItemProps>) => {
    e.stopPropagation()

    const { updateRange } = selection
    if (updateRange) {
      const range = computeUpdateRange(
        updateRange,
        fromV,
        toV,
        updateMetaEndTimestamp
      )

      setSelection({
        updateRange: range,
        comparing: true,
        files: [],
      })
    }
  }

  return (
    <MenuItem onClick={handleCompareVersion} {...props}>
      <Icon type="exchange" fw /> {t('history_compare_with_this_version')}
    </MenuItem>
  )
}

export default Compare
