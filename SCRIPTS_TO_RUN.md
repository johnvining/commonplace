# Scripts to run

One-off data fixes to run against the real database once the current
batch of updates is deployed.

**Run them from the app:** open **Maintenance** (the sidebar shows
"N maintenance tasks to run", or type `maintenance` in the search bar).
Run them top to bottom. Use **Dry run** first to see what each would
change; **Run** asks for confirmation. Each is safe to run twice, and the
page marks a task done once it has run successfully.

From a shell instead (same tasks, recorded the same way):

```
cd server
npm run maintenance                          # list tasks
npm run maintenance -- <task> --dry-run
npm run maintenance -- <task>
```

On the Pi, run those inside the server container:
`docker exec -it $(docker ps -qf name=commonplace-server) npm run maintenance -- <task>`.

## Pending

| Order | Task | Issue | What it does |
|---|---|---|---|
| 1 | `trim-entity-names` | #51 | Trims stray spaces from author, work, idea and pile names, so they can be found again. Lists blank names and names that now clash, to fix by hand. |
| 2 | `add-work-ideas` | #216 | Optional. Gives every work an empty ideas list. |
| 3 | `ocr-backlog` | #305 | Fills in the text of old image notes from their images. Uses OpenAI, one call per image not already read; dry run shows the count. `npm run ocr-backlog -- --limit 20` does the newest 20 first. |

New tasks are added to `server/src/resources/maintenance/tasks.ts` and
listed here.
