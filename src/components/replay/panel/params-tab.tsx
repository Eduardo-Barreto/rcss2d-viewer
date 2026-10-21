import { useDeferredValue, useId, useMemo, useState } from 'react'

import { Input } from '@/components/ui/input'
import { filterParams } from '@/player/panel-data'
import { useReplay } from '@/player/store'
import type { ParamMap } from '@/rcg/types'

function Table({ title, params, query }: { title: string; params: ParamMap; query: string }) {
  const rows = useMemo(() => filterParams(params, query), [params, query])
  if (rows.length === 0) return null
  return (
    <section className="flex flex-col gap-1" aria-label={title}>
      <h3 className="px-2 text-[12px] font-medium text-muted-foreground">
        {title} <span className="font-mono">{rows.length}</span>
      </h3>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 px-2 font-mono text-[12px]">
        {rows.map((row) => (
          <div className="contents" key={row.name}>
            <dt className="truncate py-0.5 text-muted-foreground">{row.name}</dt>
            <dd className="max-w-32 truncate py-0.5 text-right tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/** The server and player parameters written in the log, searchable by name. */
export function ParamsTab() {
  const match = useReplay((s) => s.match)
  const [query, setQuery] = useState('')
  const deferred = useDeferredValue(query)
  const id = useId()
  if (match === null) return null
  return (
    <div className="flex flex-col gap-4">
      <label className="sr-only" htmlFor={id}>
        Buscar parâmetro
      </label>
      <Input
        autoComplete="off"
        className="h-8 rounded-[8px] text-[13px]"
        id={id}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar parâmetro"
        spellCheck={false}
        type="search"
        value={query}
      />
      <Table params={match.serverParams} query={deferred} title="Servidor" />
      <Table params={match.playerParams} query={deferred} title="Jogadores" />
      {match.serverParams.size + match.playerParams.size === 0 ? (
        <p className="px-2 text-[13px] text-muted-foreground">Este log não traz parâmetros.</p>
      ) : null}
    </div>
  )
}
