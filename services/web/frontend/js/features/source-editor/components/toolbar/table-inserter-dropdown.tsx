import { FC, useState } from 'react'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'

export const TableInserterDropdown = ({
  onSizeSelected,
}: {
  onSizeSelected: (sizeX: number, sizeY: number) => void
}) => {
  return (
    <div className="ol-cm-toolbar-table-grid-popover">
      <SizeGrid sizeX={10} sizeY={10} onSizeSelected={onSizeSelected} />
    </div>
  )
}
TableInserterDropdown.displayName = 'TableInserterDropdown'

const range = (start: number, end: number) =>
  Array.from({ length: end - start + 1 }, (v, k) => k + start)

const SizeGrid: FC<{
  sizeX: number
  sizeY: number
  onSizeSelected: (sizeX: number, sizeY: number) => void
}> = ({ sizeX, sizeY, onSizeSelected }) => {
  const [currentSize, setCurrentSize] = useState<{
    sizeX: number
    sizeY: number
  }>({ sizeX: 0, sizeY: 0 })
  const { t } = useTranslation()
  let label = t('toolbar_table_insert_table_lowercase')
  if (currentSize.sizeX > 0 && currentSize.sizeY > 0) {
    label = t('toolbar_table_insert_size_table', {
      size: `${currentSize.sizeY}×${currentSize.sizeX}`,
    })
  }
  return (
    <>
      <div className="ol-cm-toolbar-table-size-label">{label}</div>
      <table
        className="ol-cm-toolbar-table-grid"
        onMouseLeave={() => {
          setCurrentSize({ sizeX: 0, sizeY: 0 })
        }}
      >
        <tbody>
          {range(1, sizeY).map(y => (
            <tr key={y}>
              {range(1, sizeX).map(x => (
                // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
                <td
                  className={classNames('ol-cm-toolbar-table-cell', {
                    active: currentSize.sizeX >= x && currentSize.sizeY >= y,
                  })}
                  key={x}
                  onMouseEnter={() => {
                    setCurrentSize({ sizeX: x, sizeY: y })
                  }}
                  onMouseUp={() => onSizeSelected(x, y)}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
