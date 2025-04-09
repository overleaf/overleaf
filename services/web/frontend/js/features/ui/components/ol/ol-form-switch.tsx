import { FormCheck, FormCheckProps, FormLabel } from 'react-bootstrap-5'

type OLFormSwitchProps = FormCheckProps & {
  inputRef?: React.MutableRefObject<HTMLInputElement | null>
}

function OLFormSwitch(props: OLFormSwitchProps) {
  const { inputRef, label, id, ...rest } = props

  return (
    <>
      <FormCheck type="switch" ref={inputRef} id={id} {...rest} />
      <FormLabel htmlFor={id} visuallyHidden>
        {label}
      </FormLabel>
    </>
  )
}

export default OLFormSwitch
