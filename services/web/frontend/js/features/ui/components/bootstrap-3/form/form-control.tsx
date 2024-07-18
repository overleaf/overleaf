import {
  FormControl as BS3FormControl,
  FormControlProps as BS3FormControlProps,
} from 'react-bootstrap'

type FormControlProps = BS3FormControlProps & {
  prepend?: React.ReactNode
  append?: React.ReactNode
}

function FormControl({ prepend, append, ...props }: FormControlProps) {
  return (
    <>
      {prepend && <div className="form-control-feedback-left">{prepend}</div>}
      <BS3FormControl {...props} />
      {append && <div className="form-control-feedback">{append}</div>}
    </>
  )
}

export default FormControl
