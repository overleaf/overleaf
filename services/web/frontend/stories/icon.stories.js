import Icon from '../js/shared/components/icon'

export const Type = args => {
  return (
    <>
      <Icon {...args} />
      <div>
        <a
          href="https://fontawesome.com/v4.7.0/icons/"
          target="_blank"
          rel="noopener"
        >
          Font Awesome icons
        </a>
      </div>
    </>
  )
}
Type.args = {
  type: 'tasks',
}

export const Spinner = args => {
  return <Icon {...args} />
}
Spinner.args = {
  type: 'spinner',
  spin: true,
}

export const FixedWidth = args => {
  return <Icon {...args} />
}
FixedWidth.args = {
  type: 'tasks',
  modifier: 'fw',
}

export const AccessibilityLabel = args => {
  return <Icon {...args} />
}
AccessibilityLabel.args = {
  type: 'check',
  accessibilityLabel: 'Check',
}

export default {
  title: 'Icon',
  component: Icon,
}
