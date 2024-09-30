import OLToggleButton from '@/features/ui/components/ol/ol-toggle-button'
import OLToggleButtonGroup from '@/features/ui/components/ol/ol-toggle-button-group'

export const Base = () => {
  return (
    <OLToggleButtonGroup
      type="radio"
      name="figure-width"
      defaultValue="0.5"
      aria-label="Image width"
    >
      <OLToggleButton variant="secondary" id="width-25p" value="0.25">
        ¼ width
      </OLToggleButton>
      <OLToggleButton variant="secondary" id="width-50p" value="0.5">
        ½ width
      </OLToggleButton>
      <OLToggleButton variant="secondary" id="width-75p" value="0.75">
        ¾ width
      </OLToggleButton>
      <OLToggleButton variant="secondary" id="width-100p" value="1.0">
        Full width
      </OLToggleButton>
    </OLToggleButtonGroup>
  )
}

export const Disabled = () => {
  return (
    <OLToggleButtonGroup
      type="radio"
      name="figure-width"
      defaultValue="0.5"
      aria-label="Image width"
    >
      <OLToggleButton variant="secondary" id="width-25p" disabled value="0.25">
        ¼ width
      </OLToggleButton>
      <OLToggleButton variant="secondary" id="width-50p" disabled value="0.5">
        ½ width
      </OLToggleButton>
      <OLToggleButton variant="secondary" id="width-75p" disabled value="0.75">
        ¾ width
      </OLToggleButton>
      <OLToggleButton variant="secondary" id="width-100p" disabled value="1.0">
        Full width
      </OLToggleButton>
    </OLToggleButtonGroup>
  )
}

export default {
  title: 'Shared / Components / Toggle Button Group',
  component: OLToggleButtonGroup,
}
