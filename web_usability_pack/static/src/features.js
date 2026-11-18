/* Copyright 2026 Biricon IT Services GmbH
 * License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl). */

import { session } from "@web/session";

const config = session.web_usability_pack || {};

/**
 * State of the individual features of this module. The values come from the
 * system parameters "web_usability_pack.<key>" (see General Settings) and are
 * sent to the web client with the session information.
 */
export const features = {
    bottomPager: config.bottom_pager !== false,
    formUndo: config.form_undo !== false,
    ctrlSave: config.ctrl_save !== false,
    jumpInvalid: config.jump_invalid !== false,
    pagerExtras: config.pager_extras !== false,
    unsavedTitle: config.unsaved_title !== false,
    formFullWidth: config.form_full_width === true,
};
