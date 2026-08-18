import { cn } from '@/lib/utils'

type BrandLogoProps = {
  variant?: 'horizontal' | 'icon'
  className?: string
  imgClassName?: string
}

const logoSources = {
  horizontal: '/brand/botica-el-pueblo-horizontal.png',
  icon: '/brand/botica-el-pueblo-icon.png',
}

export function BrandLogo({
  variant = 'horizontal',
  className,
  imgClassName,
}: BrandLogoProps) {
  return (
    <div className={cn('shrink-0', className)}>
      <img
        alt="Botica El Pueblo"
        className={cn('block h-auto max-w-full', imgClassName)}
        src={logoSources[variant]}
      />
    </div>
  )
}
