import FormText, {
  FormTextProps,
  getFormTextClass,
} from '@/features/ui/components/bootstrap-5/form/form-text'
import PolymorphicComponent from '@/shared/components/polymorphic-component'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import classnames from 'classnames'

type OLFormTextProps = FormTextProps & {
  bs3Props?: Record<string, unknown>
}

function OLFormText(props: OLFormTextProps) {
  const { bs3Props, ...rest } = props

  const bs3HelpBlockProps = {
    children: rest.children,
    className: classnames('small', rest.className, getFormTextClass(rest.type)),
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

export default OLFormText
