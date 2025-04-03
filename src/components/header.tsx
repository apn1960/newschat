import * as React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { IconSeparator } from '@/components/ui/icons'
import EnvCard from './cards/envcard'

export function Header() {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between w-full h-16 px-4 border-b shrink-0 bg-white">
      <EnvCard />
      <div className="flex items-center gap-4">
        <Link href="/">
          <span className="font-bold">Next.js AI Lite</span>
        </Link>
        <IconSeparator />
        <Link href="/genui">
          <span className="font-normal">GenUI</span>
        </Link>
        <Link href="/test">
          <span className="font-normal">Test</span>
        </Link>
      </div>
    </header>
  )
}
