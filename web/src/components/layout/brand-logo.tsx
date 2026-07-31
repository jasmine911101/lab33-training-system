import Image from 'next/image'

export function BrandLogo({ className = '', priority = false }: { className?: string; priority?: boolean }) {
  return <Image src="/lab33-logo.png" alt="LAB33 Sport Performance" width={1294} height={757} priority={priority} className={`h-auto w-36 ${className}`} />
}
