import { PlayerComp } from '@/components/player'
import React from 'react'

const PlayerPage = () => {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 dark:bg-black font-mono">
        <PlayerComp/>
    </div>
  )
}

export default PlayerPage;