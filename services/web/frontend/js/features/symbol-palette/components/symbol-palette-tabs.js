import { TabList, Tab } from '@reach/tabs'
import PropTypes from 'prop-types'

export default function SymbolPaletteTabs({ categories }) {
  return (
    <TabList aria-label="Symbol Categories" className="symbol-palette-tab-list">
      {categories.map(category => (
        <Tab key={category.id} className="symbol-palette-tab">
          {category.label}
        </Tab>
      ))}
    </TabList>
  )
}
SymbolPaletteTabs.propTypes = {
  categories: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    })
  ).isRequired,
}
