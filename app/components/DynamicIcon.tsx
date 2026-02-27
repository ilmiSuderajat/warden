"use client";

import dynamic from 'next/dynamic'
import { LucideProps, Package } from 'lucide-react'
import dynamicIconImports from 'lucide-react/dynamicIconImports'

interface IconProps extends LucideProps {
  name: string
}

const DynamicIcon = ({ name, ...props }: IconProps) => {
  // Gunakan Package sebagai fallback sementara saat loading
  const Icon = dynamic(
    (dynamicIconImports as any)[name] || (() => Promise.resolve(Package)),
    { 
      loading: () => <Package {...props} className="animate-pulse opacity-20" />,
      ssr: false 
    }
  )

  return <Icon {...props} />
}

export default DynamicIcon;