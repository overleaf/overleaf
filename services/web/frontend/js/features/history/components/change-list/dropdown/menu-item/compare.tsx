import { useTranslation } from 'react-i18next'
import { MenuItem, MenuItemProps } from 'react-bootstrap'
import Icon from '../../../../../../shared/components/icon'
import { useHistoryContext } from '../../../../context/history-context'
import { computeUpdateRange } from '../../../../utils/range'
import { UpdateRange } from '../../../../services/types/update'

type CompareProps = {
  projectId: string
  updateMetaEndTimestamp: number
  closeDropdown: () => void
} & Pick<UpdateRange, 'fromV' | 'toV'>

function Compare({
  projectId,
  fromV,
  toV,
  updateMetaEndTimestamp,
  closeDropdown,
  ...props
}: CompareProps) {
  const { t } = useTranslation()
  const { setSelection } = useHistoryContext()

  const handleCompareVersion = (e: React.MouseEvent<MenuItemProps>) => {
    e.stopPropagation()
    closeDropdown()

    setSelection(prevSelection => {
      const { updateRange } = prevSelection

      if (updateRange) {
        const range = computeUpdateRange(
          updateRange,
          fromV,
          toV,
          updateMetaEndTimestamp
        )

        return {
          updateRange: range,
          comparing: true,
          files: [],
        }
      }

      return prevSelection
    })
  }

  return (
    <MenuItem onClick={handleCompareVersion} {...props}>
      <Icon type="exchange" fw /> {t('history_compare_with_this_version')}
    </MenuItem>
  )
}

export default Compare
