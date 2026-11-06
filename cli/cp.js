#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { homedir } from 'os'
import { basename, join } from 'path'
import { createInterface } from 'readline'
import { exec } from 'child_process'

const CONFIG_PATH = join(homedir(), '.commonplace.json')
const DEV_URL  = 'http://localhost:3000/api/'
const PROD_URL = 'http://10.0.1.8:3000/api/'
const DEFAULT_URL = process.env.NODE_ENV === 'development' ? DEV_URL : PROD_URL

// ── Config ────────────────────────────────────────────────────────────────────

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) return { token: null }
  try { return JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) } catch { return { token: null } }
}

function saveConfig(config) {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
}

// ── HTTP ──────────────────────────────────────────────────────────────────────

async function api(method, path, body, config) {
  const url = (config.url || DEFAULT_URL) + path
  const headers = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  }
  if (config.token) headers['Cookie'] = `jwt=${config.token}`
  const opts = { method, headers }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(url, opts)
  if (res.status === 401) throw new Error('Not authenticated — run: cplace login')
  if (!res.ok) {
    // The server explains refusals as { message }; show that, not raw JSON.
    const errText = await res.text().catch(() => '')
    let message = errText
    try { message = JSON.parse(errText).message || errText } catch {}
    throw Object.assign(new Error(`HTTP ${res.status}${message ? ': ' + message : ''}`), { status: res.status })
  }
  // Capture Set-Cookie on login
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) {
    const match = setCookie.match(/jwt=([^;]+)/)
    if (match) config._newToken = match[1]
  }
  const text = await res.text()
  if (!text) return null
  return JSON.parse(text)
}

// Upload one image file to a note (multipart, field "image"). The server
// reads it into the note's text when the text is blank (OCR on upload).
const IMAGE_TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', tif: 'image/tiff', tiff: 'image/tiff' }

async function uploadImage(noteId, filePath, config) {
  const name = basename(filePath)
  const ext = name.split('.').pop().toLowerCase()
  const form = new FormData()
  form.append('image', new Blob([readFileSync(filePath)], { type: IMAGE_TYPES[ext] || 'application/octet-stream' }), name)
  const headers = { 'X-Requested-With': 'XMLHttpRequest' }
  if (config.token) headers['Cookie'] = `jwt=${config.token}`
  const res = await fetch((config.url || DEFAULT_URL) + `note/${noteId}/image`, { method: 'PUT', headers, body: form })
  if (res.status === 401) throw new Error('Not authenticated — run: cplace login')
  const text = await res.text()
  let body = null
  try { body = JSON.parse(text) } catch {}
  if (!res.ok) throw new Error(`HTTP ${res.status}${body?.message ? ': ' + body.message : ''}`)
  if (body?.status === false) throw new Error(body.message || 'Upload failed')
  return body?.data?.newNote
}

// Entity note lists come back 500 per request; fetch every page so big
// piles and works aren't cut off.
async function fetchAllNotes(path, config) {
  const PAGE = 500
  const all = []
  for (let skip = 0; ; skip += PAGE) {
    const res = await api('GET', `${path}?skip=${skip}&limit=${PAGE}`, null, config)
    const page = res?.data || []
    all.push(...page)
    if (page.length < PAGE) return all
  }
}

// ── Formatting ────────────────────────────────────────────────────────────────

const RESET = '\x1b[0m'
const BOLD  = '\x1b[1m'
const DIM   = '\x1b[2m'
const CYAN  = '\x1b[36m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const BLUE  = '\x1b[34m'
const MAGENTA = '\x1b[35m'

function typeColor(type) {
  return { note: CYAN, auth: GREEN, work: YELLOW, idea: BLUE, pile: MAGENTA }[type] || RESET
}

function typeLabel(type) {
  return { note: 'note', auth: 'author', work: 'work', idea: 'idea', pile: 'pile' }[type] || type
}

function joinAuthorNames(authors) {
  // Mirrors site/authorsDisplay.ts so the CLI renders multi-author notes
  // the same way the web UI does.
  const names = (authors || [])
    .map(a => a && typeof a === 'object' ? a.name : null)
    .filter(n => typeof n === 'string' && n.length > 0)
  if (!names.length) return ''
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} & ${names[1]}`
  return names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1]
}

function formatNote(note, { full = false } = {}) {
  const title = note.title || '(untitled)'
  const noteAuthors = joinAuthorNames(note.authors)
  const workAuthors = joinAuthorNames(note.work?.authors)
  const author = noteAuthors || workAuthors
    ? `${DIM}${noteAuthors || workAuthors}${RESET}`
    : ''
  const work = note.work?.name ? `${DIM}${note.work.name}${RESET}` : ''
  const ideas = note.ideas?.length ? `${DIM}[${note.ideas.map(i => i.name).join(', ')}]${RESET}` : ''
  const nick = note.nick ? `${DIM}:${note.nick}${RESET}` : ''
  const meta = [author, work, ideas, nick].filter(Boolean).join('  ')

  let out = `${BOLD}${CYAN}${title}${RESET}`
  if (meta) out += `\n  ${meta}`
  if (full && note.text) {
    out += `\n\n${note.text.trim().split('\n').map(l => '  ' + l).join('\n')}`
  }
  out += `\n  ${DIM}${note._id}${RESET}`
  return out
}

function formatEntity(type, item) {
  const color = typeColor(type)
  const label = typeLabel(type)
  let name = item.name || '(unnamed)'
  let meta = ''
  if (type === 'work') {
    const authorStr = joinAuthorNames(item.authors)
    if (authorStr) meta = ` ${DIM}— ${authorStr}${RESET}`
    // Populated only where the server sends them (a work's own page)
    const editors = item.editors?.[0]?.name ? joinAuthorNames(item.editors) : ''
    const translators = item.translators?.[0]?.name ? joinAuthorNames(item.translators) : ''
    if (editors) meta += ` ${DIM}ed. ${editors}${RESET}`
    if (translators) meta += ` ${DIM}tr. ${translators}${RESET}`
    if (item.year) meta += ` ${DIM}(${item.year < 0 ? `${-item.year} BC` : item.year})${RESET}`
  }
  return `${BOLD}${color}[${label}]${RESET} ${name}${nickSuffix(item.nick)}${meta}\n  ${DIM}${item._id}${RESET}`
}

// Map a nick (e.g. "p12345", "n42") to {type, id} by hitting /nick/:nick.
// Returns null if the nick can't be resolved. The old nick of a merged
// work resolves to the work it was merged into; the result then carries
// `merged` (the old name, or '') so destructive commands can refuse it
// (#366).
async function resolveByNick(nick, config) {
  try {
    const res = await api('GET', `nick/${nick}`, null, config)
    const data = res?.data
    if (!data) return null
    const merged = 'mergedFrom' in data ? { merged: data.mergedFrom ?? '' } : {}
    if (merged.merged !== undefined) {
      console.error(`${DIM}note: ${nick} was ${merged.merged ? `"${merged.merged}", ` : ''}merged into another work; using the kept work${RESET}`)
    }
    if (data.note) return { type: 'note', id: data.note, ...merged }
    if (data.work) return { type: 'work', id: data.work, ...merged }
    if (data.idea) return { type: 'idea', id: data.idea, ...merged }
    if (data.pile) return { type: 'pile', id: data.pile, ...merged }
  } catch {}
  return null
}

// Deleting or merging through an old nick would act on the kept work,
// not the one the nick was made for
function refuseMergedNick(target, input, action) {
  if (target?.merged === undefined) return false
  console.error(`${input} is the old nick of a work that was merged away. Refusing to ${action} the kept work through it;`)
  console.error('use the kept work\'s own nick or ObjectId if that is what you mean.')
  return true
}

// Resolve <input> to {type, id}. Accepts three forms:
//
//   1. Nick pattern (n12345 / w12345 / p12345 / i12345) — looks up the nick.
//   2. Raw ObjectId (24-char hex) — requires a hintedType OR probes each
//      resource's GET endpoint until one returns a doc.
//   3. Freeform name — autocomplete by hintedType (or try pile / work /
//      idea / auth in priority order) and accept only an exact name match.
//
// Returns null if nothing resolves unambiguously.
async function resolveTarget(input, hintedType, config) {
  if (!input) return null

  if (/^[nwip]\d+$/i.test(input)) {
    const resolved = await resolveByNick(input, config)
    if (resolved) return resolved
    return null
  }

  if (/^[0-9a-f]{24}$/i.test(input)) {
    if (hintedType) return { type: hintedType, id: input }
    for (const t of ['note', 'work', 'idea', 'pile', 'auth']) {
      try {
        const res = await api('GET', `${t}/${input}`, null, config)
        if (res?.data?._id || res?.data?.[0]?._id) return { type: t, id: input }
      } catch {}
    }
    return null
  }

  // Name: try the hinted type, else search all "named" types in priority.
  // Note titles aren't autocomplete-indexed the same way, so notes are
  // excluded from the auto-probe (use the nick or ObjectId for those).
  const types = hintedType ? [hintedType] : ['pile', 'work', 'idea', 'auth']
  for (const t of types) {
    try {
      const ac = await api('POST', `${t}/autocomplete`, { string: input }, config)
      const items = ac?.data || []
      const exact = items.find(i => (i.name || '') === input)
      if (exact) return { type: t, id: exact._id }
    } catch {}
  }
  return null
}

// Simple y/N prompt for destructive ops. Returns true if user confirmed.
function confirm(prompt) {
  return new Promise(resolve => {
    process.stdout.write(prompt)
    process.stdin.setEncoding('utf8')
    process.stdin.resume()
    process.stdin.once('data', ch => {
      process.stdin.pause()
      const answer = String(ch).trim().toLowerCase()
      resolve(answer === 'y' || answer === 'yes')
    })
  })
}

function formatResult(entry) {
  if (entry.type === 'note') return formatNote(entry.item)
  return formatEntity(entry.type, entry.item)
}

async function fetchNick(type, id, config) {
  const map = { note: 'note', auth: null, work: 'work', idea: 'idea', pile: 'pile' }
  const nickType = map[type]
  if (!nickType) return null
  try {
    const res = await api('GET', `nick/${nickType}/${id}`, null, config)
    return res?.data?.key || null
  } catch { return null }
}

async function ensureNick(type, id, config) {
  const map = { note: 'note', auth: null, work: 'work', idea: 'idea', pile: 'pile' }
  const nickType = map[type]
  if (!nickType) return null
  try {
    const res = await api('PUT', `nick/${nickType}/${id}`, null, config)
    return res?.data?.key || null
  } catch { return null }
}

// Sets each item's nick, creating any that are missing, so list output
// can show it inline like search does (#346).
async function withNicks(type, items, config) {
  await Promise.all(items.map(async (item) => {
    if (!item.nick) item.nick = await ensureNick(type, item._id, config)
  }))
  return items
}

function nickSuffix(nick) {
  return nick ? ` ${DIM}(${nick})${RESET}` : ''
}

function urlFor(type, id) {
  const base = 'http://localhost:1234'
  const paths = { note: 'note', auth: 'auth', work: 'work', idea: 'idea', pile: 'pile' }
  return `${base}/${paths[type] || type}/${id}`
}

// ── Commands ──────────────────────────────────────────────────────────────────

async function cmdLogin(args, config) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const password = await new Promise(resolve => {
    process.stdout.write('Password: ')
    process.stdin.setRawMode?.(true)
    let pw = ''
    process.stdin.resume()
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', function handler(ch) {
      if (ch === '\r' || ch === '\n') {
        process.stdin.setRawMode?.(false)
        process.stdin.removeListener('data', handler)
        process.stdout.write('\n')
        resolve(pw)
      } else if (ch === '') {
        process.exit()
      } else {
        pw += ch
      }
    })
  })
  rl.close()

  const res = await api('POST', 'user/auth', { username: 'commonplace', password }, config)
  if (config._newToken) {
    config.token = config._newToken
    delete config._newToken
    saveConfig(config)
    console.log(`${GREEN}Logged in.${RESET}`)
  } else {
    console.error('Login failed — no token received')
  }
}

async function cmdSearch(args, config) {
  const jsonFlag = args.includes('--json')
  const query = args.filter(a => a !== '--json').join(' ')
  if (!query) { console.error('Usage: cplace search|find <query> [--json]'); return }

  if (!jsonFlag) process.stdout.write(`Searching for "${query}"...\r`)
  const res = await api('POST', 'note/unified-search', { query, limit: 20 }, config)
  const results = res?.data || []
  if (!jsonFlag) process.stdout.write('\x1b[2K\r')

  if (jsonFlag) {
    console.log(JSON.stringify(results.map(e => ({
      type: e.type,
      id: e.item._id,
      name: e.item.title || e.item.name,
      score: e.score,
    }))))
    return
  }

  if (!results.length) { console.log('No results.'); return }
  await Promise.all(results.map(async (entry) => {
    if (!entry.item.nick) {
      entry.item.nick = await ensureNick(entry.type, entry.item._id, config)
    }
  }))
  results.forEach((entry, i) => {
    console.log(`\n${DIM}${i + 1}.${RESET}`)
    console.log(formatResult(entry))
  })
}

async function cmdNote(args, config) {
  const jsonFlag = args.includes('--json')
  const positional = args.filter(a => a !== '--json')
  let id = positional[0]
  if (!id) { console.error('Usage: cplace note <id|nick> [--json]'); return }
  let resolvedNick = null
  if (/^[nwip]\d+$/.test(id)) {
    resolvedNick = id
    const nickRes = await api('GET', `nick/${id}`, null, config)
    const noteId = nickRes?.data?.note
    if (!noteId) {
      if (jsonFlag) console.log('null')
      else console.log('Nick not found.')
      return
    }
    id = noteId
  }
  const [res, nickRes] = await Promise.all([
    api('GET', `note/${id}`, null, config),
    resolvedNick ? Promise.resolve(null) : ensureNick('note', id, config),
  ])
  // GET note/:id returns the note in a one-item list.
  const note = Array.isArray(res?.data) ? res.data[0] : res?.data
  if (!note) {
    if (jsonFlag) console.log('null')
    else console.log('Not found.')
    return
  }
  note.nick = resolvedNick || nickRes
  if (jsonFlag) { console.log(JSON.stringify(note)); return }
  console.log('\n' + formatNote(note, { full: true }))
}

async function cmdRecent(args, config) {
  const jsonFlag = args.includes('--json')
  const positional = args.filter(a => a !== '--json')
  const page = parseInt(positional[0]) || 1
  const res = await api('GET', `note/all/${page}`, null, config)
  const notes = res?.data || []
  if (!notes.length) {
    if (jsonFlag) console.log('[]')
    else console.log('No notes.')
    return
  }
  const nicks = await Promise.all(notes.map(n => fetchNick('note', n._id, config)))
  notes.forEach((note, i) => { note.nick = nicks[i] })
  if (jsonFlag) { console.log(JSON.stringify(notes)); return }
  notes.forEach((note, i) => {
    const num = (page - 1) * 40 + i + 1
    console.log(`\n${DIM}${num}.${RESET}`)
    console.log(formatNote(note))
  })
}

async function cmdAdd(args, config) {
  const title = args.join(' ')
  const res = await api('POST', 'note', { title }, config)
  const note = res
  if (!note?._id) { console.error('Failed to create note.'); return }
  const nick = await fetchNick('note', note._id, config)
  const nickStr = nick ? `  ${DIM}:${nick}${RESET}` : ''
  console.log(`${GREEN}Created:${RESET} ${note._id}${nickStr}`)
  console.log(urlFor('note', note._id) + '/edit')
  exec(`open "${urlFor('note', note._id)}/edit"`)
}

async function cmdQuick(args, config) {
  const title = args.join(' ')
  if (!title) { console.error('Usage: cplace quick <title>'); return }
  const res = await api('POST', 'note', { title }, config)
  const note = res
  if (!note?._id) { console.error('Failed to create note.'); return }
  const nick = await fetchNick('note', note._id, config)
  const nickStr = nick ? `  ${DIM}:${nick}${RESET}` : ''
  console.log(`${GREEN}Created:${RESET} ${note._id}${nickStr}  ${DIM}${title}${RESET}`)
}

async function cmdStats(args, config) {
  const jsonFlag = args.includes('--json')
  const res = await api('GET', 'stats', null, config)
  const d = res?.data
  if (!d) {
    if (jsonFlag) console.log('null')
    else console.log('No stats.')
    return
  }
  if (jsonFlag) { console.log(JSON.stringify(d)); return }
  console.log(`${BOLD}Notes${RESET}   ${d.notes}`)
  console.log(`${BOLD}Authors${RESET} ${d.authors}`)
  console.log(`${BOLD}Works${RESET}   ${d.works}`)
  console.log(`${BOLD}Ideas${RESET}   ${d.ideas}`)
  console.log(`${BOLD}Piles${RESET}   ${d.piles}`)
}

function parseFlags(args) {
  const flags = {}
  let title = []
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length) {
      const key = args[i].slice(2)
      flags[key] = args[++i]
    } else {
      title.push(args[i])
    }
  }
  return { title: title.join(' '), flags }
}

async function resolveOrCreate(type, input, config) {
  // Accepts nick, ObjectId, or name. Nicks/ObjectIds skip the autocomplete
  // path so an exact ref never gets ambiguity-matched. Only name input
  // creates a new entity when nothing matches.
  if (/^[nwip]\d+$/i.test(input)) {
    const resolved = await resolveByNick(input, config)
    if (resolved && (type === 'auth' ? resolved.type === 'auth' : resolved.type === type)) {
      return resolved.id
    }
    return null
  }
  if (/^[0-9a-f]{24}$/i.test(input)) return input
  const ac = await api('POST', `${type}/autocomplete`, { string: input }, config)
  const items = ac?.data || []
  if (items.length) return items[0]._id
  const created = await api('POST', type, { name: input }, config)
  return created?._id || created?.data?._id
}

// Like resolveOrCreate but never creates. Used on the rm path where we
// need to identify an existing relationship to detach, not invent one.
async function resolveExisting(type, input, config) {
  if (/^[nwip]\d+$/i.test(input)) {
    const resolved = await resolveByNick(input, config)
    if (resolved && resolved.type === type) {
      return { id: resolved.id }
    }
    return null
  }
  if (/^[0-9a-f]{24}$/i.test(input)) return { id: input }
  const ac = await api('POST', `${type}/autocomplete`, { string: input }, config)
  const items = ac?.data || []
  if (!items.length) return null
  const exact = items.find(i => (i.name || '') === input)
  const pick = exact || items[0]
  return { id: pick._id, name: pick.name }
}

async function cmdCapture(args, config) {
  const { title, flags } = parseFlags(args)
  if (!title) { console.error('Usage: cplace capture <title> [--text BODY] [--author NAME] [--work NAME] [--idea TAG] [--pile NAME]'); return }
  const isJson = flags.json !== undefined

  const createBody = { title }
  if (flags.text) createBody.text = flags.text

  const res = await api('POST', 'note', createBody, config)
  const note = res
  if (!note?._id) { console.error('Failed to create note.'); return }
  const id = note._id
  const nick = isJson ? null : await fetchNick('note', id, config)

  if (!isJson) {
    const nickStr = nick ? `  ${DIM}:${nick}${RESET}` : ''
    console.log(`${GREEN}Created:${RESET} ${id}${nickStr}  ${DIM}${title}${RESET}`)
  }

  if (flags.author) {
    const authorIds = []
    for (const ref of flags.author.split(',').map(s => s.trim()).filter(Boolean)) {
      const aid = await resolveOrCreate('auth', ref, config)
      if (aid) authorIds.push(aid)
    }
    if (authorIds.length) {
      await api('PUT', `note/${id}`, { authors: authorIds }, config)
      if (!isJson) console.log(`${DIM}  authors → ${flags.author}${RESET}`)
    }
  }

  if (flags.work) {
    const workId = await resolveOrCreate('work', flags.work, config)
    if (workId) {
      await api('PUT', `note/${id}/work`, { newWork: workId }, config)
      if (!isJson) console.log(`${DIM}  work → ${flags.work}${RESET}`)
    }
  }

  if (flags.idea) {
    for (const ref of flags.idea.split(',').map(s => s.trim()).filter(Boolean)) {
      await attachIdeaToNote(id, ref, config)
      if (!isJson) console.log(`${DIM}  idea → ${ref}${RESET}`)
    }
  }

  if (flags.pile) {
    for (const ref of flags.pile.split(',').map(s => s.trim()).filter(Boolean)) {
      await attachPileToNote(id, ref, config)
      if (!isJson) console.log(`${DIM}  pile → ${ref}${RESET}`)
    }
  }

  if (isJson) {
    const nick = await fetchNick('note', id, config)
    console.log(JSON.stringify({ id, nick, title, url: urlFor('note', id) }))
  }
}

// Note ids from a comma-separated list of ids and nicks, or from stdin
// (whitespace- or comma-separated) when the argument is "-". Lets another
// command's --ids output feed a bulk write (#356).
async function noteIdsFromArg(arg, config) {
  let refs
  if (arg === '-') {
    let input = ''
    for await (const chunk of process.stdin) input += chunk
    refs = input.split(/[\s,]+/)
  } else {
    refs = arg.split(',')
  }
  const ids = []
  for (const ref of refs.map(r => r.trim()).filter(Boolean)) {
    if (/^[0-9a-f]{24}$/i.test(ref)) { ids.push(ref); continue }
    const resolved = /^n\d+$/i.test(ref) ? await resolveByNick(ref, config) : null
    if (resolved?.type !== 'note') throw new Error(`Not a note id or nick: ${ref}`)
    ids.push(resolved.id)
  }
  return [...new Set(ids)]
}

// `cp set a,b,c ...` or `cp set - ...`: one request for every note.
async function bulkSet(idArg, flags, config) {
  if (flags.title || flags.text) { console.error('--title and --text take one note at a time.'); return }
  const ids = await noteIdsFromArg(idArg, config)
  if (!ids.length) { console.error('No notes given.'); return }
  const refs = (value) => (value || '').split(',').map(s => s.trim()).filter(Boolean)
  const resolveAll = async (type, value) => {
    const out = []
    for (const ref of refs(value)) {
      const rid = await resolveOrCreate(type, ref, config)
      if (!rid) throw new Error(`Could not resolve ${type} "${ref}"`)
      out.push(rid)
    }
    return out
  }
  const body = { ids }
  if (flags.work) body.work = (await resolveAll('work', flags.work))[0]
  if (flags.author) body.authors = await resolveAll('auth', flags.author)
  if (flags.idea) body.ideas = await resolveAll('idea', flags.idea)
  if (flags.pile) body.piles = await resolveAll('pile', flags.pile)
  if (Object.keys(body).length === 1) { console.error('Nothing to set: pass --work, --author, --idea or --pile.'); return }
  const res = await api('POST', 'note/bulk-update', body, config)
  const { matched = 0, modified = 0 } = res?.data || {}
  console.log(`${GREEN}Done.${RESET} ${modified} of ${matched} notes changed.`)
}

async function cmdSet(args, config) {
  const id = args[0]
  const { flags } = parseFlags(args.slice(1))
  if (!id) {
    console.error('Usage: cplace set <id> [--author REF] [--work REF] [--idea REF] [--pile REF] [--title TEXT] [--text TEXT]')
    console.error('       cplace set <id,id,...|-> [--author REF] [--work REF] [--idea REF] [--pile REF]')
    console.error('  A comma list, or - to read ids from stdin, updates every note in one request.')
    return
  }
  if (id === '-' || id.includes(',')) return bulkSet(id, flags, config)

  if (flags.title || flags.text) {
    const body = {}
    if (flags.title) body.title = flags.title
    if (flags.text) body.text = flags.text
    await api('PUT', `note/${id}`, body, config)
    if (flags.title) console.log(`${DIM}  title → ${flags.title}${RESET}`)
    if (flags.text) console.log(`${DIM}  text updated${RESET}`)
  }

  if (flags.author) {
    const authorIds = []
    for (const ref of flags.author.split(',').map(s => s.trim()).filter(Boolean)) {
      const aid = await resolveOrCreate('auth', ref, config)
      if (aid) authorIds.push(aid)
    }
    if (authorIds.length) {
      await api('PUT', `note/${id}`, { authors: authorIds }, config)
      console.log(`${DIM}  authors → ${flags.author}${RESET}`)
    }
  }

  if (flags.work) {
    const workId = await resolveOrCreate('work', flags.work, config)
    if (workId) {
      await api('PUT', `note/${id}/work`, { newWork: workId }, config)
      console.log(`${DIM}  work → ${flags.work}${RESET}`)
    }
  }

  if (flags.idea) {
    for (const ref of flags.idea.split(',').map(s => s.trim()).filter(Boolean)) {
      await attachIdeaToNote(id, ref, config)
      console.log(`${DIM}  idea → ${ref}${RESET}`)
    }
  }

  if (flags.pile) {
    for (const ref of flags.pile.split(',').map(s => s.trim()).filter(Boolean)) {
      await attachPileToNote(id, ref, config)
      console.log(`${DIM}  pile → ${ref}${RESET}`)
    }
  }

  console.log(`${GREEN}Done.${RESET}`)
}

// Attach an existing idea (nick/ObjectId) or create-and-attach by name.
// Hits PUT /note/:id/idea for refs, PUT /note/:id/idea/create for names.
async function attachIdeaToNote(noteId, ref, config) {
  if (/^[ip]\d+$/i.test(ref) || /^[0-9a-f]{24}$/i.test(ref)) {
    const id = /^i\d+$/i.test(ref)
      ? (await resolveByNick(ref, config))?.id
      : ref
    if (!id) throw new Error(`Could not resolve idea ref ${ref}`)
    await api('PUT', `note/${noteId}/idea`, { id }, config)
    return
  }
  await api('PUT', `note/${noteId}/idea/create`, { name: ref }, config)
}

async function attachPileToNote(noteId, ref, config) {
  if (/^p\d+$/i.test(ref) || /^[0-9a-f]{24}$/i.test(ref)) {
    const id = /^p\d+$/i.test(ref)
      ? (await resolveByNick(ref, config))?.id
      : ref
    if (!id) throw new Error(`Could not resolve pile ref ${ref}`)
    await api('PUT', `note/${noteId}/pile`, { id }, config)
    return
  }
  await api('PUT', `note/${noteId}/pile/create`, { name: ref }, config)
}

async function cmdOpen(args, config) {
  // `cp open <nick|ObjectId|name> [--type T]`
  // Routes through resolveTarget so all three input shapes work for every
  // entity type. ObjectId without --type falls back to the original
  // "treat as note" behavior for backwards compatibility with the most
  // common call shape.
  const typeFlag = args.find(a => a.startsWith('--type='))?.split('=')[1]
  const positional = args.filter(a => !a.startsWith('--'))
  const input = positional.join(' ')
  if (!input) {
    console.error('Usage: cp open <nick|ObjectId|name> [--type T]')
    return
  }
  const target = await resolveTarget(input, typeFlag, config)
  let type, id
  if (target) {
    ({ type, id } = target)
  } else if (/^[0-9a-f]{24}$/i.test(input)) {
    // Back-compat: bare ObjectId with no --type and no resolveTarget hit
    // gets treated as a note id (the original cmdOpen behavior).
    type = 'note'
    id = input
  } else {
    console.error(`Could not resolve "${input}".`)
    return
  }
  const url = urlFor(type, id)
  console.log(url)
  exec(`open "${url}"`)
}

async function cmdPing(args, config) {
  try {
    await api('GET', 'user/me', null, config)
    console.log(`${GREEN}OK${RESET} — server is up and authenticated`)
  } catch (e) {
    const msg = e.cause?.code === 'ECONNREFUSED' || e.message === 'fetch failed'
      ? `Server not reachable at ${config.url || DEFAULT_URL}`
      : e.message
    console.log(`${YELLOW}${msg}${RESET}`)
  }
}

// `--show` on the list commands: print each match's contents (the same
// view as `cp show`) instead of just its name. Capped so a broad query
// doesn't flood the terminal. With --json, one JSON object per line.
const SHOW_LIMIT = 10
async function showMatches(type, matches, args, config) {
  const jsonFlag = args.includes('--json')
  if (!matches.length) { if (!jsonFlag) console.log('No matches.'); return }
  for (const m of matches.slice(0, SHOW_LIMIT)) {
    await cmdShow([m._id, `--type=${type}`, ...(jsonFlag ? ['--json'] : [])], config)
  }
  if (matches.length > SHOW_LIMIT && !jsonFlag) {
    console.log(`\n${DIM}…and ${matches.length - SHOW_LIMIT} more matches; narrow the query to see them.${RESET}`)
  }
}

async function cmdAuthors(args, config) {
  const jsonFlag = args.includes('--json')
  if (args.includes('--duplicates') || args.includes('--combined')) {
    const path = args.includes('--duplicates') ? 'auth/duplicates' : 'auth/combined'
    const data = (await api('GET', path, null, config))?.data || []
    if (jsonFlag) { console.log(JSON.stringify(data)); return }
    if (path === 'auth/duplicates') return printDuplicateGroups(data, GREEN)
    if (!data.length) { console.log('No combined-looking authors.'); return }
    data.forEach(a => console.log(`${GREEN}${a.name}${RESET}  ${DIM}${a._id}${RESET}`))
    console.log(`\n${DIM}Split one with: cp auth split <author> --into "A" --into "B"${RESET}`)
    return
  }
  const query = args.filter(a => !a.startsWith('--')).join(' ')
  if (!query) { console.error('Usage: cp authors <query> [--show] [--json]  |  cp authors --duplicates | --combined'); return }
  const res = await api('POST', 'auth/autocomplete', { string: query }, config)
  const authors = res?.data || []
  if (args.includes('--show')) return showMatches('auth', authors, args, config)
  if (jsonFlag) { console.log(JSON.stringify(authors)); return }
  if (!authors.length) { console.log('No authors found.'); return }
  authors.forEach(a => console.log(`${GREEN}${a.name}${RESET}  ${DIM}${a._id}${RESET}`))
}

async function cmdIdeas(args, config) {
  const jsonFlag = args.includes('--json')
  const query = args.filter(a => !a.startsWith('--')).join(' ')
  if (!query) { console.error('Usage: cp ideas <query> [--show] [--json]'); return }
  const res = await api('POST', 'idea/autocomplete', { string: query }, config)
  const ideas = res?.data || []
  if (args.includes('--show')) return showMatches('idea', ideas, args, config)
  await withNicks('idea', ideas, config)
  if (jsonFlag) { console.log(JSON.stringify(ideas)); return }
  if (!ideas.length) { console.log('No ideas found.'); return }
  ideas.forEach(i => console.log(`${BLUE}${i.name}${RESET}${nickSuffix(i.nick)}  ${DIM}${i._id}${RESET}`))
}

async function cmdWorks(args, config) {
  const jsonFlag = args.includes('--json')
  const byline = (w) => {
    const names = joinAuthorNames(w.authors)
    return names ? ` ${DIM}— ${names}${RESET}` : ''
  }
  if (args.includes('--duplicates')) {
    const groups = (await api('GET', 'work/duplicates', null, config))?.data || []
    if (jsonFlag) { console.log(JSON.stringify(groups)); return }
    printDuplicateGroups(groups, YELLOW, byline)
    if (groups.length) console.log(`${DIM}Merge with: cp work merge <from...> <into>${RESET}`)
    return
  }
  if (args.includes('--no-notes')) {
    const works = (await api('GET', 'work/no-notes', null, config))?.data || []
    if (jsonFlag) { console.log(JSON.stringify(works)); return }
    if (!works.length) { console.log('Every work has notes.'); return }
    works.forEach(w => console.log(`${YELLOW}${w.name}${RESET}${byline(w)}  ${DIM}${w._id}${RESET}`))
    console.log(`\n${works.length} works without notes`)
    return
  }
  const query = args.filter(a => !a.startsWith('--')).join(' ')
  if (!query) { console.error('Usage: cp works <query> [--show] [--json]  |  cp works --duplicates | --no-notes'); return }
  const res = await api('POST', 'work/autocomplete', { string: query }, config)
  const works = res?.data || []
  if (args.includes('--show')) return showMatches('work', works, args, config)
  await withNicks('work', works, config)
  if (jsonFlag) { console.log(JSON.stringify(works)); return }
  if (!works.length) { console.log('No works found.'); return }
  works.forEach(w => {
    const names = joinAuthorNames(w.authors)
    const auth = names ? ` ${DIM}— ${names}${RESET}` : ''
    console.log(`${YELLOW}${w.name}${RESET}${nickSuffix(w.nick)}${auth}  ${DIM}${w._id}${RESET}`)
  })
}

async function cmdPiles(args, config) {
  const jsonFlag = args.includes('--json')
  const query = args.filter(a => !a.startsWith('--')).join(' ')
  if (!query) {
    console.error('Usage: cp piles <query> [--show] [--json]')
    console.error('  Wildcards: `*` and `?` match any chars / one char.')
    console.error('  Range:     `Prefix: YYYY-MM..YYYY-MM` expands to a month range.')
    console.error('  Examples:')
    console.error('    cp piles "Reading: 2025-*"')
    console.error('    cp piles "Reading: 2025-07..2026-05"')
    return
  }
  const piles = await matchPiles(query, config)
  if (args.includes('--show')) return showMatches('pile', piles, args, config)
  await withNicks('pile', piles, config)
  if (jsonFlag) { console.log(JSON.stringify(piles)); return }
  if (!piles.length) { console.log('No piles found.'); return }
  piles.forEach(p => console.log(`${MAGENTA}${p.name}${RESET}${nickSuffix(p.nick)}  ${DIM}${p._id}${RESET}`))
}

// Resolves a pile query string to a list of piles. Three modes:
//   1. Range `<prefix><YYYY-MM>..<YYYY-MM>` — enumerates each month between
//      the two endpoints (inclusive) and looks each up.
//   2. Glob — `*` / `?` are translated to regex.
//   3. Plain substring — falls through to the autocomplete endpoint, which
//      is the legacy behavior.
// For glob and range, we narrow server-side via autocomplete on the literal
// prefix (the substring before the first wildcard / range marker), then
// filter the result client-side. We never use `pile/all` because that
// endpoint caps at 100 records.
async function matchPiles(query, config) {
  const rangeMatch = query.match(/^(.*?)(\d{4})-(\d{2})\.\.(\d{4})-(\d{2})\s*$/)
  if (rangeMatch) {
    const [, prefix, fromY, fromM, toY, toM] = rangeMatch
    const months = enumerateMonths(parseInt(fromY), parseInt(fromM), parseInt(toY), parseInt(toM))
    if (!months.length) return []
    const candidates = await searchPilesByPrefix(prefix, config)
    const wanted = new Set(months.map(m => prefix + m))
    return candidates.filter(p => wanted.has(p.name))
  }

  if (/[*?]/.test(query)) {
    const firstWild = Math.min(
      query.indexOf('*') === -1 ? Infinity : query.indexOf('*'),
      query.indexOf('?') === -1 ? Infinity : query.indexOf('?'),
    )
    const literalPrefix = query.slice(0, firstWild)
    const pattern = '^' + query.split('').map(c => {
      if (c === '*') return '.*'
      if (c === '?') return '.'
      return c.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    }).join('') + '$'
    const re = new RegExp(pattern, 'i')
    const candidates = await searchPilesByPrefix(literalPrefix, config)
    return candidates.filter(p => re.test(p.name))
  }

  const res = await api('POST', 'pile/autocomplete', { string: query }, config)
  return res?.data || []
}

// `pile/autocomplete` is substring-regex over names with no documented
// result cap — sufficient for narrowing a wildcard query to a manageable
// candidate set without ever touching `pile/all` (which caps at 100).
async function searchPilesByPrefix(prefix, config) {
  if (!prefix) {
    // No literal anchor — caller asked for `*` or similar. Fall back to
    // `pile/all` and accept the 100-pile cap. Anything broader would
    // require a new server endpoint.
    return (await api('GET', 'pile/all', null, config))?.data || []
  }
  const res = await api('POST', 'pile/autocomplete', { string: prefix }, config)
  return res?.data || []
}

function enumerateMonths(fromY, fromM, toY, toM) {
  const out = []
  let y = fromY, m = fromM
  // Cap at 600 months so a backwards / huge range can't loop forever.
  for (let i = 0; i < 600; i++) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    if (y === toY && m === toM) return out
    m++
    if (m > 12) { m = 1; y++ }
    if (y > toY || (y === toY && m > toM)) return out
  }
  return out
}

async function cmdFlip(args, config) {
  const jsonFlag = args.includes('--json')
  const res = await api('GET', 'note/flip', null, config)
  const notes = res?.data || []
  if (jsonFlag) { console.log(JSON.stringify(notes)); return }
  if (!notes.length) { console.log('No notes.'); return }
  notes.forEach((note, i) => {
    console.log(`\n${DIM}${i + 1}.${RESET}`)
    console.log(formatNote(note))
  })
}

async function cmdReview(args, config) {
  const [id, rating] = args
  if (!id || !['fast', 'med', 'slow'].includes(rating)) {
    console.error('Usage: cplace review <id> fast|med|slow'); return
  }
  const res = await api('POST', `note/${id}/review`, { rating }, config)
  const due = res?.data?.reviewDueAt
  console.log(`${GREEN}Reviewed.${RESET}${due ? ` Next due ${new Date(due).toLocaleDateString()}.` : ''}`)
}

async function cmdEdit(args, config) {
  const id = args[0]
  const field = args[1]
  const value = args.slice(2).join(' ')
  if (!id) { console.error('Usage: cplace edit <id> title|text <value>'); return }
  if (!field || !value) { console.error('Usage: cplace edit <id> title|text <value>'); return }
  if (field !== 'title' && field !== 'text') { console.error('Field must be title or text'); return }
  await api('PUT', `note/${id}`, { [field]: value }, config)
  console.log(`${GREEN}Updated.${RESET}`)
}

async function cmdConfig(args, config) {
  const key = args[0]
  const val = args[1]
  if (!key) {
    console.log(`url:   ${config.url || DEFAULT_URL}`)
    console.log(`token: ${config.token ? '(set)' : '(none)'}`)
    return
  }
  if (key === 'url') {
    if (!val) { console.error('Usage: cplace config url <url>'); return }
    config.url = val.endsWith('/') ? val : val + '/'
    saveConfig(config)
    console.log(`${GREEN}URL set to ${config.url}${RESET}`)
    return
  }
  console.error(`Unknown config key: ${key}`)
}

async function cmdNick(args, config) {
  const nick = args[0]
  if (!nick) { console.error('Usage: cp nick <nick>'); return }
  const res = await api('GET', `nick/${nick}`, null, config)
  const data = res?.data
  if (!data) { console.log('Not found.'); return }
  if (data.note) {
    const noteRes = await api('GET', `note/${data.note}`, null, config)
    console.log('\n' + formatNote(noteRes?.data, { full: true }))
  } else {
    console.log(JSON.stringify(data, null, 2))
  }
}

async function cmdBackfillEmbeddings(args, config) {
  console.log('Backfilling embeddings (this may take a while)...')
  const res = await api('POST', 'note/bulk-embed', null, config)
  const results = res?.data
  if (!results) { console.error('No response.'); return }
  console.log(`${BOLD}processed${RESET}  ${results.processed}`)
  console.log(`${BOLD}skipped${RESET}    ${results.skipped}`)
  console.log(`${BOLD}failed${RESET}     ${results.failed}`)
}

async function cmdBackfillNicks(args, config) {
  console.log('Backfilling nicks...')
  const res = await api('POST', 'nick/backfill', null, config)
  const results = res?.data
  if (!results) { console.error('No response.'); return }
  for (const [type, r] of Object.entries(results)) {
    console.log(`${BOLD}${type}${RESET}  total=${r.total}  had_nick=${r.already_had_nick}  created=${r.created}  failed=${r.failed}`)
  }
}

async function cmdShow(args, config) {
  const jsonFlag = args.includes('--json')
  const typeFlag = args.find(a => a.startsWith('--type='))?.split('=')[1]
  const positional = args.filter(a => !a.startsWith('--'))
  const input = positional.join(' ')
  if (!input) {
    console.error('Usage: cp show <nick|ObjectId|name> [--type T] [--json]')
    console.error('  Examples:')
    console.error('    cp show p12345')
    console.error('    cp show 5f5...02 --type pile')
    console.error('    cp show "Reading: 2025-11"')
    console.error('  Type defaults to auto-detect (nick → pile → work → idea → auth).')
    return
  }
  const target = await resolveTarget(input, typeFlag, config)
  if (!target) {
    if (jsonFlag) { console.log('null'); return }
    console.error(`Could not resolve "${input}".`)
    console.error('  Try a nick (p12345), an ObjectId + --type, or the exact entity name.')
    return
  }
  const { type, id } = target

  // Pass the original input through as the displayed nick only when it
  // actually looked like one — for ObjectIds / names, look up the real
  // nick so the header doesn't show a hex string in the "nick" slot.
  // An old nick of a merged work isn't the kept work's own nick.
  const looksLikeNick = /^[nwip]\d+$/i.test(input) && target.merged === undefined
  const displayNick = looksLikeNick ? input : await fetchNick(type, id, config)

  if (type === 'note') {
    const res = await api('GET', `note/${id}`, null, config)
    const note = Array.isArray(res?.data) ? res.data[0] : res?.data
    if (!note) {
      if (jsonFlag) console.log('null')
      else console.log('Not found.')
      return
    }
    note.nick = displayNick
    if (jsonFlag) { console.log(JSON.stringify({ type, id, nick: displayNick, note })); return }
    console.log('\n' + formatNote(note, { full: true }))
    return
  }

  // Header for the entity itself.
  let info = null
  try { info = (await api('GET', `${type}/${id}`, null, config))?.data } catch {}

  // Contents by type.
  if (type === 'pile') {
    const [notes, worksRes] = await Promise.all([
      fetchAllNotes(`pile/${id}/notes`, config),
      api('GET', `pile/${id}/works`, null, config),
    ])
    const works = await withNicks('work', worksRes?.data || [], config)
    if (jsonFlag) {
      console.log(JSON.stringify({ type, id, nick: displayNick, info, works, notes }))
      return
    }
    const header = info
      ? formatEntity(type, { ...info, nick: displayNick })
      : `${BOLD}${typeColor(type)}[${typeLabel(type)}]${RESET}  ${DIM}${id}${RESET}`
    console.log('\n' + header)
    if (works.length) {
      console.log(`\n${BOLD}Works${RESET} (${works.length})`)
      works.forEach(w => console.log('  ' + formatEntity('work', w).split('\n').join('\n  ')))
    }
    if (notes.length) {
      console.log(`\n${BOLD}Notes${RESET} (${notes.length})`)
      notes.forEach(n => console.log('  ' + formatNote(n).split('\n').join('\n  ')))
    }
    if (!works.length && !notes.length) console.log('\n(empty)')
    return
  }

  if (type === 'idea') {
    const [notes, worksRes] = await Promise.all([
      fetchAllNotes(`idea/${id}/notes`, config),
      api('GET', `idea/${id}/works`, null, config),
    ])
    const works = await withNicks('work', worksRes?.data || [], config)
    if (jsonFlag) {
      console.log(JSON.stringify({ type, id, nick: displayNick, info, works, notes }))
      return
    }
    const header = info
      ? formatEntity(type, { ...info, nick: displayNick })
      : `${BOLD}${typeColor(type)}[${typeLabel(type)}]${RESET}  ${DIM}${id}${RESET}`
    console.log('\n' + header)
    if (works.length) {
      console.log(`\n${BOLD}Works${RESET} (${works.length})`)
      works.forEach(w => console.log('  ' + formatEntity('work', w).split('\n').join('\n  ')))
    }
    console.log(`\n${BOLD}Notes${RESET} (${notes.length})`)
    if (!notes.length) { console.log('(none)'); return }
    notes.forEach(n => console.log('  ' + formatNote(n).split('\n').join('\n  ')))
    return
  }

  if (type === 'work') {
    const notes = await fetchAllNotes(`work/${id}/notes`, config)
    if (jsonFlag) {
      console.log(JSON.stringify({ type, id, nick: displayNick, info, notes }))
      return
    }
    const header = info
      ? formatEntity(type, { ...info, nick: displayNick })
      : `${BOLD}${typeColor(type)}[${typeLabel(type)}]${RESET}  ${DIM}${id}${RESET}`
    console.log('\n' + header)
    console.log(`\n${BOLD}Notes${RESET} (${notes.length})`)
    if (!notes.length) { console.log('(none)'); return }
    notes.forEach(n => console.log('  ' + formatNote(n).split('\n').join('\n  ')))
    return
  }

  // An author: same as `cp author`.
  if (type === 'auth') return cmdAuthor([id, ...(jsonFlag ? ['--json'] : [])], config)

  // Any other type: just print the header.
  if (jsonFlag) {
    console.log(JSON.stringify({ type, id, nick: displayNick, info }))
    return
  }
  const header = info
    ? formatEntity(type, { ...info, nick: displayNick })
    : `${BOLD}${typeColor(type)}[${typeLabel(type)}]${RESET}  ${DIM}${id}${RESET}`
  console.log('\n' + header)
}

async function cmdAuthor(args, config) {
  // `cp author <id-or-name>` — shows works + notes for one author. Accepts
  // either an ObjectId or a name we'll autocomplete to a single match.
  const jsonFlag = args.includes('--json')
  const positional = args.filter(a => a !== '--json')
  const input = positional.join(' ').trim()
  if (!input) { console.error('Usage: cp author <id|name> [--json]'); return }
  let id = input
  if (!/^[0-9a-f]{24}$/i.test(input)) {
    const ac = await api('POST', 'auth/autocomplete', { string: input }, config)
    const matches = ac?.data || []
    if (!matches.length) {
      if (jsonFlag) console.log('null')
      else console.log('No match.')
      return
    }
    if (matches.length > 1) {
      if (jsonFlag) { console.log(JSON.stringify({ ambiguous: true, matches })); return }
      console.log(`Multiple matches — be more specific or pass the ObjectId:`)
      matches.forEach(a => console.log(`  ${a.name}  ${DIM}${a._id}${RESET}`))
      return
    }
    id = matches[0]._id
  }
  const info = (await api('GET', `auth/${id}`, null, config))?.data
  if (!info) {
    if (jsonFlag) console.log('null')
    else console.log('Not found.')
    return
  }
  const [worksRes, notes, notesAbout] = await Promise.all([
    api('GET', `auth/${id}/works`, null, config),
    fetchAllNotes(`auth/${id}/notes`, config),
    fetchAllNotes(`auth/${id}/notes-about`, config),
  ])
  const works = await withNicks('work', worksRes?.data || [], config)
  const workIds = new Set(works.map(w => String(w._id)))
  const standalone = notes.filter(n => !n.work?._id || !workIds.has(String(n.work._id)))

  if (jsonFlag) {
    console.log(JSON.stringify({ type: 'auth', id, info, works, notes: standalone, notesAbout }))
    return
  }

  console.log('\n' + formatEntity('auth', info))
  if (works.length) {
    console.log(`\n${BOLD}Works${RESET} (${works.length})`)
    works.forEach(w => console.log('  ' + formatEntity('work', w).split('\n').join('\n  ')))
  }
  if (standalone.length) {
    console.log(`\n${BOLD}Notes${RESET} (${standalone.length})`)
    standalone.forEach(n => console.log('  ' + formatNote(n).split('\n').join('\n  ')))
  }
  if (notesAbout.length) {
    console.log(`\n${BOLD}Notes about${RESET} (${notesAbout.length})`)
    notesAbout.forEach(n => console.log('  ' + formatNote(n).split('\n').join('\n  ')))
  }
  if (!works.length && !notes.length && !notesAbout.length) console.log('\n(empty)')
}

async function cmdDelete(args, config) {
  // `cp delete <id-or-nick> [--yes]` — deletes a note, work, idea, or pile.
  // Type inferred from nick prefix; for raw ObjectId, pass --type.
  const flagYes = args.includes('--yes') || args.includes('-y')
  const positional = args.filter(a => a !== '--yes' && a !== '-y' && !a.startsWith('--type'))
  const typeFlag = args.find(a => a.startsWith('--type='))?.split('=')[1]
  const input = positional[0]
  if (!input) { console.error('Usage: cp delete <id|nick> [--type note|work|idea|pile|auth] [--yes]'); return }
  const target = await resolveTarget(input, typeFlag, config)
  if (!target) { console.error('Could not resolve target — pass a nick, or both an ObjectId and --type.'); return }
  if (refuseMergedNick(target, input, 'delete')) return
  const { type, id } = target

  if (!flagYes) {
    const ok = await confirm(`Delete ${type} ${id}? [y/N] `)
    if (!ok) { console.log('Cancelled.'); return }
  }

  // Per-resource endpoint shapes — some use /:id/delete, some DELETE /:id.
  const deletePath = {
    note: `note/${id}`,
    work: `work/${id}`,
    idea: `idea/${id}/delete`,
    pile: `pile/${id}`,
    auth: `auth/${id}/delete`,
  }[type]
  if (!deletePath) { console.error(`Unknown type: ${type}`); return }
  await api('DELETE', deletePath, null, config)
  console.log(`${GREEN}Deleted${RESET} ${type} ${id}`)
}

async function cmdRm(args, config) {
  // `cp rm <noteId> [--idea REF|--pile REF|--author REF|--work]`
  // Detaches a relation from a note. --work has no value (clears the work).
  // REF accepts nick, ObjectId, or exact name.
  const noteId = args[0]
  if (!noteId) { console.error('Usage: cp rm <noteId> [--idea REF|--pile REF|--author REF|--work]'); return }
  const { flags } = parseFlags(args.slice(1))

  if (flags.idea) {
    const target = await resolveExisting('idea', flags.idea, config)
    if (!target) { console.error(`No idea matching "${flags.idea}".`); return }
    await api('DELETE', `note/${noteId}/idea/${target.id}`, null, config)
    console.log(`${DIM}  idea ✕ ${target.name || flags.idea}${RESET}`)
  }

  if (flags.pile) {
    const target = await resolveExisting('pile', flags.pile, config)
    if (!target) { console.error(`No pile matching "${flags.pile}".`); return }
    await api('DELETE', `note/${noteId}/pile/${target.id}`, null, config)
    console.log(`${DIM}  pile ✕ ${target.name || flags.pile}${RESET}`)
  }

  if (flags.author) {
    const target = await resolveExisting('auth', flags.author, config)
    if (!target) { console.error(`No author matching "${flags.author}".`); return }
    // Removing an author = rewrite the authors array without that id.
    const noteRes = await api('GET', `note/${noteId}`, null, config)
    const note = Array.isArray(noteRes?.data) ? noteRes.data[0] : noteRes?.data
    const current = (note?.authors || []).filter(a => a)
    const filtered = current.filter(a => String(a._id) !== String(target.id))
    await api('PUT', `note/${noteId}`, { authors: filtered.map(a => a._id) }, config)
    console.log(`${DIM}  author ✕ ${target.name || flags.author}${RESET}`)
  }

  if (flags.work !== undefined) {
    await api('PUT', `note/${noteId}`, { work: null }, config)
    console.log(`${DIM}  work ✕${RESET}`)
  }

  console.log(`${GREEN}Done.${RESET}`)
}

async function cmdOcr(args, config) {
  const input = args[0]
  if (!input) { console.error('Usage: cp ocr <noteId|nick>'); return }
  const target = await resolveTarget(input, 'note', config)
  if (!target) { console.error('Could not resolve note.'); return }
  console.log('Running OCR...')
  const res = await api('GET', `note/${target.id}/ocr`, null, config)
  const text = res?.data || ''
  if (!text) { console.log('No text extracted.'); return }
  console.log(`${GREEN}OCR text:${RESET}`)
  console.log(text)
}

async function cmdSuggest(args, config) {
  const input = args[0]
  if (!input) { console.error('Usage: cp suggest <noteId|nick> [--title|--ideas]'); return }
  const target = await resolveTarget(input, 'note', config)
  if (!target) { console.error('Could not resolve note.'); return }
  const wantTitle = args.includes('--title')
  const wantIdeas = args.includes('--ideas')
  const both = !wantTitle && !wantIdeas

  if (wantTitle || both) {
    const res = await api('GET', `note/${target.id}/title/suggest`, null, config)
    const title = res?.suggested_title || res?.data?.suggested_title || '(none)'
    console.log(`${BOLD}Title:${RESET}  ${title}`)
  }
  if (wantIdeas || both) {
    const res = await api('GET', `note/${target.id}/ideas/suggest`, null, config)
    const ideas = res?.suggested_ideas || res?.data?.suggested_ideas || []
    console.log(`${BOLD}Ideas:${RESET}  ${ideas.length ? ideas.join(', ') : '(none)'}`)
  }
}

async function cmdAttach(args, config) {
  // `cp attach <note> <file> [file...]` — add images to a note, in order.
  const jsonFlag = args.includes('--json')
  const [input, ...files] = args.filter(a => a !== '--json')
  if (!input || !files.length) {
    console.error('Usage: cp attach <noteId|nick> <image-file> [more files...] [--json]')
    return
  }
  const missing = files.filter(f => !existsSync(f))
  if (missing.length) { console.error(`No such file: ${missing.join(', ')}`); process.exitCode = 1; return }
  const target = await resolveTarget(input, 'note', config)
  if (!target) { console.error(`Could not resolve note "${input}".`); process.exitCode = 1; return }

  let note = null
  const results = []
  // One at a time: each upload's OCR text is appended after the previous.
  for (const file of files) {
    const before = note?.text ?? null
    note = await uploadImage(target.id, file, config)
    const stored = note?.images?.at(-1)
    results.push({ file, stored })
    if (!jsonFlag) {
      const filled = note?.text && note.text !== before ? `  ${DIM}(text now ${note.text.length} chars)${RESET}` : ''
      console.log(`${GREEN}Attached${RESET} ${basename(file)} → ${stored}${filled}`)
    }
  }
  if (jsonFlag) console.log(JSON.stringify({ id: target.id, attached: results, text: note?.text ?? null }))
}

async function cmdLink(args, config) {
  const a = args[0], b = args[1]
  if (!a || !b) { console.error('Usage: cp link <noteId-or-nick> <noteId-or-nick>'); return }
  const ta = await resolveTarget(a, 'note', config)
  const tb = await resolveTarget(b, 'note', config)
  if (!ta || !tb) { console.error('Could not resolve both notes.'); return }
  await api('PUT', 'link', { fromId: ta.id, toId: tb.id }, config)
  console.log(`${GREEN}Linked${RESET} ${ta.id} ↔ ${tb.id}`)
}

async function cmdLinks(args, config) {
  const jsonFlag = args.includes('--json')
  const positional = args.filter(a => a !== '--json')
  const input = positional[0]
  if (!input) { console.error('Usage: cp links <noteId|nick> [--json]'); return }
  const target = await resolveTarget(input, 'note', config)
  if (!target) {
    if (jsonFlag) console.log('null')
    else console.error('Could not resolve note.')
    return
  }
  const res = await api('GET', `link/note/${target.id}`, null, config)
  const links = res?.data || []
  if (jsonFlag) { console.log(JSON.stringify(links)); return }
  if (!links.length) { console.log('No links.'); return }
  console.log(`${BOLD}Links${RESET} (${links.length})`)
  links.forEach(l => {
    console.log(`  ${l.nick || ''}  ${l.title || '(untitled)'}  ${DIM}${l._id}${RESET}`)
  })
}

async function cmdEarliest(args, config) {
  const jsonFlag = args.includes('--json')
  const positional = args.filter(a => a !== '--json')
  const page = parseInt(positional[0]) || 1
  const res = await api('GET', `note/file/${page}`, null, config)
  const notes = res?.data || []
  if (jsonFlag) { console.log(JSON.stringify(notes)); return }
  if (!notes.length) { console.log('No notes.'); return }
  notes.forEach((note, i) => {
    const num = (page - 1) * 40 + i + 1
    console.log(`\n${DIM}${num}.${RESET}`)
    console.log(formatNote(note))
  })
}

async function cmdExport(args, config) {
  // `cp export --piles <query>` — dumps every matching pile along with its
  // works and notes in one CLI call. Designed for agent-driven bulk reads
  // where issuing N separate commands would mean N permission prompts.
  // Output is always JSON; the --json flag is accepted as a no-op for
  // consistency with the other read commands.
  const pilesFlag = args.find(a => a === '--piles' || a === '--pile')
  const pilesIdx = pilesFlag ? args.indexOf(pilesFlag) : -1
  const pilesQuery = pilesIdx >= 0 ? args[pilesIdx + 1] : null

  if (!pilesQuery) {
    console.error('Usage: cp export --piles "<query>"')
    console.error('  query supports the same wildcards / ranges as `cp piles`:')
    console.error('    cp export --piles "Reading: 2025-*"')
    console.error('    cp export --piles "Reading: 2025-07..2026-05"')
    console.error('    cp export --piles "Reading: 2026-03"')
    console.error('  Output: JSON array of {pile, works, notes}.')
    return
  }

  const piles = await matchPiles(pilesQuery, config)
  if (!piles.length) { console.log('[]'); return }

  const bundles = await Promise.all(piles.map(async pile => {
    const [worksRes, notesRes] = await Promise.all([
      api('GET', `pile/${pile._id}/works`, null, config),
      api('GET', `pile/${pile._id}/notes`, null, config),
    ])
    return {
      pile,
      works: worksRes?.data || [],
      notes: notesRes?.data || [],
    }
  }))
  console.log(JSON.stringify(bundles))
}

async function cmdPile(args, config) {
  // `cp pile <subcommand> ...` — manage piles and their relationships to works.
  // The relationship between notes and piles is already covered by `cp set
  // --pile` and `cp rm --pile`; this command fills the gap for works and
  // standalone pile creation, neither of which had a CLI path before.
  const sub = args[0]
  const rest = args.slice(1)
  if (!sub) {
    console.error('Usage: cp pile <new|add-work|rm-work|swap-work> ...')
    console.error('  cp pile new "<name>"')
    console.error('  cp pile add-work <pileTarget> <workTarget>')
    console.error('  cp pile rm-work <pileTarget> <workTarget>')
    console.error('  cp pile swap-work <fromPile> <toPile> <workTarget>')
    return
  }

  if (sub === 'new') {
    const jsonFlag = rest.includes('--json')
    const name = rest.filter(a => a !== '--json').join(' ').trim()
    if (!name) { console.error('Usage: cp pile new "<name>"'); return }
    const res = await api('POST', 'pile', { name }, config)
    const pile = res?.data || res
    if (!pile?._id) {
      if (jsonFlag) console.log('null')
      else console.error('Failed to create pile.')
      return
    }
    if (jsonFlag) { console.log(JSON.stringify(pile)); return }
    console.log(`${GREEN}Created pile${RESET} ${MAGENTA}${pile.name}${RESET}  ${DIM}${pile._id}${RESET}`)
    return
  }

  if (sub === 'add-work' || sub === 'rm-work') {
    const [pileInput, workInput] = rest
    if (!pileInput || !workInput) {
      console.error(`Usage: cp pile ${sub} <pileTarget> <workTarget>`)
      return
    }
    const pileTarget = await resolveTarget(pileInput, 'pile', config)
    if (!pileTarget) { console.error(`Could not resolve pile "${pileInput}".`); return }
    const workTarget = await resolveTarget(workInput, 'work', config)
    if (!workTarget) { console.error(`Could not resolve work "${workInput}".`); return }

    if (sub === 'add-work') {
      await api('PUT', `work/${workTarget.id}/pile`, { id: pileTarget.id }, config)
      console.log(`${GREEN}Added${RESET} work ${workTarget.id} to pile ${pileTarget.id}`)
    } else {
      await api('DELETE', `work/${workTarget.id}/pile/${pileTarget.id}`, null, config)
      console.log(`${GREEN}Removed${RESET} work ${workTarget.id} from pile ${pileTarget.id}`)
    }
    return
  }

  if (sub === 'swap-work' || sub === 'move-work') {
    // Adds to the new pile before removing from the old, so a failure
    // midway leaves the work in both piles rather than neither (#355).
    const [fromInput, toInput, workInput] = rest
    if (!fromInput || !toInput || !workInput) {
      console.error(`Usage: cp pile ${sub} <fromPile> <toPile> <workTarget>`)
      return
    }
    const fromTarget = await resolveTarget(fromInput, 'pile', config)
    if (!fromTarget) { console.error(`Could not resolve pile "${fromInput}".`); return }
    const toTarget = await resolveTarget(toInput, 'pile', config)
    if (!toTarget) { console.error(`Could not resolve pile "${toInput}".`); return }
    const workTarget = await resolveTarget(workInput, 'work', config)
    if (!workTarget) { console.error(`Could not resolve work "${workInput}".`); return }
    if (String(fromTarget.id) === String(toTarget.id)) {
      console.error('The two piles are the same.')
      return
    }

    await api('PUT', `work/${workTarget.id}/pile`, { id: toTarget.id }, config)
    await api('DELETE', `work/${workTarget.id}/pile/${fromTarget.id}`, null, config)
    console.log(`${GREEN}Moved${RESET} work ${workTarget.id} from pile ${fromTarget.id} to pile ${toTarget.id}`)
    return
  }

  console.error(`Unknown pile subcommand: ${sub}`)
}

async function cmdNew(args, config) {
  // `cp new <type> "<name>"` — standalone creation of empty entities.
  // Previously you could only create works/ideas/authors as a side effect
  // of attaching them to a note (via cp set / cp capture), even though
  // the server has POST endpoints for each. Piles have `cp pile new` too,
  // which this command accepts as an alias.
  const jsonFlag = args.includes('--json')
  const positional = args.filter(a => a !== '--json' && a !== '--force')
  const type = positional[0]
  const name = positional.slice(1).join(' ').trim()
  const valid = new Set(['work', 'idea', 'auth', 'pile'])
  if (!type || !name) {
    console.error('Usage: cp new <work|idea|auth|pile> "<name>" [--json] [--force]')
    return
  }
  if (!valid.has(type)) { console.error(`Unknown type: ${type}`); return }

  // Authors are matched by name nowhere else, so a second `new auth` used
  // to make a silent duplicate (#359).
  if (type === 'auth' && !args.includes('--force')) {
    const ac = await api('POST', 'auth/autocomplete', { string: name }, config)
    const same = (ac?.data || []).filter(a => (a.name || '').trim().toLowerCase() === name.toLowerCase())
    if (same.length) {
      if (jsonFlag) { console.log(JSON.stringify({ exists: true, matches: same })); return }
      console.error(`An author named "${name}" already exists:`)
      same.forEach(a => console.error(`  ${a.name}  ${DIM}${a._id}${RESET}`))
      console.error('Pass --force to create another anyway.')
      return
    }
  }

  const res = await api('POST', type, { name }, config)
  const entity = res?.data || res
  if (!entity?._id) {
    if (jsonFlag) console.log('null')
    else console.error(`Failed to create ${type}.`)
    return
  }
  if (jsonFlag) { console.log(JSON.stringify(entity)); return }
  console.log(`${GREEN}Created ${type}${RESET} ${typeColor(type)}${entity.name}${RESET}  ${DIM}${entity._id}${RESET}`)
}

async function cmdWork(args, config) {
  // `cp work <subcommand> ...` — manage works and their author list. The
  // pile<->work side is handled by `cp pile add-work/rm-work`; this is
  // the symmetric surface for the author<->work side, which had no CLI
  // path before.
  //
  // The server has no add-existing-author endpoint on /work — only
  // `PUT /work/:id/auth/create` which creates a new author by name. So we
  // implement add/rm as a read-modify-write on `PUT /work/:id { authors }`.
  // Order is preserved (first listed = primary byline).
  const sub = args[0]
  const rest = args.slice(1)
  if (!sub) {
    console.error('Usage: cp work <add-author|rm-author> <workTarget> <authorTarget>')
    console.error('       cp work <add-editor|rm-editor|add-translator|rm-translator> <workTarget> <authorTarget>')
    console.error('       cp work merge <fromWork> [<fromWork>...] <intoWork> [--yes]')
    return
  }

  if (sub === 'merge') return mergeCommand('work', rest, config)

  // Editors and translators are author records credited apart (#358)
  const role = sub.match(/^(add|rm)-(author|editor|translator)$/)
  if (role) {
    const [, op, kind] = role
    const field = kind + 's'
    const [workInput, authorInput] = rest
    if (!workInput || !authorInput) {
      console.error(`Usage: cp work ${sub} <workTarget> <authorTarget>`)
      return
    }
    const workTarget = await resolveTarget(workInput, 'work', config)
    if (!workTarget) { console.error(`Could not resolve work "${workInput}".`); return }
    const authorTarget = await resolveTarget(authorInput, 'auth', config)
    if (!authorTarget) { console.error(`Could not resolve author "${authorInput}".`); return }

    const info = (await api('GET', `work/${workTarget.id}`, null, config))?.data
    if (!info) { console.error(`Work ${workTarget.id} not found.`); return }
    const current = (info[field] || []).map(a => String(a._id || a))
    const authorId = String(authorTarget.id)

    let next
    if (op === 'add') {
      if (current.includes(authorId)) {
        console.log(`${DIM}Already attached.${RESET}`)
        return
      }
      next = [...current, authorId]
    } else {
      if (!current.includes(authorId)) {
        console.log(`${DIM}Not a${kind === 'author' ? 'n' : ''} ${kind} on this work.${RESET}`)
        return
      }
      next = current.filter(id => id !== authorId)
    }

    await api('PUT', `work/${workTarget.id}`, { [field]: next }, config)
    const verb = op === 'add' ? 'Added' : 'Removed'
    const prep = op === 'add' ? 'to' : 'from'
    console.log(`${GREEN}${verb}${RESET} ${kind} ${authorTarget.id} ${prep} work ${workTarget.id}`)
    return
  }

  console.error(`Unknown work subcommand: ${sub}`)
}

// `cp work merge` / `cp auth merge <from> [<from>...] <into> [--yes]`
// (#360, #356). The last argument is the one kept. Shows what will move
// (a dry run on the server for each), asks once, then merges each.
async function mergeCommand(type, args, config) {
  const flagYes = args.includes('--yes') || args.includes('-y')
  const inputs = args.filter(a => a !== '--yes' && a !== '-y')
  const label = type === 'auth' ? 'author' : 'work'
  if (inputs.length < 2) {
    console.error(`Usage: cp ${type} merge <from${label}> [<from${label}>...] <into${label}> [--yes]`)
    return
  }
  const intoInput = inputs.pop()
  const into = await resolveTarget(intoInput, type, config)
  if (!into) { console.error(`Could not resolve ${label} "${intoInput}".`); return }
  if (refuseMergedNick(into, intoInput, 'merge into')) return
  const froms = []
  for (const fromInput of inputs) {
    const from = await resolveTarget(fromInput, type, config)
    if (!from) { console.error(`Could not resolve ${label} "${fromInput}".`); return }
    if (refuseMergedNick(from, fromInput, 'merge')) return
    if (String(from.id) === String(into.id)) { console.error(`"${fromInput}" is the ${label} being kept.`); return }
    if (!froms.some(f => String(f.id) === String(from.id))) froms.push(from)
  }

  // Each merge runs only if its plan still matches the preview (#369);
  // if one changed, show the new plans for what's left and ask again.
  let remaining = froms
  for (let attempt = 0; remaining.length; attempt++) {
    if (attempt === 3) { console.error('Still changing after 3 previews; try again later.'); return }
    const plans = []
    for (const from of remaining) {
      const plan = (await api('POST', `${type}/${from.id}/merge`, { into: into.id, dryRun: true }, config))?.data
      if (!plan) { console.error('Merge preview failed.'); return }
      plans.push(plan)
    }
    console.log(`Into ${label} ${BOLD}${plans[0].into.name}${RESET} ${DIM}${plans[0].into._id}${RESET}, merge:`)
    for (const plan of plans) {
      const moves = type === 'auth'
        ? [['notes by', plan.notes], ['notes about', plan.notesAbout], ['works', plan.works],
           ['works edited', plan.edited], ['works translated', plan.translated]]
        : [['notes', plan.notes], ['piles', plan.piles], ['ideas', plan.ideas], ['authors', plan.authors],
           ['editors', plan.editors], ['translators', plan.translators]]
      console.log(`  ${BOLD}${plan.from.name}${RESET} ${DIM}${plan.from._id}${RESET}`)
      console.log('    ' + moves.map(([what, n]) => `${n} ${what}`).join(', '))
      if (plan.fields.length) console.log(`    fills in: ${plan.fields.join(', ')}`)
    }
    console.log(`  then deletes ${plans.length === 1 ? 'it' : `those ${plans.length}`}`)

    if (!flagYes) {
      const ok = await confirm('Merge? [y/N] ')
      if (!ok) { console.log('Cancelled.'); return }
    }
    try {
      for (const [i, from] of remaining.entries()) {
        await api('POST', `${type}/${from.id}/merge`, { into: into.id, expect: plans[i].fingerprint }, config)
        console.log(`${GREEN}Merged${RESET} ${plans[i].from.name} into ${plans[i].into.name}`)
        remaining = remaining.filter((f) => f !== from)
      }
    } catch (e) {
      if (e.status !== 409) throw e
      console.error(`${YELLOW}Changed since the preview.${RESET} Here is the plan now:`)
    }
  }
}

// `cp auth split <author> --into "Name A" --into "Name B" [--keep] [--yes]`
// (#356): one author per name in the old one's place everywhere.
async function splitCommand(args, config) {
  const flagYes = args.includes('--yes') || args.includes('-y')
  const keep = args.includes('--keep')
  const names = []
  const positional = []
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--into' && i + 1 < args.length) names.push(args[++i])
    else if (args[i].startsWith('--into=')) names.push(args[i].slice(7))
    else if (!['--yes', '-y', '--keep'].includes(args[i])) positional.push(args[i])
  }
  const input = positional.join(' ').trim()
  if (!input || !names.length) {
    console.error('Usage: cp auth split <author> --into "Name A" --into "Name B" [--keep] [--yes]')
    console.error('  Existing authors are reused by name; --keep keeps the old author record.')
    return
  }
  const target = await resolveTarget(input, 'auth', config)
  if (!target) { console.error(`Could not resolve author "${input}".`); return }
  // Runs only if the plan still matches the preview (#369)
  for (let attempt = 0; attempt < 3; attempt++) {
    const plan = (await api('POST', `auth/${target.id}/split`, { names, keep, dryRun: true }, config))?.data
    if (!plan) { console.error('Split preview failed.'); return }
    console.log(`Split author ${BOLD}${plan.from.name}${RESET} ${DIM}${plan.from._id}${RESET} into:`)
    plan.into.forEach(t => console.log(`  ${t.name}  ${DIM}${t.existing ? t._id : '(new)'}${RESET}`))
    console.log(`  on ${plan.notes} notes by, ${plan.notesAbout} notes about, ${plan.works} works, ` +
      `${plan.edited} edited, ${plan.translated} translated`)
    console.log(plan.deletesOld ? `  then deletes ${plan.from.name}` : `  keeping ${plan.from.name}`)
    if (!flagYes) {
      const ok = await confirm('Split? [y/N] ')
      if (!ok) { console.log('Cancelled.'); return }
    }
    try {
      await api('POST', `auth/${target.id}/split`, { names, keep, expect: plan.fingerprint }, config)
      console.log(`${GREEN}Split${RESET} into ${names.length}`)
      return
    } catch (e) {
      if (e.status !== 409) throw e
      console.error(`${YELLOW}Changed since the preview.${RESET} Here is the plan now:`)
    }
  }
  console.error('Still changing after 3 previews; try again later.')
}

// `cp notes <subcommand>`: operations over many notes (#356).
async function cmdNotes(args, config) {
  const sub = args[0]
  const rest = args.slice(1)
  if (sub === 'link-by-title') {
    const flagYes = rest.includes('--yes') || rest.includes('-y')
    const all = rest.includes('--all')
    const { flags } = parseFlags(rest.filter(a => !['--yes', '-y', '--all'].includes(a)))
    if (!flags.work) {
      console.error('Usage: cp notes link-by-title --work <work> [--title "T"] [--all] [--yes]')
      console.error('  Links notes titled exactly like the work (or --title), ignoring case.')
      console.error('  Only notes with no work, unless --all.')
      return
    }
    const work = await resolveTarget(flags.work, 'work', config)
    if (!work) { console.error(`Could not resolve work "${flags.work}".`); return }
    const body = { work: work.id, title: flags.title, all }
    const plan = (await api('POST', 'note/link-by-title', { ...body, dryRun: true }, config))?.data
    if (!plan) { console.error('Preview failed.'); return }
    console.log(`Notes titled "${plan.title}" → ${BOLD}${plan.work.name}${RESET}: ${plan.matched}` +
      (plan.fromOtherWorks ? ` (${plan.fromOtherWorks} from other works)` : ''))
    plan.notes.forEach(n => console.log(`  ${n.title}  ${DIM}${n._id}${RESET}`))
    if (plan.matched > plan.notes.length) console.log(`  …and ${plan.matched - plan.notes.length} more`)
    if (!plan.matched) return
    if (!flagYes) {
      const ok = await confirm('Link them? [y/N] ')
      if (!ok) { console.log('Cancelled.'); return }
    }
    await api('POST', 'note/link-by-title', body, config)
    console.log(`${GREEN}Linked${RESET} ${plan.matched} notes`)
    return
  }
  return notesQuery(args, config)
}

// `cp notes --group-by title | --no-work | --title-is-work` (#357).
// --ids prints only note ids, one per line, to pipe into `cp set -`.
async function notesQuery(args, config) {
  const jsonFlag = args.includes('--json')
  const idsFlag = args.includes('--ids')
  const { flags } = parseFlags(args.filter(a => !['--json', '--ids', '--no-work', '--title-is-work'].includes(a)))
  const printIds = (ids) => ids.forEach(id => console.log(id))

  if (flags['group-by']) {
    if (flags['group-by'] !== 'title') { console.error('Only --group-by title is supported.'); return }
    const min = Number(flags['min-count']) || 2
    const groups = (await api('GET', `note/title-groups?min=${min}`, null, config))?.data || []
    if (jsonFlag) { console.log(JSON.stringify(groups)); return }
    if (idsFlag) { printIds(groups.flatMap(g => g.ids)); return }
    if (!groups.length) { console.log('No titles shared by that many notes.'); return }
    groups.forEach(g => console.log(`${String(g.count).padStart(5)}  ${CYAN}${g.title}${RESET}` +
      (g.unlinked ? `  ${DIM}${g.unlinked} without a work${RESET}` : '')))
    return
  }

  if (args.includes('--no-work')) {
    const notes = await fetchAllNotes('note/no-work', config)
    if (jsonFlag) { console.log(JSON.stringify(notes)); return }
    if (idsFlag) { printIds(notes.map(n => n._id)); return }
    if (!notes.length) { console.log('Every note has a work.'); return }
    notes.forEach(n => console.log(formatNote(n)))
    console.log(`\n${notes.length} notes without a work`)
    return
  }

  if (args.includes('--title-is-work')) {
    const rows = (await api('GET', 'note/titled-like-work', null, config))?.data || []
    if (jsonFlag) { console.log(JSON.stringify(rows)); return }
    if (idsFlag) { printIds(rows.flatMap(r => r.notes.map(n => n._id))); return }
    if (!rows.length) { console.log('No notes titled like a work they are not on.'); return }
    rows.forEach(r => {
      const loose = r.notes.filter(n => !n.work).length
      console.log(`${String(r.notes.length).padStart(5)}  ${YELLOW}${r.work.name}${RESET}  ${DIM}${r.work._id}` +
        (loose < r.notes.length ? `  (${r.notes.length - loose} on another work)` : '') + RESET)
    })
    console.log(`\n${DIM}Link them with: cp notes link-by-title --work <work>${RESET}`)
    return
  }

  console.error('Usage: cp notes --group-by title [--min-count N]')
  console.error('       cp notes --no-work')
  console.error('       cp notes --title-is-work')
  console.error('       cp notes link-by-title --work <work> [--title "T"] [--all] [--yes]')
  console.error('  --json for JSON, --ids for note ids only (pipe into `cp set -`).')
}

// Groups of near-duplicate names from work/duplicates or auth/duplicates
function printDuplicateGroups(groups, color, describe = () => '') {
  if (!groups.length) { console.log('No near-duplicates.'); return }
  groups.forEach((group, i) => {
    if (i) console.log('')
    group.forEach(item => console.log(`${color}${item.name}${RESET}${describe(item)}  ${DIM}${item._id}${RESET}`))
  })
  console.log(`\n${groups.length} groups`)
}

async function cmdAuth(args, config) {
  // `cp auth <rm|merge> ...` — author maintenance (#359, #360). Showing an
  // author is `cp author`.
  const sub = args[0]
  const rest = args.slice(1)
  if (sub === 'merge') return mergeCommand('auth', rest, config)
  if (sub === 'split') return splitCommand(rest, config)
  if (sub === 'rm') {
    const flagYes = rest.includes('--yes') || rest.includes('-y')
    const input = rest.filter(a => a !== '--yes' && a !== '-y').join(' ').trim()
    if (!input) { console.error('Usage: cp auth rm <author> [--yes]'); return }
    const target = await resolveTarget(input, 'auth', config)
    if (!target) { console.error(`Could not resolve author "${input}".`); return }
    const info = (await api('GET', `auth/${target.id}`, null, config))?.data
    if (!info) { console.error('Not found.'); return }
    const [worksRes, creditsRes, notes, notesAbout] = await Promise.all([
      api('GET', `auth/${target.id}/works`, null, config),
      api('GET', `auth/${target.id}/credits`, null, config),
      fetchAllNotes(`auth/${target.id}/notes`, config),
      fetchAllNotes(`auth/${target.id}/notes-about`, config),
    ])
    const works = worksRes?.data || []
    const edited = creditsRes?.data?.edited || []
    const translated = creditsRes?.data?.translated || []
    const used = works.length + edited.length + translated.length + notes.length + notesAbout.length
    console.log(`Author ${BOLD}${info.name}${RESET} ${DIM}${target.id}${RESET}`)
    if (used) {
      console.log(`  still on works: ${works.length} written, ${edited.length} edited, ${translated.length} translated; ` +
        `${notes.length} notes by, ${notesAbout.length} notes about;`)
      console.log('  deleting removes it from all of them (use `cp auth merge` to move them instead)')
    } else {
      console.log('  not used by any work or note')
    }
    if (!flagYes) {
      const ok = await confirm('Delete? [y/N] ')
      if (!ok) { console.log('Cancelled.'); return }
    }
    await api('DELETE', `auth/${target.id}`, null, config)
    console.log(`${GREEN}Deleted${RESET} author ${info.name}`)
    return
  }
  console.error('Usage: cp auth rm <author> [--yes]')
  console.error('       cp auth merge <fromAuthor> [<fromAuthor>...] <intoAuthor> [--yes]')
  console.error('       cp auth split <author> --into "Name A" --into "Name B" [--keep] [--yes]')
}

async function cmdAllPiles(args, config) {
  const jsonFlag = args.includes('--json')
  const res = await api('GET', 'pile/all', null, config)
  const piles = res?.data || []
  if (jsonFlag) { console.log(JSON.stringify(piles)); return }
  if (!piles.length) { console.log('No piles.'); return }
  piles.forEach(p => console.log(`${MAGENTA}${p.name}${RESET}  ${DIM}${p._id}${RESET}`))
}

async function cmdImport(args, config) {
  const kind = args[0]
  const file = args[1]
  const flagWork = args.find(a => a.startsWith('--work='))?.split('=')[1]
  if (!kind || !file) {
    console.error('Usage: cp import csv <file>')
    console.error('       cp import instapaper <file>')
    console.error('       cp import work <file> --work=<workId>')
    return
  }
  const importList = readFileSync(file, 'utf8')

  if (kind === 'csv') {
    const res = await api('PUT', 'note/import/csv', { importList }, config)
    const n = res?.data
    console.log(`${GREEN}Imported${RESET} ${n ?? '?'} notes`)
    return
  }
  if (kind === 'instapaper') {
    const res = await api('PUT', 'note/import/instapaper', { importList }, config)
    const n = res?.data
    console.log(`${GREEN}Imported${RESET} ${n ?? '?'} notes`)
    return
  }
  if (kind === 'work') {
    if (!flagWork) { console.error('--work=<workId> required for work import.'); return }
    await api('PUT', `note/import/work/${flagWork}`, { notesText: importList }, config)
    console.log(`${GREEN}Imported${RESET} notes into work ${flagWork}`)
    return
  }
  console.error(`Unknown import kind: ${kind}`)
}

async function cmdUpdate(args, config) {
  // `cp update <type> <id|nick> --field=value ...`
  // Generic entity update. For notes, prefer `cp set` / `cp edit`; this
  // covers works, ideas, piles, authors — none of which had an editable
  // path from the CLI before. Field whitelists are enforced server-side
  // (NOTE_WRITABLE / WORK_WRITABLE / etc.) so unknown flags get rejected.
  const type = args[0]
  const idOrNick = args[1]
  if (!type || !idOrNick) {
    console.error('Usage: cp update <type> <id|nick> --field=value [...]')
    console.error('  type: note|work|idea|pile|auth')
    console.error('  examples:')
    console.error('    cp update auth 5f5...02 --name="Tyler Cowen" --birth_year=1962')
    console.error('    cp update work w42 --year=2024 --url=https://...')
    console.error('    cp update pile p7 --name="Status: Read"')
    return
  }
  const valid = new Set(['note', 'work', 'idea', 'pile', 'auth'])
  if (!valid.has(type)) { console.error(`Unknown type: ${type}`); return }

  let id = idOrNick
  if (type !== 'auth' && /^[nwip]\d+$/i.test(idOrNick)) {
    const target = await resolveByNick(idOrNick, config)
    if (!target || target.type !== type) {
      console.error(`Nick ${idOrNick} doesn't resolve to a ${type}.`)
      return
    }
    id = target.id
  }

  const body = {}
  for (const a of args.slice(2)) {
    if (!a.startsWith('--')) continue
    const eq = a.indexOf('=')
    if (eq < 0) {
      // bare --field with no value → set null (e.g. to clear a field)
      body[a.slice(2)] = null
      continue
    }
    const key = a.slice(2, eq)
    let value = a.slice(eq + 1)
    if (/^-?\d+$/.test(value)) value = parseInt(value, 10)
    body[key] = value
  }
  if (!Object.keys(body).length) { console.error('No --field=value pairs given.'); return }

  await api('PUT', `${type}/${id}`, body, config)
  console.log(`${GREEN}Updated${RESET} ${type} ${id}`)
  for (const [k, v] of Object.entries(body)) {
    console.log(`  ${DIM}${k} → ${v}${RESET}`)
  }
}

async function cmdRecentItems(args, config) {
  // `cp recent-items <type>` — recent items of a non-note type, the same
  // data that powers the home page's right-hand column.
  const jsonFlag = args.includes('--json')
  const positional = args.filter(a => a !== '--json')
  const type = positional[0]
  if (!type) { console.error('Usage: cp recent-items <type> [--json]  (notes|authors|works|ideas|piles)'); return }
  const valid = new Set(['notes', 'authors', 'works', 'ideas', 'piles'])
  if (!valid.has(type)) { console.error(`Unknown type: ${type}`); return }

  const res = await api('GET', `stats/recent/${type}`, null, config)
  const items = res?.data || []
  if (jsonFlag) { console.log(JSON.stringify(items)); return }
  if (!items.length) { console.log('No items.'); return }

  if (type === 'notes') {
    items.forEach((n, i) => {
      console.log(`\n${DIM}${i + 1}.${RESET}`)
      console.log(formatNote(n))
    })
    return
  }
  const singular = { authors: 'auth', works: 'work', ideas: 'idea', piles: 'pile' }[type]
  items.forEach((item, i) => {
    console.log(`\n${DIM}${i + 1}.${RESET}`)
    console.log(formatEntity(singular, item))
  })
}

async function cmdLogout(args, config) {
  try {
    await api('POST', 'user/logout', null, config)
  } catch {}
  delete config.token
  saveConfig(config)
  console.log(`${GREEN}Logged out.${RESET}`)
}

async function cmdNickGen(args, config) {
  // `cp nick-gen <id-or-nick>` — generates or returns the existing nick for
  // the resolved entity. Useful when a non-note entity is missing a nick.
  const input = args[0]
  if (!input) { console.error('Usage: cp nick-gen <id-or-nick> [--type note|work|idea|pile]'); return }
  const typeFlag = args.find(a => a.startsWith('--type='))?.split('=')[1]
  const target = await resolveTarget(input, typeFlag, config)
  if (!target) { console.error('Could not resolve target.'); return }
  const nick = await ensureNick(target.type, target.id, config)
  if (nick) {
    console.log(`${GREEN}${nick}${RESET}`)
  } else {
    console.error('Could not generate nick.')
  }
}

function cmdHelp() {
  console.log(`
${BOLD}cplace${RESET} — Commonplace CLI

${BOLD}Finding & viewing${RESET}
  search <query>     Unified search across notes, authors, works, ideas, piles
                     (also: find <query>)
  recent [page]      List recent notes (40 per page)
  earliest [page]    List earliest unfiled notes
  flip               Show a review deck (due notes plus some never reviewed)
  nick <nick>        Look up an entity by its short name
  note <id|nick>     Show a note in full
  show <id|nick>     Show an entity and its contents (pile→notes+works, etc.)
  author <id|name>   Show author info, their works, and standalone notes
  links <id|nick>    Show notes linked to this note

${BOLD}Lists & searches${RESET}
  authors <query>    Search authors (--show: each match's contents)
  ideas <query>      Search ideas (--show: each match's contents)
  works <query>      Search works (--show: each match's notes)
  piles <query>      Search piles (--show: each match's works and notes)
  all-piles          List every pile
  recent-items <type>  Recent items by type (notes|authors|works|ideas|piles)

${BOLD}Piles${RESET}
  pile new "<name>"           Create an empty pile
  pile add-work <pile> <work> Add a work to a pile (each accepts nick/ObjectId/name)
  pile rm-work  <pile> <work> Remove a work from a pile
  pile swap-work <from> <to> <work>
                              Move a work from one pile to another
                              (also: move-work)

${BOLD}Works${RESET}
  work add-author <work> <author>  Attach an existing author to a work
  work rm-author  <work> <author>  Detach an author from a work
  work add-editor / rm-editor <work> <author>
  work add-translator / rm-translator <work> <author>
                                   Credit (or uncredit) an editor or
                                   translator, kept apart from authors
  work merge <from...> <into> [--yes]
                                   Move duplicate works' notes, piles,
                                   ideas and authors to the last one
                                   named, then delete them

${BOLD}Authors${RESET}
  auth rm <author> [--yes]         Delete an author (says what still uses it)
  auth merge <from...> <into> [--yes]
                                   Move duplicate authors' works and notes
                                   to the last one named, then delete them
  auth split <author> --into "A" --into "B" [--keep] [--yes]
                                   Replace a combined author with one per
                                   name everywhere it's used

${BOLD}Cleanup queries${RESET} (--json for JSON; notes queries take --ids)
  notes --group-by title [--min-count N]  Titles shared by several notes
  notes --no-work                         Notes without a work
  notes --title-is-work                   Notes titled like a work they're not on
  works --no-notes                        Works without notes
  works --duplicates                      Near-duplicate work names
  authors --duplicates                    Near-duplicate author names
  authors --combined                      Authors that look like several people

${BOLD}Many notes at once${RESET}
  notes link-by-title --work <work> [--title "T"] [--all] [--yes]
                                   Link notes titled like the work
  set <id,id,...|-> [--work N] [--author N] [--idea N] [--pile N]
                                   Update many notes in one request
                                   (- reads ids or nicks from stdin)

${BOLD}Standalone create${RESET}
  new <work|idea|auth|pile> "<name>"   Create an empty entity of any type
                                       (alias for \`pile new\` when type=pile;
                                       auth warns on an existing name unless
                                       --force)

${BOLD}Bulk export${RESET}
  export --piles "<query>"   Dump matching piles with works+notes as JSON
                             (wildcards and ranges work the same as \`piles\`)

${BOLD}Creating & editing${RESET}
  add [title]        Create a new note and open in browser
  quick <title>      Create a note without opening browser
  capture <title> [--text T] [--author N[,N]] [--work N] [--idea T[,T]] [--pile N]
                     Create a note with metadata in one step
  set <id> [--title T] [--text T] [--author N[,N]] [--work N] [--idea T] [--pile N]
                     Update metadata on an existing note
  edit <id> <field> <value>  Quick update (field: title or text)
  review <id> fast|med|slow  Rate a flip card: how soon to see it again
  update <type> <id> --field=value [...]
                     Update any entity's fields (auth/work/idea/pile/note)
  rm <noteId> [--idea N] [--pile N] [--author N] [--work]
                     Detach an idea/pile/author/work from a note
  delete <id|nick> [--type T] [--yes]
                     Delete a note/work/idea/pile/auth

${BOLD}AI & enrichment${RESET}
  ocr <id|nick>      Run OCR on a note's images
  suggest <id> [--title|--ideas]
                     Get title or idea suggestions for a note

${BOLD}Linking${RESET}
  link <id> <id>     Link two notes
  attach <note> <file...>  Add image files to a note (text is read from them)

${BOLD}Import${RESET}
  import csv <file>
  import instapaper <file>
  import work <file> --work=<workId>

${BOLD}Admin${RESET}
  open <id> [type]   Open an item in the browser
  nick-gen <id|nick> [--type T]   Generate / fetch a nick
  stats              Show counts (notes, authors, works, ideas, piles)
  config [url <url>] Show or set config (server URL)
  login              Authenticate with the server
  logout             Drop the saved token
  ping               Check server status
  backfill-nicks     Backfill nicks for all entity types
  backfill-embeddings  Backfill embeddings for all notes
  help               Show this help

${BOLD}Flags${RESET}
  --json  on read commands (search, show, note, author, piles, works, authors,
          ideas, all-piles, recent, recent-items, earliest, flip, links, stats)
          prints machine-readable JSON instead of formatted output.

${BOLD}Config${RESET}  ~/.commonplace.json
`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

const config = loadConfig()
const [,, cmd, ...args] = process.argv

const commands = {
  login:   cmdLogin,
  search:  cmdSearch,
  // Same thing: the web app's search page is /find, so it's a natural guess.
  find:    cmdSearch,
  note:    cmdNote,
  recent:  cmdRecent,
  earliest: cmdEarliest,
  add:     cmdAdd,
  open:    cmdOpen,
  ping:    cmdPing,
  authors: cmdAuthors,
  author:  cmdAuthor,
  auth:    cmdAuth,
  notes:   cmdNotes,
  ideas:   cmdIdeas,
  works:   cmdWorks,
  piles:   cmdPiles,
  pile:    cmdPile,
  work:    cmdWork,
  new:     cmdNew,
  'all-piles': cmdAllPiles,
  nick:    cmdNick,
  'nick-gen': cmdNickGen,
  show:    cmdShow,
  flip:    cmdFlip,
  review:  cmdReview,
  edit:    cmdEdit,
  config:  cmdConfig,
  quick:   cmdQuick,
  stats:   cmdStats,
  capture: cmdCapture,
  set:     cmdSet,
  rm:      cmdRm,
  delete:  cmdDelete,
  ocr:     cmdOcr,
  suggest: cmdSuggest,
  link:    cmdLink,
  attach:  cmdAttach,
  links:   cmdLinks,
  import:  cmdImport,
  update:  cmdUpdate,
  'recent-items': cmdRecentItems,
  export:  cmdExport,
  logout:  cmdLogout,
  'backfill-nicks': cmdBackfillNicks,
  'backfill-embeddings': cmdBackfillEmbeddings,
  help:    async () => cmdHelp(),
}

if (!cmd || !commands[cmd]) {
  if (cmd) console.error(`\x1b[31mUnknown command:\x1b[0m ${cmd}  (see the list below)`)
  cmdHelp()
  process.exit(cmd ? 1 : 0)
}

commands[cmd](args, config).catch(e => {
  const msg = e.cause?.code === 'ECONNREFUSED' || e.message === 'fetch failed'
    ? `Server not reachable at ${config.url || DEFAULT_URL} — is it running?`
    : e.message
  console.error(`\x1b[31mError:\x1b[0m ${msg}`)
  process.exit(1)
})
