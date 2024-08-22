import { isBootstrap5 } from '@/features/utils/bootstrap-5'

type BootstrapVersionSwitcherProps = {
  bs3?: React.ReactNode
  bs5?: React.ReactNode
}

function BootstrapVersionSwitcher({
  bs3,
  bs5,
}: BootstrapVersionSwitcherProps): React.ReactElement {
  return <>{isBootstrap5() ? bs5 : bs3}</>
}

export default BootstrapVersionSwitcher
