import PropTypes from 'prop-types'
import useExpandCollapse from '../js/shared/hooks/use-expand-collapse'

function TestUI({ children, expandableProps, toggleProps }) {
  return (
    <>
      <div {...expandableProps}>{children}</div>
      <button {...toggleProps}>Expand/collapse</button>
    </>
  )
}

function VerticalTestUI(props) {
  return <TestUI {...props}>{verticalContents}</TestUI>
}

function HorizontalTestUI(props) {
  return <TestUI {...props}>{horizontalContents}</TestUI>
}

VerticalTestUI.propTypes = {
  expandableProps: PropTypes.object,
  toggleProps: PropTypes.object,
}

HorizontalTestUI.propTypes = VerticalTestUI.propTypes

TestUI.propTypes = {
  ...VerticalTestUI.propTypes,
  children: PropTypes.node,
}

export const Vertical = args => {
  const { expandableProps, toggleProps } = useExpandCollapse(args)
  return (
    <VerticalTestUI
      expandableProps={expandableProps}
      toggleProps={toggleProps}
    />
  )
}

export const VerticalInitiallyExpanded = args => {
  const { expandableProps, toggleProps } = useExpandCollapse(args)
  return (
    <VerticalTestUI
      expandableProps={expandableProps}
      toggleProps={toggleProps}
    />
  )
}
VerticalInitiallyExpanded.args = {
  initiallyExpanded: true,
}

export const VerticalWithMinSize = args => {
  const { expandableProps, toggleProps } = useExpandCollapse(args)
  return (
    <VerticalTestUI
      expandableProps={expandableProps}
      toggleProps={toggleProps}
    />
  )
}
VerticalWithMinSize.args = {
  collapsedSize: 200,
}

export const Horizontal = args => {
  const { expandableProps, toggleProps } = useExpandCollapse(args)
  return (
    <HorizontalTestUI
      expandableProps={expandableProps}
      toggleProps={toggleProps}
    />
  )
}
Horizontal.args = {
  dimension: 'width',
}

export const HorizontalInitiallyExpanded = args => {
  const { expandableProps, toggleProps } = useExpandCollapse(args)
  return (
    <HorizontalTestUI
      expandableProps={expandableProps}
      toggleProps={toggleProps}
    />
  )
}
HorizontalInitiallyExpanded.args = {
  initiallyExpanded: true,
}

export const HorizontalWithMinSize = args => {
  const { expandableProps, toggleProps } = useExpandCollapse(args)
  return (
    <HorizontalTestUI
      expandableProps={expandableProps}
      toggleProps={toggleProps}
    />
  )
}
HorizontalWithMinSize.args = {
  dimension: 'width',
  collapsedSize: 200,
}

const defaultContentStyles = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  fontSize: '2em',
  backgroundImage: 'linear-gradient(to bottom, red, blue)',
  width: '500px',
  height: '500px',
  color: '#FFF',
}

const verticalContents = <div style={defaultContentStyles}>Vertical</div>

const horizontalContents = (
  <div
    style={{
      ...defaultContentStyles,
      backgroundImage: 'linear-gradient(to right, red, blue)',
    }}
  >
    Horizontal
  </div>
)

export default {
  title: 'Shared / Hooks / useExpandCollapse',
}
