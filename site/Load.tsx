import { useNavigate } from 'react-router-dom'
import * as db from './Database'
import React from 'react'
import { useState } from 'react'
import autosize from 'autosize'
import {
  TopLevelStandardButtonContainer,
  TopLevelStandardButton,
} from './TopLevelStandardButton'
import { TopLevelFormTextArea } from './TopLevelFormItems'

function Load(props: any) {
  const [pendingImportText, setPendingImportText] = useState('')
  const [notesImported, setNotesImported] = useState(-1)
  const [importFormat, setImportFormat] = useState('csv')
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<any>(null)
  const [importError, setImportError] = useState<any>(null)
  const cancelRef = React.useRef(false)
  const navigate = useNavigate()

  const parseUrlLine = (line: any) => {
    const trimmed = line.trim()
    if (!trimmed) return null
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed
    }
    return 'https://' + trimmed
  }

  const importUrlsAsNotes = async () => {
    const lines = pendingImportText
      .split(/\r?\n/)
      .map((line: any) => line.trim())
      .filter(Boolean)
    setPendingImportText('')
    let importedCount = 0
    const reviewPileName = 'Status: URL to Review'
    let reviewPileId = null

    try {
      const suggestions = await db.getSuggestions(db.types.pile, reviewPileName)
      const options = suggestions?.data?.data || []
      const exactMatch = options.find(
        (item: any) =>
          item?.name?.toLowerCase() === reviewPileName.toLowerCase()
      )
      reviewPileId = exactMatch?._id || exactMatch?.id || null
    } catch (error: any) {
      reviewPileId = null
    }

    if (!reviewPileId) {
      try {
        const created = await db.createRecord(db.types.pile, reviewPileName)
        reviewPileId = created?.data?.data?._id || null
      } catch (error: any) {
        console.error('Error creating review pile', error)
      }
    }

    for (const line of lines) {
      if (cancelRef.current) break
      setImportProgress({ done: importedCount, total: lines.length })
      const url = parseUrlLine(line) || line
      const title = url
      const noteResponse = await db.createNewNoteFromTitle(title)
      const noteId = noteResponse?.data?._id
      if (!noteId) {
        console.error('Create note response missing id', noteResponse)
        continue
      }
      const update: any = { url }
      update.title = url
      await db.updateRecord(db.types.note, noteId, update)
      if (reviewPileId) {
        await db.addLinkToRecord(
          db.types.pile,
          reviewPileId,
          db.types.note,
          noteId
        )
      }
      importedCount += 1
    }

    setNotesImported(importedCount)
    setImportProgress(null)
  }

  const handleImport = async () => {
    cancelRef.current = false
    setImporting(true)
    setNotesImported(-1)
    setImportError(null)
    let importText = pendingImportText
    setPendingImportText('')
    try {
      if (importFormat === 'csv') {
        let imported = await db.importNotesCsv(importText)
        setNotesImported(imported.data.data)
        // TODO: Error handling on bad CSV
        // TODO: Validate CSV then load all records, rather than erroring midway through
      } else if (importFormat === 'instapaper') {
        let imported = await db.importNotesInstapaper(importText)
        setNotesImported(imported.data.data)
      } else {
        await importUrlsAsNotes()
      }
    } catch (e: any) {
      const status = e?.response?.status
      if (status === 413) {
        setImportError('The import text is too large. Try splitting it into smaller batches.')
      } else {
        setImportError('Import failed. Check that the format matches the selected import type.')
      }
    } finally {
      setImporting(false)
    }
  }

  const handleCancel = () => {
    cancelRef.current = true
  }

  props.setPageTitle('Import Notes')

  return (
    <div className="full-width">
      <div data-name="text" className="width-100">
        {importFormat === 'csv' ? (
          <pre>
            author,title,text,workName,url,ideas,externalImageUrls,piles,year,page,take
          </pre>
        ) : importFormat === 'instapaper' ? (
          <pre>
            Paste TSV from the IFTTT Instapaper Google Sheet. Columns: Article, Text, Note Url, Image Url, Title.{'\n'}
            To export: select all rows in Google Sheets and copy (Cmd+C), then paste here. Or use File → Download → Tab Separated Values (.tsv) and paste the file contents.
          </pre>
        ) : (
          <pre>
            One URL per line. Each URL creates a note with Title and URL set,
            and adds the pile "Status: URL to Review".
          </pre>
        )}
      </div>
      <div data-name="import-format" className="width-100">
        <label className="note-full form-label">
          <input
            type="radio"
            name="import-format"
            value="csv"
            checked={importFormat === 'csv'}
            onChange={() => setImportFormat('csv')}
          />
          Kindlescrape Import (CSV)
        </label>
        <label className="note-full form-label">
          <input
            type="radio"
            name="import-format"
            value="instapaper"
            checked={importFormat === 'instapaper'}
            onChange={() => setImportFormat('instapaper')}
          />
          Instapaper (IFTTT Google Sheet TSV)
        </label>
        <label className="note-full form-label">
          <input
            type="radio"
            name="import-format"
            value="urls"
            checked={importFormat === 'urls'}
            onChange={() => setImportFormat('urls')}
          />
          URL List (one per line)
        </label>
      </div>
      <div data-name="text" className="width-100">
        <TopLevelFormTextArea
          name={importFormat === 'csv' ? 'Import CSV' : importFormat === 'instapaper' ? 'Import Instapaper TSV' : 'Import URLs'}
          id="import-text"
          defaultValue={pendingImportText}
          onChange={(e: any) => {
            setPendingImportText(e.target.value)
            autosize(document.querySelector('#import-text') as HTMLElement)
          }}
        />
        <TopLevelStandardButtonContainer>
          <TopLevelStandardButton name="Submit" onClick={handleImport} disabled={importing} />
          {importing && (
            <TopLevelStandardButton name="Cancel" onClick={handleCancel} />
          )}
        </TopLevelStandardButtonContainer>
        <span>
          {importing && importProgress
            ? `Importing… ${importProgress.done} / ${importProgress.total}`
            : importError
            ? importError
            : notesImported > -1
            ? notesImported + ' notes imported'
            : null}
        </span>
      </div>
    </div>
  )
}

export default Load
