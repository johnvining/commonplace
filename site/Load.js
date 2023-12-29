import { useNavigate } from 'react-router-dom'
import * as db from './Database'
import React from 'react'
import { useState } from 'react'
import autosize from 'autosize'
import TopLevelStandardButton from './TopLevelStandardButton'

function Load(props) {
  const [pendingImportText, setPendingImportText] = useState('')
  const [notesImported, setNotesImported] = useState(-1)
  const navigate = useNavigate()

  const handleImport = async () => {
    let importText = pendingImportText
    setPendingImportText('')
    let imported = await db.importNotesCsv(importText)
    setNotesImported(imported.data.data)
    // TODO: Error handling on bad CSV
    // TODO: Validate CSV then load all records, rather than erroring midway through
  }

  props.setPageTitle('Import Notes')

  return (
    <div className="full-width">
      <div name="text" className="width-100">
        <pre>
          author,title,text,workName,url,ideas,externalImageUrls,piles,year,page,take
        </pre>
      </div>
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
      <TopLevelStandardButton name="Import" onClick={handleImport} />
      <span>
        {notesImported > -1 ? notesImported + ' notes imported' : null}
      </span>
    </div>
  )
}

export default Load
