/* Copyright 2026 Biricon IT Services GmbH
 * License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl). */

import { registry } from "@web/core/registry";
import { features } from "../features";

export const FULL_WIDTH_CLASS = "o_wup_form_full_width";

/**
 * Optional feature (off by default): form sheets are not limited to a maximum
 * width. The style itself lives in form_full_width.scss and is only active
 * when the class below is set on the body.
 */
export const formFullWidthService = {
    start() {
        document.body.classList.toggle(FULL_WIDTH_CLASS, features.formFullWidth);
    },
};

registry.category("services").add("web_usability_pack.form_full_width", formFullWidthService);
