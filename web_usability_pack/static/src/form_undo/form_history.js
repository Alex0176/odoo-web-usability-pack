/* Copyright 2026 Biricon IT Services GmbH
 * License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl). */

import { markRaw, reactive, toRaw } from "@odoo/owl";

/**
 * Undo / redo history for the unsaved changes of a form record.
 *
 * The history works with snapshots ("mementos") of the client side state of
 * the root record and of everything below it (x2many lists and their records,
 * recursively). A snapshot is taken after every completed update of the record,
 * i.e. after the onchange triggered by a user action has been applied, so one
 * step is one user action together with its onchange consequences.
 *
 * Only state that the relational model itself resets in `Record._discard` and
 * `StaticList._discard` is saved and restored. Nothing is sent to the server:
 * values coming from the server (`_values`) are never touched, which is why the
 * history must be dropped as soon as the record is saved or reloaded.
 */

const MAX_STEPS = 50;

/**
 * Datapoints are reactive objects, and depending on where a reference to one of
 * them is read from, it is either the raw object or a proxy. Always work with
 * the same proxy: identities can then be compared, and what is written is
 * observed by the components.
 */
function proxy(datapoint) {
    return reactive(toRaw(datapoint));
}

function isStaticList(value) {
    return Boolean(value) && typeof value === "object" && Array.isArray(value._commands);
}

function cloneCommand(command) {
    return command.map((part) => (Array.isArray(part) ? [...part] : part));
}

function cloneUnknownCommands(unknownCommands) {
    const result = {};
    for (const [id, commands] of Object.entries(unknownCommands || {})) {
        result[id] = [...commands];
    }
    return result;
}

// -----------------------------------------------------------------------------
// Snapshot
// -----------------------------------------------------------------------------

function snapshotRecord(record) {
    record = proxy(record);
    const lists = [];
    for (const value of Object.values(toRaw(record.data))) {
        if (isStaticList(value)) {
            lists.push(snapshotList(value));
        }
    }
    return {
        record,
        dirty: record.dirty,
        changes: { ...toRaw(record._changes) },
        textValues: { ...toRaw(record._textValues) },
        invalidFields: [...toRaw(record._invalidFields)],
        lists,
    };
}

function snapshotList(list) {
    list = proxy(list);
    return {
        list,
        commands: list._commands.map(cloneCommand),
        currentIds: [...list._currentIds],
        count: list.count,
        unknownRecordCommands: cloneUnknownCommands(list._unknownRecordCommands),
        // view state, restored but not part of the comparison of two snapshots
        records: toRaw(list.records).map(proxy),
        limit: list.limit,
        offset: list.offset,
        tmpIncreaseLimit: list._tmpIncreaseLimit,
        needsReordering: list._needsReordering,
        cache: Object.values(toRaw(list._cache)).map(snapshotRecord),
    };
}

// -----------------------------------------------------------------------------
// Comparison
// -----------------------------------------------------------------------------

function sameValue(a, b) {
    if (a === b) {
        return true;
    }
    if (!a || !b || typeof a !== "object" || typeof b !== "object") {
        return false;
    }
    if (isStaticList(a) || isStaticList(b)) {
        return toRaw(a) === toRaw(b);
    }
    if (a.isLuxonDateTime && b.isLuxonDateTime) {
        return a.valueOf() === b.valueOf();
    }
    try {
        return JSON.stringify(a) === JSON.stringify(b);
    } catch {
        return false;
    }
}

function sameObject(a, b) {
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) {
        return false;
    }
    return keys.every((key) => key in b && sameValue(a[key], b[key]));
}

function sameRecordSnapshot(a, b) {
    // "dirty" alone is not a difference a user could see or undo
    if (a.record !== b.record) {
        return false;
    }
    if (!sameObject(a.changes, b.changes) || !sameObject(a.textValues, b.textValues)) {
        return false;
    }
    if (a.lists.length !== b.lists.length) {
        return false;
    }
    // matched by list and not by position: the order of the keys of
    // record.data is not the same before and after a restore
    const bLists = new Map(b.lists.map((snapshot) => [snapshot.list, snapshot]));
    return a.lists.every((snapshot) => {
        const other = bLists.get(snapshot.list);
        return Boolean(other) && sameListSnapshot(snapshot, other);
    });
}

function sameListSnapshot(a, b) {
    if (a.list !== b.list || a.count !== b.count) {
        return false;
    }
    if (
        JSON.stringify(a.currentIds) !== JSON.stringify(b.currentIds) ||
        !sameValue(a.commands, b.commands) ||
        !sameValue(a.unknownRecordCommands, b.unknownRecordCommands)
    ) {
        return false;
    }
    // Only the records that belong to the list matter: a new line that has been
    // abandoned stays in the cache of the list but is not reachable anymore.
    const ids = new Set(a.currentIds);
    const bSnapshots = new Map(b.cache.map((snapshot) => [snapshot.record, snapshot]));
    for (const aSnapshot of a.cache) {
        const record = aSnapshot.record;
        if (!ids.has(record.resId || record._virtualId)) {
            continue;
        }
        const bSnapshot = bSnapshots.get(record);
        if (bSnapshot && !sameRecordSnapshot(aSnapshot, bSnapshot)) {
            return false;
        }
    }
    return true;
}

// -----------------------------------------------------------------------------
// Restore
// -----------------------------------------------------------------------------

function restoreRecord(snapshot) {
    const record = snapshot.record;
    // same order as in Record._discard: x2many lists first, then the record
    for (const listSnapshot of snapshot.lists) {
        restoreList(listSnapshot);
    }
    record._changes = markRaw({ ...snapshot.changes });
    record._textValues = markRaw({ ...snapshot.textValues });
    record.dirty = snapshot.dirty;
    record.data = { ...record._values, ...record._changes };
    record._setEvalContext();
    record._invalidFields.clear();
    for (const fieldName of snapshot.invalidFields) {
        record._invalidFields.add(fieldName);
    }
    // required fields that became valid again with the restored values
    record._checkValidity({ removeInvalidOnly: true });
}

function restoreList(snapshot) {
    const list = snapshot.list;
    const known = new Set();
    for (const recordSnapshot of snapshot.cache) {
        known.add(recordSnapshot.record);
        restoreRecord(recordSnapshot);
    }
    const visible = new Set(snapshot.records);
    for (const record of Object.values(toRaw(list._cache)).map(proxy)) {
        if (!known.has(record) && record.resId && !record._savePoint) {
            // Existing record that has been fetched after the snapshot was
            // taken (e.g. another page of the list): it had no change then.
            record._discard();
        }
        if (!visible.has(record) && record.resId && record.config.mode === "edit") {
            record._switchMode("readonly");
        }
    }
    list._commands = snapshot.commands.map(cloneCommand);
    list._currentIds = [...snapshot.currentIds];
    list.count = snapshot.count;
    list._unknownRecordCommands = cloneUnknownCommands(snapshot.unknownRecordCommands);
    list._tmpIncreaseLimit = snapshot.tmpIncreaseLimit;
    list._needsReordering = snapshot.needsReordering;
    list.model._updateConfig(
        list.config,
        { limit: snapshot.limit, offset: snapshot.offset },
        { reload: false }
    );
    list.records = [...snapshot.records];
    // Commands received from the server for records that were not loaded when
    // the snapshot was taken, but are loaded now (see _createRecordDatapoint).
    for (const id of Object.keys(list._unknownRecordCommands)) {
        if (id in list._cache && !known.has(proxy(list._cache[id]))) {
            const commands = list._unknownRecordCommands[id];
            delete list._unknownRecordCommands[id];
            list._applyCommands(commands);
        }
    }
}

// -----------------------------------------------------------------------------
// History
// -----------------------------------------------------------------------------

export class FormHistory {
    /**
     * @param {Object} params
     * @param {() => Object} params.getRoot returns the current root record
     * @param {() => void} [params.onChange] called when canUndo/canRedo may
     *  have changed
     * @param {number} [params.maxSteps]
     */
    constructor({ getRoot, onChange, maxSteps }) {
        this.getRoot = getRoot;
        this.onChange = onChange || (() => {});
        this.maxSteps = maxSteps || MAX_STEPS;
        this.root = null;
        this.current = null;
        this.changesRef = null;
        this.undoStack = [];
        this.redoStack = [];
        this.lastActionId = undefined;
    }

    get canUndo() {
        return this.undoStack.length > 0;
    }

    get canRedo() {
        return this.redoStack.length > 0;
    }

    /**
     * Forget everything. To call when the record is about to be replaced by
     * the model (the new starting point is then taken with `reset`).
     */
    invalidate() {
        this.root = null;
        this.current = null;
        this.changesRef = null;
        this.undoStack = [];
        this.redoStack = [];
        this.lastActionId = undefined;
        this.onChange();
    }

    /**
     * Forget everything and take the current state of the root record as the
     * new starting point. To call once the record is loaded, saved or discarded.
     */
    reset() {
        const root = this._getRoot();
        this.root = root;
        this.undoStack = [];
        this.redoStack = [];
        this.lastActionId = undefined;
        this.current = root ? snapshotRecord(root) : null;
        this.changesRef = root ? toRaw(root._changes) : null;
        this.onChange();
    }

    /**
     * Record the current state as a new step, if it differs from the last
     * known one. To call after each completed update of the record.
     *
     * A single user action may update the record several times (a field
     * widget that writes a second value once the first one is applied, ...).
     * The caller can identify the user action with `actionId`: the updates
     * that share the same id end up in one step.
     *
     * @param {unknown} [actionId]
     */
    commit(actionId) {
        if (this._isOutdated()) {
            this.reset();
            return;
        }
        const snapshot = snapshotRecord(this.root);
        if (!sameRecordSnapshot(this.current, snapshot)) {
            const sameAction = actionId !== undefined && actionId === this.lastActionId;
            if (!sameAction) {
                this.undoStack.push(this.current);
                if (this.undoStack.length > this.maxSteps) {
                    this.undoStack.shift();
                }
            }
            this.lastActionId = actionId;
            this.redoStack = [];
        }
        // also refreshes the view state (current page of the x2many lists, ...)
        this.current = snapshot;
        this.onChange();
    }

    /**
     * @returns {boolean} true if a step has been undone
     */
    undo() {
        return this._move("undo");
    }

    /**
     * @returns {boolean} true if a step has been redone
     */
    redo() {
        return this._move("redo");
    }

    // -------------------------------------------------------------------------
    // Private
    // -------------------------------------------------------------------------

    /**
     * The model replaces `_changes` whenever it resets the record on its own
     * (load, save, discard). If that happened without us being told, the
     * snapshots are not valid anymore.
     */
    _getRoot() {
        const root = this.getRoot();
        return root ? proxy(root) : null;
    }

    _isOutdated() {
        const root = this._getRoot();
        return !root || root !== this.root || toRaw(root._changes) !== this.changesRef;
    }

    _move(direction) {
        if (this._isOutdated()) {
            this.reset();
            return false;
        }
        // Some operations change the record without notifying anyone (e.g. an
        // empty new line that is abandoned when leaving it). Take the state as
        // it is now as the reference (what could be redone is then obsolete),
        // and skip the steps that would not change anything.
        const live = snapshotRecord(this.root);
        if (!sameRecordSnapshot(this.current, live)) {
            this.redoStack = [];
        }
        this.current = live;
        const from = direction === "undo" ? this.undoStack : this.redoStack;
        const to = direction === "undo" ? this.redoStack : this.undoStack;
        let target = from.pop();
        while (target && sameRecordSnapshot(target, this.current)) {
            target = from.pop();
        }
        if (!target) {
            this.onChange();
            return false;
        }
        to.push(this.current);
        this.lastActionId = undefined;
        restoreRecord(target);
        this.current = target;
        this.changesRef = toRaw(this.root._changes);
        this.onChange();
        return true;
    }
}
