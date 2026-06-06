#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
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
    const errText = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${errText}`)
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
  const nick = item.nick ? `${DIM}:${item.nick}${RESET}` : ''
  let meta = ''
  if (type === 'work') {
    const authorStr = joinAuthorNames(item.authors)
    if (authorStr) meta = ` ${DIM}— ${authorStr}${RESET}`
    if (item.year) meta += ` ${DIM}(${item.year})${RESET}`
  }
  return `${BOLD}${color}[${label}]${RESET} ${name}${meta}${nick ? '  ' + nick : ''}\n  ${DIM}${item._id}${RESET}`
}

// Map a nick (e.g. "p12345", "n42") to {type, id} by hitting /nick/:nick.
// Returns null if the nick can't be resolved.
async function resolveByNick(nick, config) {
  try {
    const res = await api('GET', `nick/${nick}`, null, config)
    const data = res?.data
    if (!data) return null
    if (data.note) return { type: 'note', id: data.note }
    if (data.work) return { type: 'work', id: data.work }
    if (data.idea) return { type: 'idea', id: data.idea }
    if (data.pile) return { type: 'pile', id: data.pile }
  } catch {}
  return null
}

// Resolve <id-or-nick> to {type, id}. If a nick prefix matches the
// nick-pattern (letter + digits), look it up; otherwise treat as an
// ObjectId and require a fallbackType.
async function resolveTarget(input, fallbackType, config) {
  if (!input) return null
  if (/^[nwip]\d+$/i.test(input)) {
    const resolved = await resolveByNick(input, config)
    if (resolved) return resolved
    return null
  }
  if (fallbackType) return { type: fallbackType, id: input }
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
  if (!query) { console.error('Usage: cplace search <query> [--json]'); return }

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
  let id = args[0]
  if (!id) { console.error('Usage: cplace note <id|nick>'); return }
  let resolvedNick = null
  if (/^[nwip]\d+$/.test(id)) {
    resolvedNick = id
    const nickRes = await api('GET', `nick/${id}`, null, config)
    const noteId = nickRes?.data?.note
    if (!noteId) { console.log('Nick not found.'); return }
    id = noteId
  }
  const [res, nickRes] = await Promise.all([
    api('GET', `note/${id}`, null, config),
    resolvedNick ? Promise.resolve(null) : ensureNick('note', id, config),
  ])
  const note = res?.data
  if (!note) { console.log('Not found.'); return }
  note.nick = resolvedNick || nickRes
  console.log('\n' + formatNote(note, { full: true }))
}

async function cmdRecent(args, config) {
  const page = parseInt(args[0]) || 1
  const res = await api('GET', `note/all/${page}`, null, config)
  const notes = res?.data || []
  if (!notes.length) { console.log('No notes.'); return }
  const nicks = await Promise.all(notes.map(n => fetchNick('note', n._id, config)))
  notes.forEach((note, i) => {
    note.nick = nicks[i]
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
  const res = await api('GET', 'stats', null, config)
  const d = res?.data
  if (!d) { console.log('No stats.'); return }
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

async function resolveOrCreate(type, name, config) {
  const ac = await api('POST', `${type}/autocomplete`, { string: name }, config)
  const items = ac?.data || []
  if (items.length) return items[0]._id
  const created = await api('POST', type, { name }, config)
  return created?._id || created?.data?._id
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
    for (const name of flags.author.split(',').map(s => s.trim()).filter(Boolean)) {
      const aid = await resolveOrCreate('auth', name, config)
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
    for (const tag of flags.idea.split(',').map(s => s.trim()).filter(Boolean)) {
      await api('PUT', `note/${id}/idea/create`, { name: tag }, config)
      if (!isJson) console.log(`${DIM}  idea → ${tag}${RESET}`)
    }
  }

  if (flags.pile) {
    await api('PUT', `note/${id}/pile/create`, { name: flags.pile }, config)
    if (!isJson) console.log(`${DIM}  pile → ${flags.pile}${RESET}`)
  }

  if (isJson) {
    const nick = await fetchNick('note', id, config)
    console.log(JSON.stringify({ id, nick, title, url: urlFor('note', id) }))
  }
}

async function cmdSet(args, config) {
  const id = args[0]
  const { flags } = parseFlags(args.slice(1))
  if (!id) { console.error('Usage: cplace set <id> [--author NAME] [--work NAME] [--idea TAG] [--pile NAME] [--title TEXT] [--text TEXT]'); return }

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
    for (const name of flags.author.split(',').map(s => s.trim()).filter(Boolean)) {
      const aid = await resolveOrCreate('auth', name, config)
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
    for (const tag of flags.idea.split(',').map(s => s.trim()).filter(Boolean)) {
      await api('PUT', `note/${id}/idea/create`, { name: tag }, config)
      console.log(`${DIM}  idea → ${tag}${RESET}`)
    }
  }

  if (flags.pile) {
    await api('PUT', `note/${id}/pile/create`, { name: flags.pile }, config)
    console.log(`${DIM}  pile → ${flags.pile}${RESET}`)
  }

  console.log(`${GREEN}Done.${RESET}`)
}

async function cmdOpen(args, config) {
  let id = args[0]
  if (!id) { console.error('Usage: cplace open <id|nick>'); return }
  let type = 'note'
  if (/^[nwip]\d+$/.test(id)) {
    const nickRes = await api('GET', `nick/${id}`, null, config)
    const data = nickRes?.data
    if (!data) { console.error('Nick not found.'); return }
    if (data.note)  { id = data.note; type = 'note' }
    if (data.work)  { id = data.work; type = 'work' }
    if (data.idea)  { id = data.idea; type = 'idea' }
    if (data.pile)  { id = data.pile; type = 'pile' }
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

async function cmdAuthors(args, config) {
  const query = args.join(' ')
  if (!query) { console.error('Usage: cp authors <query>'); return }
  const res = await api('POST', 'auth/autocomplete', { string: query }, config)
  const authors = res?.data || []
  if (!authors.length) { console.log('No authors found.'); return }
  authors.forEach(a => console.log(`${GREEN}${a.name}${RESET}  ${DIM}${a._id}${RESET}`))
}

async function cmdIdeas(args, config) {
  const query = args.join(' ')
  if (!query) { console.error('Usage: cp ideas <query>'); return }
  const res = await api('POST', 'idea/autocomplete', { string: query }, config)
  const ideas = res?.data || []
  if (!ideas.length) { console.log('No ideas found.'); return }
  ideas.forEach(i => console.log(`${BLUE}${i.name}${RESET}  ${DIM}${i._id}${RESET}`))
}

async function cmdWorks(args, config) {
  const query = args.join(' ')
  if (!query) { console.error('Usage: cp works <query>'); return }
  const res = await api('POST', 'work/autocomplete', { string: query }, config)
  const works = res?.data || []
  if (!works.length) { console.log('No works found.'); return }
  works.forEach(w => {
    const auth = w.author?.name ? ` ${DIM}— ${w.author.name}${RESET}` : ''
    console.log(`${YELLOW}${w.name}${RESET}${auth}  ${DIM}${w._id}${RESET}`)
  })
}

async function cmdPiles(args, config) {
  const query = args.join(' ')
  if (!query) { console.error('Usage: cp piles <query>'); return }
  const res = await api('POST', 'pile/autocomplete', { string: query }, config)
  const piles = res?.data || []
  if (!piles.length) { console.log('No piles found.'); return }
  piles.forEach(p => console.log(`${MAGENTA}${p.name}${RESET}  ${DIM}${p._id}${RESET}`))
}

async function cmdFlip(args, config) {
  const res = await api('GET', 'note/flip', null, config)
  const notes = res?.data || []
  if (!notes.length) { console.log('No notes.'); return }
  notes.forEach((note, i) => {
    console.log(`\n${DIM}${i + 1}.${RESET}`)
    console.log(formatNote(note))
  })
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
  const input = args[0]
  if (!input) {
    console.error('Usage: cp show <id|nick>')
    console.error('  Shows the entity and its contents (pile→notes+works, work→notes,')
    console.error('  auth→works+notes, idea→notes, note→full).')
    return
  }
  // Without a nick prefix we can't infer type — require a nick.
  const target = await resolveTarget(input, null, config)
  if (!target) {
    console.error('Could not resolve — pass a nick (e.g. p12345) or use a type-specific command.')
    return
  }
  const { type, id } = target

  if (type === 'note') {
    const res = await api('GET', `note/${id}`, null, config)
    const note = Array.isArray(res?.data) ? res.data[0] : res?.data
    if (!note) { console.log('Not found.'); return }
    note.nick = input
    console.log('\n' + formatNote(note, { full: true }))
    return
  }

  // Header for the entity itself.
  let info = null
  try { info = (await api('GET', `${type}/${id}`, null, config))?.data } catch {}
  const header = info
    ? formatEntity(type, { ...info, nick: input })
    : `${BOLD}${typeColor(type)}[${typeLabel(type)}]${RESET}  ${DIM}${id}${RESET}`
  console.log('\n' + header)

  // Contents by type.
  if (type === 'pile') {
    const [notesRes, worksRes] = await Promise.all([
      api('GET', `pile/${id}/notes`, null, config),
      api('GET', `pile/${id}/works`, null, config),
    ])
    const notes = notesRes?.data || []
    const works = worksRes?.data || []
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
    const res = await api('GET', `idea/${id}/notes`, null, config)
    const notes = res?.data || []
    console.log(`\n${BOLD}Notes${RESET} (${notes.length})`)
    if (!notes.length) { console.log('(none)'); return }
    notes.forEach(n => console.log('  ' + formatNote(n).split('\n').join('\n  ')))
    return
  }

  if (type === 'work') {
    const res = await api('GET', `work/${id}/notes`, null, config)
    const notes = res?.data || []
    console.log(`\n${BOLD}Notes${RESET} (${notes.length})`)
    if (!notes.length) { console.log('(none)'); return }
    notes.forEach(n => console.log('  ' + formatNote(n).split('\n').join('\n  ')))
    return
  }
}

async function cmdAuthor(args, config) {
  // `cp author <id-or-name>` — shows works + notes for one author. Accepts
  // either an ObjectId or a name we'll autocomplete to a single match.
  const input = args.join(' ').trim()
  if (!input) { console.error('Usage: cp author <id|name>'); return }
  let id = input
  if (!/^[0-9a-f]{24}$/i.test(input)) {
    const ac = await api('POST', 'auth/autocomplete', { string: input }, config)
    const matches = ac?.data || []
    if (!matches.length) { console.log('No match.'); return }
    if (matches.length > 1) {
      console.log(`Multiple matches — be more specific or pass the ObjectId:`)
      matches.forEach(a => console.log(`  ${a.name}  ${DIM}${a._id}${RESET}`))
      return
    }
    id = matches[0]._id
  }
  const info = (await api('GET', `auth/${id}`, null, config))?.data
  if (!info) { console.log('Not found.'); return }
  console.log('\n' + formatEntity('auth', info))

  const [worksRes, notesRes] = await Promise.all([
    api('GET', `auth/${id}/works`, null, config),
    api('GET', `auth/${id}/notes`, null, config),
  ])
  const works = worksRes?.data || []
  const notes = notesRes?.data || []
  if (works.length) {
    console.log(`\n${BOLD}Works${RESET} (${works.length})`)
    works.forEach(w => console.log('  ' + formatEntity('work', w).split('\n').join('\n  ')))
  }
  if (notes.length) {
    // Filter out notes whose work was already listed, same as the web UI.
    const workIds = new Set(works.map(w => String(w._id)))
    const standalone = notes.filter(n => !n.work?._id || !workIds.has(String(n.work._id)))
    console.log(`\n${BOLD}Notes${RESET} (${standalone.length})`)
    standalone.forEach(n => console.log('  ' + formatNote(n).split('\n').join('\n  ')))
  }
  if (!works.length && !notes.length) console.log('\n(empty)')
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
  // `cp rm <noteId> [--idea NAME|--pile NAME|--author NAME|--work]`
  // Detaches a relation from a note. --work has no value (clears the work).
  const noteId = args[0]
  if (!noteId) { console.error('Usage: cp rm <noteId> [--idea NAME|--pile NAME|--author NAME|--work]'); return }
  const { flags } = parseFlags(args.slice(1))

  if (flags.idea) {
    const ac = await api('POST', 'idea/autocomplete', { string: flags.idea }, config)
    const idea = (ac?.data || []).find(i => i.name === flags.idea) || (ac?.data || [])[0]
    if (!idea) { console.error(`No idea matching "${flags.idea}".`); return }
    await api('DELETE', `note/${noteId}/idea/${idea._id}`, null, config)
    console.log(`${DIM}  idea ✕ ${idea.name}${RESET}`)
  }

  if (flags.pile) {
    const ac = await api('POST', 'pile/autocomplete', { string: flags.pile }, config)
    const pile = (ac?.data || []).find(p => p.name === flags.pile) || (ac?.data || [])[0]
    if (!pile) { console.error(`No pile matching "${flags.pile}".`); return }
    await api('DELETE', `note/${noteId}/pile/${pile._id}`, null, config)
    console.log(`${DIM}  pile ✕ ${pile.name}${RESET}`)
  }

  if (flags.author) {
    // Removing an author = rewrite the authors array without that one.
    const noteRes = await api('GET', `note/${noteId}`, null, config)
    const note = Array.isArray(noteRes?.data) ? noteRes.data[0] : noteRes?.data
    const current = (note?.authors || []).filter(a => a)
    const filtered = current.filter(a => (a.name || '') !== flags.author)
    await api('PUT', `note/${noteId}`, { authors: filtered.map(a => a._id) }, config)
    console.log(`${DIM}  author ✕ ${flags.author}${RESET}`)
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
  const input = args[0]
  if (!input) { console.error('Usage: cp links <noteId|nick>'); return }
  const target = await resolveTarget(input, 'note', config)
  if (!target) { console.error('Could not resolve note.'); return }
  const res = await api('GET', `link/note/${target.id}`, null, config)
  const links = res?.data || []
  if (!links.length) { console.log('No links.'); return }
  console.log(`${BOLD}Links${RESET} (${links.length})`)
  links.forEach(l => {
    console.log(`  ${l.nick || ''}  ${l.title || '(untitled)'}  ${DIM}${l._id}${RESET}`)
  })
}

async function cmdEarliest(args, config) {
  const page = parseInt(args[0]) || 1
  const res = await api('GET', `note/file/${page}`, null, config)
  const notes = res?.data || []
  if (!notes.length) { console.log('No notes.'); return }
  notes.forEach((note, i) => {
    const num = (page - 1) * 40 + i + 1
    console.log(`\n${DIM}${num}.${RESET}`)
    console.log(formatNote(note))
  })
}

async function cmdAllPiles(args, config) {
  const res = await api('GET', 'pile/all', null, config)
  const piles = res?.data || []
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
  recent [page]      List recent notes (40 per page)
  earliest [page]    List earliest unfiled notes
  flip               Show random notes
  nick <nick>        Look up an entity by its short name
  note <id|nick>     Show a note in full
  show <id|nick>     Show an entity and its contents (pile→notes+works, etc.)
  author <id|name>   Show author info, their works, and standalone notes
  links <id|nick>    Show notes linked to this note

${BOLD}Lists & searches${RESET}
  authors <query>    Search authors
  ideas <query>      Search ideas
  works <query>      Search works
  piles <query>      Search piles
  all-piles          List every pile

${BOLD}Creating & editing${RESET}
  add [title]        Create a new note and open in browser
  quick <title>      Create a note without opening browser
  capture <title> [--text T] [--author N[,N]] [--work N] [--idea T[,T]] [--pile N]
                     Create a note with metadata in one step
  set <id> [--title T] [--text T] [--author N[,N]] [--work N] [--idea T] [--pile N]
                     Update metadata on an existing note
  edit <id> <field> <value>  Quick update (field: title or text)
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
  ping               Check server status
  backfill-nicks     Backfill nicks for all entity types
  backfill-embeddings  Backfill embeddings for all notes
  help               Show this help

${BOLD}Config${RESET}  ~/.commonplace.json
`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

const config = loadConfig()
const [,, cmd, ...args] = process.argv

const commands = {
  login:   cmdLogin,
  search:  cmdSearch,
  note:    cmdNote,
  recent:  cmdRecent,
  earliest: cmdEarliest,
  add:     cmdAdd,
  open:    cmdOpen,
  ping:    cmdPing,
  authors: cmdAuthors,
  author:  cmdAuthor,
  ideas:   cmdIdeas,
  works:   cmdWorks,
  piles:   cmdPiles,
  'all-piles': cmdAllPiles,
  nick:    cmdNick,
  'nick-gen': cmdNickGen,
  show:    cmdShow,
  flip:    cmdFlip,
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
  links:   cmdLinks,
  import:  cmdImport,
  'backfill-nicks': cmdBackfillNicks,
  'backfill-embeddings': cmdBackfillEmbeddings,
  help:    async () => cmdHelp(),
}

if (!cmd || !commands[cmd]) {
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
