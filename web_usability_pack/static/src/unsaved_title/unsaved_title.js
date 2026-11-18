/* Copyright 2026 Biricon IT Services GmbH
 * License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl). */

import { onWillUnmount, useEffect, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useBus, useService } from "@web/core/utils/hooks";
import { patch } from "@web/core/utils/patch";
import { FormController } from "@web/views/form/form_controller";
import { features } from "../features";

export const UNSAVED_MARK = "● ";

/**
 * Prefixes the title of the browser tab with a mark while something is
 * unsaved. The title itself stays under the control of the title service:
 * the mark is put back each time that service writes the title.
 */
export const unsavedTitleService = {
    dependencies: ["title"],
    start(env, { title }) {
        let unsaved = false;

        function apply() {
            const marked = document.title.startsWith(UNSAVED_MARK);
            if (unsaved && !marked) {
                document.title = UNSAVED_MARK + document.title;
            } else if (!unsaved && marked) {
                document.title = document.title.slice(UNSAVED_MARK.length);
            }
        }

        for (const method of ["setParts", "setCounters"]) {
            const original = title[method];
            title[method] = (...args) => {
                const result = original(...args);
                apply();
                return result;
            };
        }

        return {
            /**
             * @param {boolean} value
             */
            setUnsaved(value) {
                unsaved = Boolean(value);
                apply();
            },
        };
    },
};

registry.category("services").add("web_usability_pack.unsaved_title", unsavedTitleService);

patch(FormController.prototype, {
    setup() {
        super.setup(...arguments);
        if (!features.unsavedTitle || this.env.inDialog) {
            return;
        }
        const unsavedTitle = useService("web_usability_pack.unsaved_title");
        // same sources as the save / discard buttons of the form: the record
        // itself, and the fields in which something is being typed
        const state = useState({ fieldIsDirty: false });
        useBus(this.model.bus, "FIELD_IS_DIRTY", (ev) => {
            state.fieldIsDirty = Boolean(ev.detail);
        });
        useEffect(
            (unsaved) => {
                unsavedTitle.setUnsaved(unsaved);
            },
            () => [Boolean(this.model.root.dirty) || state.fieldIsDirty]
        );
        onWillUnmount(() => unsavedTitle.setUnsaved(false));
    },
});
