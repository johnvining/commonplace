// Shared API types between site/ and server/. The Mongoose document shapes
// here describe the data the API returns over the wire (lean, populated, and
// JSON-serialized) — not the in-memory Mongoose Document class. Server-side
// code that needs the Mongoose Document type should layer those on top.
//
// IDs are strings on the wire after JSON.stringify, even though Mongoose
// stores ObjectIds. Tests confirm: every endpoint that returns a populated
// note has _id as a string.

export type EntityId = string

export type EntityType = 'note' | 'work' | 'idea' | 'pile' | 'auth'

// --- Entity shapes (as returned by the API after .lean()) ---

export interface Author {
  _id: EntityId
  name: string
  birth_year?: number | null
  death_year?: number | null
  usernames?: string[]
  createdAt?: string
  updatedAt?: string
  // Annotated by /autocomplete/with-counts:
  note_count?: number
  work_count?: number
}

export interface Idea {
  _id: EntityId
  name: string
  createdAt?: string
  updatedAt?: string
  note_count?: number
}

export interface Pile {
  _id: EntityId
  name: string
  createdAt?: string
  updatedAt?: string
  note_count?: number
  work_count?: number
}

export interface Work {
  _id: EntityId
  name: string
  url?: string | null
  year?: number | null
  // Populated when fetched via getWorkInfo / autocomplete; raw ObjectId string elsewhere
  author?: Author | EntityId | null
  piles?: Pile[] | EntityId[]
  createdAt?: string
  updatedAt?: string
  note_count?: number
}

export interface Note {
  _id: EntityId
  title?: string
  text?: string
  take?: string
  url?: string | null
  year?: number | null
  page?: string | null
  // Populated forms when fetched via findNotesAndPopulate; ObjectId strings elsewhere
  author?: Author | EntityId | null
  work?: Work | EntityId | null
  ideas?: Idea[] | EntityId[]
  piles?: Pile[] | EntityId[]
  images?: string[]
  // Hybrid-search annotations
  nick?: string | null
  _hybridScore?: number
  _semantic?: boolean
  // OCR/embeddings — server omits these from list views via LIST_OMIT
  ocrText?: string | null
  embedding?: number[]
  embeddingHash?: string
  createdAt?: string
  updatedAt?: string
}

export interface Nick {
  _id: EntityId
  key: string
  note?: EntityId
  work?: EntityId
  idea?: EntityId
  pile?: EntityId
}

export interface Link {
  _id: EntityId
  left_note: EntityId
  right_note: EntityId
}

// --- Response envelopes ---

// asyncWrapper wraps successful results as `{ data: T }`.
export interface ApiResponse<T> {
  data: T
}

export interface UnifiedSearchResult {
  type: EntityType
  item: Note | Author | Work | Idea | Pile
  score: number
}

export interface BulkResult<T = unknown> {
  noteId: EntityId
  success: boolean
  error?: string
  // Specific fields per operation (titleUpdated, textUpdated, suggestedTitle, etc.)
  [key: string]: T | unknown
}

export interface StatsCounts {
  notes: number
  authors: number
  ideas: number
  works: number
  piles: number
}

export interface NickBackfillResult {
  total: number
  already_had_nick: number
  created: number
  failed: number
}
