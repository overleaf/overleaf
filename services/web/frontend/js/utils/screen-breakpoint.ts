type BreakpointName = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'

type Breakpoint = {
  name: BreakpointName
  minWidth: number
}

/**
 * Maps window width to Bootstrap 5 breakpoint names
 * Breakpoints based on Bootstrap 5 documentation:
 * xs: 0-575px
 * sm: 576-767px
 * md: 768-991px
 * lg: 992-1199px
 * xl: 1200-1399px
 * xxl: ≥1400px
 * @param {number} width - Window width in pixels
 * @returns {BreakpointName} Bootstrap breakpoint name
 */
export function getBootstrap5Breakpoint(
  width: number
): BreakpointName | undefined {
  const breakpoints: Breakpoint[] = [
    { name: 'xxl', minWidth: 1400 },
    { name: 'xl', minWidth: 1200 },
    { name: 'lg', minWidth: 992 },
    { name: 'md', minWidth: 768 },
    { name: 'sm', minWidth: 576 },
    { name: 'xs', minWidth: 0 },
  ]

  const breakpoint = breakpoints.find(bp => width >= bp.minWidth)
  return breakpoint?.name
}
