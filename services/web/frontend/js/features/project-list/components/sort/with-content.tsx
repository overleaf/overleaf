import { useTranslation } from 'react-i18next'
import { Sort } from '../../../../../../types/project/dashboard/api'

type SortBtnOwnProps = {
  column: string
  sort: Sort
  text: string
  onClick: () => void
}

type WithContentProps = {
  iconType?: string
  screenReaderText: string
}

export type SortBtnProps = SortBtnOwnProps & WithContentProps

function withContent<T extends SortBtnOwnProps>(
  WrappedComponent: React.ComponentType<T & WithContentProps>
) {
  function WithContent(hocProps: T) {
    const { t } = useTranslation()
    const { column, text, sort } = hocProps
    let iconType

    let screenReaderText = t('sort_by_x', { x: text })

    if (column === sort.by) {
      iconType = sort.order === 'asc' ? 'caret-up' : 'caret-down'
      screenReaderText = t('reverse_x_sort_order', { x: text })
    }

    return (
      <WrappedComponent
        {...hocProps}
        iconType={iconType}
        screenReaderText={screenReaderText}
      />
    )
  }

  return WithContent
}

export default withContent
