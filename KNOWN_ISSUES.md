# Known Issues

- **Entity-notes endpoints silently truncate at 500.** `reqGetNotesFor{Author,Idea,Pile,Work}` and `reqGetAllNotesForAuthor` cap responses at 500 notes (commit 127b2d6). Server already accepts `?skip=&limit=`, but the client has no paged UI — entities with more than 500 notes show only the most-recently-updated 500, with no indication more exist. Fix: add a "load more" / paged UI on the client, or return a count + `hasMore` flag from the endpoint and surface it.
