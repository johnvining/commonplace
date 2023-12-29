import { useNavigate } from 'react-router-dom'
import * as db from './Database'
import React from 'react'
import { useState } from 'react'
import autosize from 'autosize'
import TopLevelStandardButton from './TopLevelStandardButton'
import { TopLevelFormTextArea } from './TopLevelFormItems'

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
        <TopLevelFormTextArea
          name="Import CSV"
          id="import-text"
          defaultValue={pendingImportText}
          onChange={(e) => {
            setPendingImportText(e.target.value)
            autosize(document.querySelector('#import-text'))
          }}
        />
        <TopLevelStandardButton name="Submit" onClick={handleImport} />
        <span>
          {notesImported > -1 ? notesImported + ' notes imported' : null}
        </span>
      </div>
    </div>
  )
}

export default Load
