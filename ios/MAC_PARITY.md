# Mac parity matrix

Web routes and iOS screens mapped to the native Mac app. Status is
checked during Phase 4/6; interaction is the desktop model for each.

| Surface | Web | iOS | Mac surface | Desktop interaction |
| --- | --- | --- | --- | --- |
| Notes home | `/` RecentList | NotesView | MacRootView detail | Sidebar sections, ↑/↓ list, ⌘N |
| Note | `/note/:id` | NoteDetailView | NoteDetailView in split + own window | ⌘-click/context = new window, tabs |
| Time | `/time` | TimeView | TimeView + MenuBarExtra | Menu Time > Start/Stop, menu-bar stop |
| Piles | `/piles`, `/pile/:id` | PileList/Detail | Same screens in split | Context menus, new window |
| Works | `/works`, `/work/:id`, `/read/:id` | EntityViews, ReadView | Same in split | New window per work |
| Authors | `/authors`, `/author/:id` | EntityViews | Same in split | New window |
| Ideas | `/ideas`, `/idea/:id` | EntityViews | Same in split | New window |
| Search | SearchBar overlay | SearchView | ⌘K palette + Search section | Nick jump, recent |
| Flip | `/flip` | FlipView | FlipView | ←/→ + rating keys |
| Starred | Sidebar pins | PinsView | Starred section | Click opens, pending markers |
| Files | `/files` | FileListView | Files section | Drag in |
| Import | `/load` | ImportView | Import section + File menu | File picker / paste |
| Maintenance | `/maintenance` | MaintenanceView | Maintenance section | Dry run / run polling |
| Settings | Login/settings | SettingsView | Settings scene (⌘,) | Server URL, password |
| Help | HelpOverlay | HelpView | Help window | Shortcut list |

Parity rules: same Kit/API, same offline pin queue, same timer
persistence keys, serif content + small sans controls (web tokens).
