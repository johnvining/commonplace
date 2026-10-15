import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import * as db from './Database'
import * as constants from './constants'
import NoteList from './NoteList'
import PilesPillList from './PilesPillList'
import IdeasPillList from './IdeasPillList'
import { TopLevelTitleContainer, TopLevelTitle } from './TopLevelHeadings'

// Notes in every chosen pile and with every chosen idea (#279). The
// filter lives in the URL (/filter?piles=a,b&ideas=c), so it can be
// bookmarked; the pickers add and remove ids.
function Filter(props: any) {
  const [params, setParams] = useSearchParams()
  const ids = (key: string) => (params.get(key) ?? '').split(',').filter(Boolean)
  const pileIds = ids('piles')
  const ideaIds = ids('ideas')
  const [names, setNames] = useState<Record<string, string>>({})

  // Look up names for ids that came in through the URL.
  const idsKey = [...pileIds, ...ideaIds].join(',')
  useEffect(() => {
    const missing = [
      ...pileIds.filter((id) => !names[id]).map((id) => [db.types.pile, id]),
      ...ideaIds.filter((id) => !names[id]).map((id) => [db.types.idea, id]),
    ]
    if (!missing.length) return
    Promise.all(
      missing.map(([type, id]) =>
        db.getInfo(type, id).then((r: any) => [id, r.data.data?.name ?? '?']).catch(() => [id, '?'])
      )
    ).then((pairs) => setNames((n) => ({ ...n, ...Object.fromEntries(pairs) })))
  }, [idsKey])

  const update = (key: string, next: string[]) => {
    const p = new URLSearchParams(params)
    if (next.length) p.set(key, next.join(','))
    else p.delete(key)
    setParams(p)
  }
  const add = (key: string, current: string[]) => (item: any) => {
    if (!item?._id || current.includes(item._id)) return
    setNames((n) => ({ ...n, [item._id]: item.name }))
    update(key, [...current, item._id])
  }
  const remove = (key: string, current: string[]) => (id: string) =>
    update(key, current.filter((x) => x !== id))
  // A filter only uses existing piles and ideas, so typing a new name does
  // nothing rather than creating one.
  const ignoreNew = () => {}

  const pills = (list: string[]) => list.map((id) => ({ _id: id, name: names[id] ?? '…' }))

  props.setPageTitle('Filter notes')

  return (
    <div>
      <TopLevelTitleContainer>
        <TopLevelTitle>Notes in all of</TopLevelTitle>
      </TopLevelTitleContainer>
      <div className="filter-pickers">
        <label className="note-full form-label">Piles</label>
        <PilesPillList
          value={pills(pileIds)}
          onAddExisting={add('piles', pileIds)}
          onCreateNew={ignoreNew}
          onRemove={remove('piles', pileIds)}
          inputId="filter-pile"
          dontAutofocus
        />
        <label className="note-full form-label">Ideas</label>
        <IdeasPillList
          value={pills(ideaIds)}
          onAddExisting={add('ideas', ideaIds)}
          onCreateNew={ignoreNew}
          onRemove={remove('ideas', ideaIds)}
          inputId="filter-idea"
          dontAutofocus
        />
      </div>
      {pileIds.length || ideaIds.length ? (
        <NoteList
          key={'filter-' + idsKey}
          viewMode={props.viewMode}
          getListOfNotes={(_index: any, page: number) => db.getFilteredNotes(pileIds, ideaIds, page)}
          pageSize={constants.ENTITY_NOTES_PAGE_SIZE}
        />
      ) : (
        <div className="search-empty-state">
          Add piles and ideas to see the notes that have all of them.
        </div>
      )}
    </div>
  )
}

export default Filter
