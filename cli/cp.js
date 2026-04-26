#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { createInterface } from 'readline'
import { exec } from 'child_process'

const CONFIG_PATH = join(homedir(), '.commonplace.json')
const DEFAULT_URL = 'http://localhost:3000/api/'

// ── Config ────────────────────────────────────────────────────────────────────

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) return { url: DEFAULT_URL, token: null }
  try { return JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) } catch { return { url: DEFAULT_URL, token: null } }
}

function saveConfig(config) {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
}

// ── HTTP ──────────────────────────────────────────────────────────────────────

async function api(method, path, body, config) {
  const url = (config.url || DEFAULT_URL) + path
  const headers = { 'Content-Type': 'application/json' }
  if (config.token) headers['Cookie'] = `token=${config.token}`
  const opts = { method, headers }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(url, opts)
  if (res.status === 401) throw new Error('Not authenticated — run: cp login')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  // Capture Set-Cookie on login
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) {
    const match = setCookie.match(/token=([^;]+)/)
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
  let meta = ''
  if (type === 'work' && item.author?.name) meta = ` ${DIM}— ${item.author.name}${RESET}`
  if (type === 'work' && item.year) meta += ` ${DIM}(${item.year})${RESET}`
  return `${BOLD}${color}[${label}]${RESET} ${name}${meta}\n  ${DIM}${item._id}${RESET}`
}

function formatResult(entry) {
  if (entry.type === 'note') return formatNote(entry.item)
  return formatEntity(entry.type, entry.item)
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
  const query = args.join(' ')
  if (!query) { console.error('Usage: cp search <query>'); return }

  process.stdout.write(`Searching for "${query}"...\r`)
  const res = await api('POST', 'note/unified-search', { query, limit: 20 }, config)
  const results = res?.data || []
  process.stdout.write('\x1b[2K\r')

  if (!results.length) { console.log('No results.'); return }
  results.forEach((entry, i) => {
    console.log(`\n${DIM}${i + 1}.${RESET}`)
    console.log(formatResult(entry))
  })
}

async function cmdNote(args, config) {
  const id = args[0]
  if (!id) { console.error('Usage: cp note <id>'); return }
  const res = await api('GET', `note/${id}`, null, config)
  const note = res?.data
  if (!note) { console.log('Not found.'); return }
  console.log('\n' + formatNote(note, { full: true }))
}

async function cmdRecent(args, config) {
  const page = parseInt(args[0]) || 1
  const res = await api('GET', `note/all/${page}`, null, config)
  const notes = res?.data || []
  if (!notes.length) { console.log('No notes.'); return }
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
  console.log(`${GREEN}Created:${RESET} ${note._id}`)
  console.log(urlFor('note', note._id) + '/edit')
  exec(`open "${urlFor('note', note._id)}/edit"`)
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
