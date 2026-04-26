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
  const headers = { 'Content-Type': 'application/json' }
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

function formatNote(note, { full = false } = {}) {
  const title = note.title || '(untitled)'
  const author = note.author?.name ? `${DIM}${note.author.name}${RESET}` : ''
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
  if (type === 'work' && item.author?.name) meta = ` ${DIM}— ${item.author.name}${RESET}`
  if (type === 'work' && item.year) meta += ` ${DIM}(${item.year})${RESET}`
  return `${BOLD}${color}[${label}]${RESET} ${name}${meta}${nick ? '  ' + nick : ''}\n  ${DIM}${item._id}${RESET}`
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
    const authorId = await resolveOrCreate('auth', flags.author, config)
    if (authorId) {
      await api('PUT', `note/${id}`, { author: authorId }, config)
      if (!isJson) console.log(`${DIM}  author → ${flags.author}${RESET}`)
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
    const authorId = await resolveOrCreate('auth', flags.author, config)
    if (authorId) {
      await api('PUT', `note/${id}`, { author: authorId }, config)
      console.log(`${DIM}  author → ${flags.author}${RESET}`)
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
  const id = args[0]
  const type = args[1] || 'note'
  if (!id) { console.error('Usage: cp open <id> [type]'); return }
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

function cmdHelp() {
  console.log(`
${BOLD}cplace${RESET} — Commonplace CLI

${BOLD}Commands${RESET}
  login              Authenticate with the server
  search <query>     Unified search across notes, authors, works, ideas, piles
  note <id>          Show a note in full
  recent [page]      List recent notes (40 per page)
  add [title]        Create a new note and open it in the browser
  open <id> [type]   Open an item in the browser (type: note, auth, work, idea, pile)
  nick <nick>        Look up a note by its short name
  authors <query>    Search authors
  ideas <query>      Search ideas
  works <query>      Search works
  piles <query>      Search piles
  quick <title>      Create a note without opening browser
  capture <title> [--author NAME] [--work NAME] [--idea TAG] [--pile NAME]
                     Create a note with metadata in one step
  set <id> [--author NAME] [--work NAME] [--idea TAG] [--pile NAME] [--title T] [--text T]
                     Update metadata on an existing note
  flip               Show random notes
  stats              Show counts (notes, authors, works, ideas, piles)
  edit <id> <field> <value>  Update a note's title or text
  config [url <url>] Show or set config (server URL)
  ping               Check server status
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
  add:     cmdAdd,
  open:    cmdOpen,
  ping:    cmdPing,
  authors: cmdAuthors,
  ideas:   cmdIdeas,
  works:   cmdWorks,
  piles:   cmdPiles,
  nick:    cmdNick,
  flip:    cmdFlip,
  edit:    cmdEdit,
  config:  cmdConfig,
  quick:   cmdQuick,
  stats:   cmdStats,
  capture: cmdCapture,
  set:     cmdSet,
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
