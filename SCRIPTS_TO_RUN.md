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

Nothing pending. The batch deployed on 2026-10-16 ran trim-entity-names,
add-work-ideas and ocr-backlog; the Maintenance page shows their output.

New tasks are added to `server/src/resources/maintenance/tasks.ts` and
listed here.
