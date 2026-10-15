import { Router } from 'express'
import controllers, {
  reqAddIdea,
  reqAddImageToNote,
  reqAddNewIdea,
  reqAddNewPile,
  reqAddNewWork,
  reqAddPile,
  reqAddWork,
  reqDeleteNote,
  reqFindNotesByString,
  reqGetEarliestNotesToFile,
  reqGetImageForNote,
  reqGetNoteByNick,
  reqGetNoteDetails,
  reqGetRandomNotes,
  reqGetRecentNotes,
  reqGetSuggestedIdeasForNote,
  reqGetSuggestionForNoteTitle,
  reqRemoveIdeaFromNote,
  reqRemoveImageFromNote,
  reqRemovePileFromNote,
  reqUpdateNote,
  reqOcrForNote,
  reqBulkOcrForNotes,
  reqBulkSuggestTitlesForNotes,
  reqBulkGetNotesForMarkdown,
  reqBulkImportForWork,
  reqBulkImportInstapaper,
  reqBulkImportNotesCSV,
  reqBulkEmbedNotes,
  reqUnifiedSearch,
  reqFilterNotes,
} from './note.controllers'
import { asyncWrapper } from '../../utils/requests.js'
import { requireObjectIdParam } from '../../utils/validateObjectId.js'
import { recordOpened } from '../../utils/default.controllers.js'
import Note from './note.model.js'

const router = Router()

router.route('/find').put(asyncWrapper(reqFindNotesByString, 200))

router.route('/').post(controllers.createOne)

router.route('/all/:skip').get(asyncWrapper(reqGetRecentNotes, 200))

router.route('/file/:skip').get(asyncWrapper(reqGetEarliestNotesToFile, 200))

router.route('/flip').get(asyncWrapper(reqGetRandomNotes, 200))

router.route('/nick/:nick').get(asyncWrapper(reqGetNoteByNick, 200))

router.route('/:id/idea').put(asyncWrapper(reqAddIdea, 200))
router.route('/:id/idea/create').put(asyncWrapper(reqAddNewIdea, 201))
router
  .route('/:id/idea/:ideaId')
  .delete(asyncWrapper(reqRemoveIdeaFromNote, 200))

router.route('/:id/pile').put(asyncWrapper(reqAddPile, 200))
router.route('/:id/pile/create').put(asyncWrapper(reqAddNewPile, 201))
router
  .route('/:id/pile/:pileId')
  .delete(asyncWrapper(reqRemovePileFromNote, 200))

router.route('/:id/work').put(asyncWrapper(reqAddWork, 200))
router.route('/:id/work/create').put(asyncWrapper(reqAddNewWork, 201))
// TODO: router.route('/:id/work/').delete()

// Image endpoints concatenate req.params.id into a filesystem path; require an
// ObjectId here to prevent path traversal via crafted ids.
router.route('/:id/image').put(requireObjectIdParam('id'), reqAddImageToNote)
router.route('/:id/images/:image').get(requireObjectIdParam('id'), reqGetImageForNote)
router.route('/:id/image/').delete(requireObjectIdParam('id'), reqRemoveImageFromNote)

router.route('/:id/title/suggest').get(reqGetSuggestionForNoteTitle)
router.route('/:id/ideas/suggest').get(reqGetSuggestedIdeasForNote)

router.route('/:id/ocr').get(asyncWrapper(reqOcrForNote, 200))

router.route('/bulk-ocr').post(asyncWrapper(reqBulkOcrForNotes, 200))

router
  .route('/bulk-suggest-titles')
  .post(asyncWrapper(reqBulkSuggestTitlesForNotes, 200))

router
  .route('/bulk-markdown')
  .post(asyncWrapper(reqBulkGetNotesForMarkdown, 200))

router.route('/import/work/:work').put(asyncWrapper(reqBulkImportForWork, 200))

router.route('/import/csv').put(asyncWrapper(reqBulkImportNotesCSV, 200))

router.route('/import/instapaper').put(asyncWrapper(reqBulkImportInstapaper, 200))

router.route('/bulk-embed').post(asyncWrapper(reqBulkEmbedNotes, 200))

router.route('/unified-search').post(asyncWrapper(reqUnifiedSearch, 200))
router.route('/filter').get(asyncWrapper(reqFilterNotes, 200))

router.route('/:id/opened').post(requireObjectIdParam('id'), asyncWrapper(recordOpened(Note), 200))

router
  .route('/:id')
  .get(asyncWrapper(reqGetNoteDetails, 200))
  .put(asyncWrapper(reqUpdateNote, 200))
  .delete(requireObjectIdParam('id'), asyncWrapper(reqDeleteNote, 200))

export default router
