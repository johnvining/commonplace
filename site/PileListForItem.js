import React from 'react'
import Autocomplete from './Autocomplete'
import { useNavigate } from 'react-router-dom'
import * as db from './Database'

function PileListForItem(props) {
  const navigate = useNavigate()
  return (
    <>
      {props.piles?.map((pile) => {
        let pileName = pile.name
        let parts = pileName.split(':')
        let pre = ''
        if (parts.length > 1) {
          pileName = parts[1]
          pre = parts[0]
        }
        return (
          <button
            key={'/pile/' + pile._id}
            className={props.remove ? 'pile label remove' : 'pile label'}
            onClick={() => {
              if (props.remove) {
                props.onPileRemove(pile._id)
              } else {
                navigate('/pile/' + pile._id)
              }
            }}
          >
            <>
              {pre ? <span className="pile pre">{pre}</span> : null}
              {pileName}
            </>
          </button>
        )
      })}
      {props.edit ? (
        <Autocomplete
          className={props.mainClassName + ' pile-select'}
          clearOnSelect={true}
          defaultValue=""
          dontAutofocus={false}
          escape={props.escape}
          getSuggestions={props.getSuggestions}
          apiType={db.types.pile}
          handleNewSelect={props.handleNewSelect.bind(this)}
          inputName="work-pile"
          onSelect={props.onSelect.bind(this)}
          excludeIds={props.piles?.map((pile) => pile._id)}
        />
      ) : (
        ''
      )}
    </>
  )
}

export default PileListForItem
