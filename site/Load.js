import { useNavigate } from 'react-router-dom'
import * as db from './Database'
import React from 'react'
import { useState } from 'react'
import autosize from 'autosize'

function Load(props) {
  const [pendingImportText, setPendingImportText] = useState('')
  const navigate = useNavigate()

  const handleImport = async () => {
    let importText = pendingImportText
    setPendingImportText('')
    // db.importNotesForWork(importText, id).then(() => {
    //   fetchWorkInfo(id)
    //   setImportMode(false)
    // })
  }

  props.setPageTitle('Import Notes')

  return (
    <div className="full-width">
      <div name="text" className="width-100">
        <textarea
          id="importText"
          className={'work-page importText input'}
          value={pendingImportText}
          onChange={(e) => {
            setPendingImportText(e.target.value)
            autosize(document.querySelector('#importText'))
          }}
        ></textarea>
      </div>
      <button
        className="top-level standard-button left-right"
        onClick={handleImport}
      >
        Import
      </button>
    </div>
  )
}

export default Load
