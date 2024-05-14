import FormText, {
  getFormTextColor,
} from '@/features/ui/components/bootstrap-5/form/form-text'
import PolymorphicComponent from '@/shared/components/polymorphic-component'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import classnames from 'classnames'

type FormTextWrapperProps = React.ComponentProps<typeof FormText> & {
  bs3Props?: Record<string, unknown>
}

function FormTextWrapper(props: FormTextWrapperProps) {
  const { bs3Props, ...rest } = props

  const bs3HelpBlockProps = {
    children: rest.children,
    className: classnames(
      'small',
      rest.className,
      getFormTextColor({
        isError: rest.isError,
        isSuccess: rest.isSuccess,
        isWarning: rest.isWarning,
      })
    ),
    as: 'span',
    ...bs3Props,
  } as const satisfies React.ComponentProps<typeof PolymorphicComponent>

  return (
    <BootstrapVersionSwitcher
      bs3={<PolymorphicComponent {...bs3HelpBlockProps} />}
      bs5={<FormText {...rest} />}
    />
  )
}

export default FormTextWrapper
