/* Copyright 2026 Biricon IT Services GmbH
 * License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl). */

import { status, toRaw, useEffect, useExternalListener, useState } from "@odoo/owl";
import { useHotkey } from "@web/core/hotkeys/hotkey_hook";
import { patch } from "@web/core/utils/patch";
import { FormController } from "@web/views/form/form_controller";
import { features } from "../features";
import { FormHistory } from "./form_history";

/**
 * Tells whether the browser has something to undo/redo by itself in the
 * focused text input, in which case the keyboard shortcut must be left to it.
 *
 * Browsers do not expose their undo stack, so this is tracked per element:
 * the value an input had before the user started typing into it, and the
 * number of native undo steps that could be redone.
 */
export class NativeEditTracker {
    constructor() {
        this.states = new WeakMap();
    }

    isTextInput(el) {
        return (
            el instanceof HTMLElement &&
            /^(input|textarea)$/i.test(el.tagName) &&
            !el.matches(
                "input[type=checkbox], input[type=radio], input[type=button], input[type=submit], input[type=file], input[type=range], input[type=color]"
            )
        );
    }

    onBeforeInput(ev) {
        const el = ev.target;
        if (this.isTextInput(el) && !this.states.has(el)) {
            this.states.set(el, { initialValue: el.value, undone: 0 });
        }
    }

    onInput(ev) {
        const state = this.states.get(ev.target);
        if (!state) {
            return;
        }
        if (ev.inputType === "historyUndo") {
            state.undone++;
        } else if (ev.inputType === "historyRedo") {
            state.undone = Math.max(0, state.undone - 1);
        } else {
            state.undone = 0;
        }
    }

    forget(el) {
        if (el) {
            this.states.delete(el);
        }
    }

    /**
     * @param {"undo"|"redo"} direction
     * @param {EventTarget} target
     * @returns {boolean} true if the shortcut belongs to the browser
     */
    isNative(direction, target) {
        if (!(target instanceof HTMLElement)) {
            return false;
        }
        if (target.isContentEditable) {
            // rich text editors have their own history
            return true;
        }
        if (!this.isTextInput(target)) {
            return false;
        }
        const state = this.states.get(target);
        if (!state) {
            return false; // nothing typed in this input since it got the focus
        }
        return direction === "undo" ? target.value !== state.initialValue : state.undone > 0;
    }
}

patch(FormController.prototype, {
    setup() {
        super.setup(...arguments);
        this.wupUndoState = useState({ canUndo: false, canRedo: false });
        this.wupHistory = null;
        if (features.formUndo && (this.canEdit || this.canCreate)) {
            this._wupSetupUndo();
        }
        if (features.ctrlSave && !this.env.inDialog && (this.canEdit || this.canCreate)) {
            useHotkey("control+s", () => this.saveButtonClicked(), {
                bypassEditableProtection: true,
                isAvailable: () => this.model.root.isInEdition,
            });
        }
    },

    _wupSetupUndo() {
        // The raw model is used on purpose: reading the whole record through
        // the reactive proxy of this component would subscribe it to every key.
        const model = toRaw(this.model);
        const tracker = new NativeEditTracker();
        this.wupNativeEdits = tracker;
        this.wupHistory = new FormHistory({
            getRoot: () => model.root,
            onChange: () => {
                this.wupUndoState.canUndo = this.wupHistory.canUndo;
                this.wupUndoState.canRedo = this.wupHistory.canRedo;
            },
        });
        const history = this.wupHistory;

        // Each key press or click starts a new user action. The updates of the
        // record that follow without any further interaction belong together.
        let actionId = 0;
        const onUserAction = () => actionId++;
        useExternalListener(window, "keydown", onUserAction, { capture: true });
        useExternalListener(window, "pointerdown", onUserAction, { capture: true });
        const reset = () => {
            history.reset();
            const root = model.root;
            if (root && !root._wupDiscardWrapped) {
                // Discarding does not go through any hook of the model.
                const discard = root._discard.bind(root);
                root._wupDiscardWrapped = true;
                root._discard = (...args) => {
                    const result = discard(...args);
                    history.reset();
                    return result;
                };
            }
        };

        const { onRootLoaded, onRecordSaved, onRecordChanged } = model.hooks;
        Object.assign(model.hooks, {
            onRootLoaded: async (...args) => {
                const result = await onRootLoaded(...args);
                reset();
                return result;
            },
            onRecordSaved: async (...args) => {
                const result = await onRecordSaved(...args);
                // The model applies the saved values right after this hook, so
                // the new starting point can only be taken once it is done.
                history.invalidate();
                model.mutex.getUnlockedDef().then(() => {
                    if (status(this) !== "destroyed" && !history.current) {
                        reset();
                    }
                });
                return result;
            },
            // called at the end of each update, once the onchange is applied
            onRecordChanged: async (...args) => {
                const result = await onRecordChanged(...args);
                history.commit(actionId);
                tracker.forget(document.activeElement);
                return result;
            },
        });

        useEffect(
            (el) => {
                if (!el) {
                    return;
                }
                const onBeforeInput = (ev) => tracker.onBeforeInput(ev);
                const onInput = (ev) => tracker.onInput(ev);
                const onFocusOut = (ev) => tracker.forget(ev.target);
                el.addEventListener("beforeinput", onBeforeInput);
                el.addEventListener("input", onInput);
                el.addEventListener("focusout", onFocusOut);
                return () => {
                    el.removeEventListener("beforeinput", onBeforeInput);
                    el.removeEventListener("input", onInput);
                    el.removeEventListener("focusout", onFocusOut);
                };
            },
            () => [this.rootRef.el]
        );

        const hotkeyOptions = (direction) => ({
            bypassEditableProtection: true,
            isAvailable: (target) =>
                model.root.isInEdition && !tracker.isNative(direction, target),
        });
        useHotkey("control+z", () => this.wupUndo(), hotkeyOptions("undo"));
        useHotkey("control+y", () => this.wupRedo(), hotkeyOptions("redo"));
        useHotkey("control+shift+z", () => this.wupRedo(), hotkeyOptions("redo"));
    },

    get wupShowUndoButtons() {
        return Boolean(this.wupHistory) && this.model.root.isInEdition;
    },

    wupUndo() {
        return this._wupMove("undo");
    },

    wupRedo() {
        return this._wupMove("redo");
    },

    async _wupMove(direction) {
        if (!this.wupHistory) {
            return false;
        }
        const model = toRaw(this.model);
        // let the fields commit what is being typed, and wait for the model
        await model._askChanges();
        const done = await model.mutex.exec(() => this.wupHistory[direction]());
        this.wupNativeEdits.forget(document.activeElement);
        return done;
    },
});
