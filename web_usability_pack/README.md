# Web Usability Pack

Small improvements for the daily work in the Odoo 19 web client (Community).
Every feature can be switched off on its own.

| Feature | Default | System parameter |
|---|---|---|
| Pager repeated at the bottom of views | on | `web_usability_pack.bottom_pager` |
| Page size selector, first / last page in pagers | on | `web_usability_pack.pager_extras` |
| Undo / redo of unsaved changes in forms | on | `web_usability_pack.form_undo` |
| Jump to the missing required field when saving fails | on | `web_usability_pack.jump_invalid` |
| Mark for unsaved changes in the browser tab | on | `web_usability_pack.unsaved_title` |
| Save a form with Ctrl+S | on | `web_usability_pack.ctrl_save` |
| Full-width form sheets | off | `web_usability_pack.form_full_width` |

The module builds on four modules of the Odoo Community Association instead of
reimplementing them, see [Required OCA modules](#required-oca-modules).

## Features

### Pager at the bottom

Wherever the web client shows a pager at the top right, the same pager is shown
again at the bottom right, so there is no need to scroll back up:

* list and kanban views (and any other view that feeds the pager of the control
  panel),
* the record pager of form views (`1 / 80`, previous / next),
* one2many / many2many lists and kanbans inside forms, as soon as they have more
  than one page.

The second pager is the standard `Pager` component with the same props as the
first one: paging, editing the range and changing the limit work in both, and
both always show the same state. The `Alt+P` / `Alt+N` access keys stay on the
pager of the control panel.

### Page size and first / last page

The pagers get a selector for the page size (20, 40, 80, 200, plus the limit
of the view if it is another one) and two buttons that jump to the first and to
the last page. This applies to the pager of the control panel, to the pagers
of one2many / many2many fields and to the pagers this module adds at the
bottom; they look and behave the same everywhere.

* The record pager of a form view goes through the records one by one. It gets
  the first / last buttons, but no page size.
* The standard pager of an x2many field disappears as soon as all lines fit on
  one page. After the page size has been changed, it stays until the form is
  left, so that a smaller size can be chosen again.
* Other pagers (for example the small ones inside the groups of a grouped
  list) are not changed.
* If the web client does not know the exact number of records yet
  (`10000+`), the jump to the last page counts them first.

### Undo / redo in forms

Unsaved changes of a form record can be taken back and restored step by step:

* `Ctrl+Z` undoes, `Ctrl+Y` or `Ctrl+Shift+Z` redoes (`Cmd` on macOS),
* two buttons next to the save / discard buttons of the form (in the footer for
  forms opened in a dialog); they are greyed out when there is nothing to undo
  or redo.

One step is one user action together with everything it triggers: the values
computed by the onchange belong to the same step, and so do several updates
made by a field widget for a single click or key press.

Lines of one2many / many2many fields are covered: adding, changing and deleting
lines can be undone and redone, and what is saved afterwards is what the form
shows.

**Typing is not affected.** While a text input has the focus and something has
been typed into it, `Ctrl+Z` / `Ctrl+Y` are left to the browser, which undoes
the typing as usual. The shortcut acts on the record only when the focused
input has nothing of its own to undo (or to redo). Rich text editors always
keep their own history.

The history is dropped when the record is saved, discarded, reloaded or when
another record is displayed. It keeps the last 50 steps.

#### Known limits

* Only unsaved changes of the record are undone. A saved record is not touched:
  nothing is written to or deleted from the database by undo / redo.
* Actions that save the record (buttons of the form, changing the stage in a
  status bar that saves, leaving the form, ...) end the history.
* While a line is edited in a dialog (non editable lists, kanban), the shortcuts
  and buttons of the main form are not available. The whole dialog counts as one
  step of the main form once it is confirmed.
* A new, still empty line is its own step: adding a line and filling it are two
  steps.
* The browser does not tell whether it can still undo something in a text input.
  The module therefore remembers the value an input had before typing started.
  After typing and manually restoring the very same text, the shortcut acts on
  the record instead of the input.
* Lines of a second level (x2many fields inside lines that are edited in a
  dialog) are restored on a best effort basis.
* View state is not part of a step: sorting or paging through the lines cannot
  be undone, and after an undo a list may show the page it showed at that time.
* Inline editing of *list views* (editable lists, multi edit) is not covered:
  those changes are saved immediately.
* Wizards with their own footer show no buttons; the shortcuts work there too.

### Jump to the missing required field

When a form cannot be saved because required fields are missing, the web
client shows its usual notification and marks the fields and the tabs. In
addition, the tab that contains the first invalid field is opened, the field is
scrolled into view and gets the focus.

* A field that is already displayed is preferred to one in a tab that is not
  open.
* If a line of a one2many list is the reason, the page of the list with the
  first invalid line is displayed and the line is scrolled into view. In an
  editable list it is opened and the invalid cell gets the focus.
* Limits: lines that are edited in a dialog (non editable lists, kanban) are
  only scrolled to, not opened; the dialog used to edit such a line is not
  covered; a required list without any line is only scrolled to.

### Unsaved changes in the browser tab

While the form that is displayed has unsaved changes, the title of the browser
tab starts with `●`. The mark follows the save / discard buttons of the form:
it appears as soon as something is typed and disappears when the record is
saved, discarded or left. Forms in dialogs do not set it.

### Save with Ctrl+S

`Ctrl+S` saves the form that is being edited instead of opening the browser
dialog for saving the web page. It is not active in dialogs.

### Full-width forms (optional)

Removes the maximum width of form sheets. This only makes a visible difference
on very wide screens.

## Required OCA modules

Installing this module also installs the following modules of the
[OCA/web](https://github.com/OCA/web) repository (branch `19.0`). They have to
be available in the `addons_path`:

| Module | What it adds | License |
|---|---|---|
| `web_refresher` | Refresh button next to the pager of the control panel | AGPL-3 |
| `web_remember_tree_column_width` | Remembers the column widths of lists (per browser) | LGPL-3 |
| `web_widget_one2many_tree_line_duplicate` | Button to duplicate a line of a one2many list | AGPL-3 |
| `web_chatter_position` | Chatter position (responsive, bottom, sided) per user | LGPL-3 |

Things to know about them:

* `web_chatter_position` adds the field `chatter_position` to the users (shown
  in the user preferences) and depends on `mail`.
* `web_widget_one2many_tree_line_duplicate` does nothing by itself: the button
  only appears on one2many fields that have `options="{'allow_clone': True}"`
  in their view.
* `web_remember_tree_column_width` stores the widths in the local storage of
  the browser, not on the server.
* The refresh button stays at the top; it is not repeated in the pager at the
  bottom. Duplicating a line is one step for undo / redo.

## Configuration

*Settings > General Settings > Usability* (requires the *Settings* access
right). The options are stored as system parameters with the values
`True` / `False`; a missing parameter means the default listed above. Users have
to reload the page after a change.

The settings are deliberately system wide and not per user: no field is added
to the users, and the features do not get in the way of somebody who does not
use them.

## Technical notes

* No new model with a table, no cron job, no mail. The Python part only consists
  of the settings and of the feature flags that are added to the session
  information of internal users.
* Patched / extended components: `Layout` and `X2ManyField` (pager at the
  bottom), `Pager` and the pager of `ControlPanel` (page size, first / last),
  `FormController` (undo / redo, jump to invalid fields, title mark, Ctrl+S).
  The title mark wraps `setParts` / `setCounters` of the title service. The extensions of the core templates
  are loaded right after those templates (see `__manifest__.py`), so that
  templates inheriting from them in primary mode get them as well.
* Undo / redo is implemented with snapshots of the client side state of the
  record (`static/src/form_undo/form_history.js`). It relies on the private
  state of `Record` and `StaticList` that the relational model itself resets
  when changes are discarded. This is the part to check first when moving to
  another Odoo version.
* When this module is installed, tests of other modules that expect exactly one
  pager in a view (`.o_pager`) see two of them.

### Tests

JavaScript unit tests (Hoot) are in `static/tests`. With the module installed
in a test database, open

    /web/tests?filter=@web_usability_pack

in the browser while logged in as an internal user.

## Deutsch

Kleine Erleichterungen für die tägliche Arbeit im Web-Client von Odoo 19
(Community). Jede Funktion lässt sich einzeln abschalten.

* **Seitenwechsler auch unten:** Überall, wo der Web-Client oben rechts einen
  Seitenwechsler zeigt, erscheint derselbe noch einmal unten rechts: in Listen-
  und Kanban-Ansichten, als Datensatz-Wechsler in Formularen (`1 / 80`) und in
  Unterlisten von Formularen, sobald sie mehr als eine Seite haben. Der untere
  Seitenwechsler kann alles, was der obere kann (blättern, Bereich und Limit
  ändern).
* **Rückgängig / Wiederherstellen in Formularen:** Nicht gespeicherte Änderungen
  lassen sich schrittweise zurücknehmen und wiederherstellen, mit `Strg+Z` und
  `Strg+Y` bzw. `Strg+Umschalt+Z` sowie zwei Schaltflächen neben Speichern und
  Verwerfen. Ein Schritt ist eine Benutzeraktion samt ihrer Folgeänderungen
  (onchange). Zeilen in Unterlisten (hinzufügen, ändern, löschen) sind
  eingeschlossen. Solange in einem Textfeld getippt wird, bleibt das Rückgängig
  des Browsers erhalten. Nach Speichern, Verwerfen oder einem Datensatzwechsel
  ist der Verlauf leer. Die Grenzen stehen oben unter *Known limits*.
* **Seitengröße und erste / letzte Seite:** Die Seitenwechsler bekommen eine
  Auswahl der Seitengröße (20, 40, 80, 200) und Schaltflächen für den Sprung
  zur ersten und zur letzten Seite, oben wie unten und auch in Unterlisten.
  Der Datensatz-Wechsler im Formular hat keine Seitengröße.
* **Sprung zum fehlenden Pflichtfeld:** Schlägt das Speichern an Pflichtfeldern
  fehl, wird der Reiter mit dem ersten fehlenden Feld geöffnet, dorthin
  gescrollt und das Feld fokussiert, auch wenn es in einer Zeile einer
  Unterliste liegt. Die Meldung von Odoo bleibt.
* **Ungespeichert-Markierung:** Solange das angezeigte Formular ungespeicherte
  Änderungen hat, beginnt der Titel des Browser-Tabs mit `●`.
* **Speichern mit Strg+S:** speichert das Formular, statt den Browser-Dialog
  „Seite speichern" zu öffnen.
* **Formulare in voller Breite** (standardmäßig aus): hebt die Höchstbreite der
  Formulare auf; sichtbar nur auf sehr breiten Bildschirmen.

Vorausgesetzt werden vier Module aus [OCA/web](https://github.com/OCA/web)
(Branch `19.0`), die bei der Installation mitkommen: `web_refresher`,
`web_remember_tree_column_width`, `web_widget_one2many_tree_line_duplicate`
und `web_chatter_position`. Hinweise dazu stehen oben unter *Required OCA
modules*.

Einstellungen: *Einstellungen > Allgemeine Einstellungen > Bedienkomfort*. Die
Schalter werden als Systemparameter `web_usability_pack.*` gespeichert und
gelten für alle Benutzer; nach einer Änderung die Seite neu laden.

## Credits

Author: Biricon IT Services GmbH, <https://www.biricon.eu>

License: AGPL-3.0 or later
