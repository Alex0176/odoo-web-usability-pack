/* Copyright 2026 Biricon IT Services GmbH
 * License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl). */

import { status, toRaw } from "@odoo/owl";
import { patch } from "@web/core/utils/patch";
import { FormController } from "@web/views/form/form_controller";
import { features } from "../features";

const FOCUSABLE =
    "input:not([type=hidden]):not([disabled]), textarea:not([disabled]), " +
    "select:not([disabled]), [contenteditable=true]";
const MAX_NESTED_NOTEBOOKS = 4;

function nextRender() {
    return new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
}

function isVisible(el) {
    return Boolean(el.offsetParent || el.getClientRects().length);
}

function recordKey(record) {
    return record.resId || record._virtualId;
}

/**
 * When saving a form fails because of missing required fields, the web client
 * shows a notification and marks the fields and the tabs that contain them.
 * This goes one step further: the tab of the first invalid field is opened,
 * the field is scrolled into view and gets the focus.
 */
patch(FormController.prototype, {
    setup() {
        super.setup(...arguments);
        if (!features.jumpInvalid) {
            return;
        }
        const model = toRaw(this.model);
        const { onRootLoaded } = model.hooks;
        model.hooks.onRootLoaded = async (...args) => {
            const result = await onRootLoaded(...args);
            const root = model.root;
            if (root && !root._wupInvalidWrapped) {
                // The only place telling that a save was refused because of
                // invalid fields is the notification of the record itself.
                const notify = root._displayInvalidFieldNotification.bind(root);
                root._wupInvalidWrapped = true;
                root._displayInvalidFieldNotification = (...notifyArgs) => {
                    this.wupJumpToInvalidField();
                    return notify(...notifyArgs);
                };
            }
            return result;
        };
    },

    /**
     * @returns {Promise<boolean>} true if an invalid field has been reached
     */
    async wupJumpToInvalidField() {
        for (let i = 0; i < MAX_NESTED_NOTEBOOKS; i++) {
            // the classes used below are set when the form is rendered
            await nextRender();
            const formEl = this.rootRef.el;
            if (status(this) === "destroyed" || !formEl) {
                return false;
            }
            const fieldEl = [...formEl.querySelectorAll(".o_field_widget.o_field_invalid")].find(
                isVisible
            );
            if (fieldEl) {
                await this._wupShowInvalidField(fieldEl);
                return true;
            }
            // not displayed: it is in a tab that is not the active one
            const tabEl = [
                ...formEl.querySelectorAll(
                    ".o_notebook_headers .nav-link.o_page_invalid:not(.active)"
                ),
            ].find(isVisible);
            if (!tabEl) {
                return false;
            }
            tabEl.click();
        }
        return false;
    },

    /**
     * @param {HTMLElement} fieldEl root element of the field widget
     */
    async _wupShowInvalidField(fieldEl) {
        const root = toRaw(this.model).root;
        const fieldName = fieldEl.getAttribute("name");
        const field = root.fields[fieldName];
        if (field && ["one2many", "many2many"].includes(field.type)) {
            const shown = await this._wupShowInvalidLine(fieldEl, fieldName);
            if (shown) {
                return;
            }
        }
        fieldEl.scrollIntoView({ block: "center" });
        const target = fieldEl.querySelector(FOCUSABLE);
        if (target) {
            target.focus({ preventScroll: true });
        }
    },

    /**
     * The x2many field is invalid because of one of its lines: display the page
     * of the list that contains the first invalid line, scroll to it and, in an
     * editable list, open it on the invalid cell.
     *
     * @param {HTMLElement} fieldEl
     * @param {string} fieldName
     * @returns {Promise<boolean>} false if no invalid line could be shown
     */
    async _wupShowInvalidLine(fieldEl, fieldName) {
        const list = toRaw(this.model).root.data[fieldName];
        const ids = list?.currentIds || [];
        const cache = toRaw(list?._cache) || {};
        const index = ids.findIndex((id) => cache[id] && !cache[id].isValid);
        if (index < 0) {
            return false; // e.g. a required list without any line
        }
        const record = cache[ids[index]];
        if (!list.records.some((r) => recordKey(r) === recordKey(record))) {
            // the line is on another page of the list
            const limit = list.limit;
            await list.load({ offset: Math.floor(index / limit) * limit });
            await nextRender();
            if (status(this) === "destroyed" || !fieldEl.isConnected) {
                return true;
            }
        }
        const rowEl = fieldEl.querySelector(`.o_data_row[data-id="${record.id}"]`);
        if (!rowEl) {
            return false; // kanban sub-view, or the line could not be displayed
        }
        const cellEl = rowEl.querySelector(".o_invalid_cell");
        (cellEl || rowEl).scrollIntoView({ block: "center" });
        const fieldNode = Object.values(this.archInfo.fieldNodes).find(
            (node) => node.name === fieldName
        );
        const isEditable = Boolean(fieldNode?.views?.list?.editable);
        if (cellEl && isEditable) {
            if (!rowEl.classList.contains("o_selected_row")) {
                cellEl.click();
                await nextRender();
            }
            // the row has been rendered again in edit mode
            const editedRowEl = fieldEl.querySelector(`.o_data_row[data-id="${record.id}"]`);
            const target = editedRowEl
                ?.querySelector(".o_invalid_cell, .o_field_invalid")
                ?.querySelector(FOCUSABLE);
            if (target) {
                target.focus({ preventScroll: true });
            }
        }
        return true;
    },
});
