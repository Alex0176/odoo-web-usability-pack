/* Copyright 2026 Biricon IT Services GmbH
 * License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl). */

import { defineMailModels } from "@mail/../tests/mail_test_helpers";
import { expect, test } from "@odoo/hoot";
import { animationFrame } from "@odoo/hoot-mock";
import {
    clickSave,
    contains,
    defineModels,
    fields,
    getService,
    models,
    mountView,
    patchWithCleanup,
} from "@web/../tests/web_test_helpers";
import { features } from "@web_usability_pack/features";
import { UNSAVED_MARK } from "@web_usability_pack/unsaved_title/unsaved_title";

class Partner extends models.Model {
    name = fields.Char();

    _records = [
        { id: 1, name: "first" },
        { id: 2, name: "second" },
    ];
}

// mail is a dependency (through web_chatter_position): its models are needed
defineMailModels();
defineModels([Partner]);

const ARCH = `<form><field name="name"/></form>`;
const NAME = ".o_field_widget[name=name] input";

function isMarked() {
    return document.title.startsWith(UNSAVED_MARK);
}

test("the title is marked while the form has unsaved changes", async () => {
    await mountView({ resModel: "partner", type: "form", resId: 1, arch: ARCH });
    getService("title").setParts({ action: "first" });
    expect(document.title).toBe("first");

    await contains(NAME).edit("changed");
    expect(document.title).toBe(`${UNSAVED_MARK}first`);

    // the mark survives an update of the title by the web client
    getService("title").setParts({ action: "renamed" });
    expect(document.title).toBe(`${UNSAVED_MARK}renamed`);

    await clickSave();
    await animationFrame();
    expect(document.title).toBe("renamed");
});

test("the mark appears while typing and disappears when discarding", async () => {
    await mountView({ resModel: "partner", type: "form", resId: 1, arch: ARCH });
    getService("title").setParts({ action: "first" });
    await contains(NAME).edit("typing", { confirm: false });
    expect(isMarked()).toBe(true);

    await contains(".o_form_button_cancel").click();
    await animationFrame();
    expect(isMarked()).toBe(false);
    expect(NAME).toHaveValue("first");
});

test("the mark disappears when another record is displayed", async () => {
    await mountView({
        resModel: "partner",
        type: "form",
        resId: 1,
        resIds: [1, 2],
        arch: ARCH,
    });
    getService("title").setParts({ action: "first" });
    await contains(NAME).edit("changed");
    expect(isMarked()).toBe(true);
    await contains(".o_control_panel .o_pager_next").click(); // saves and loads the next one
    await animationFrame();
    expect(NAME).toHaveValue("second");
    expect(isMarked()).toBe(false);
});

test("no mark when the feature is disabled", async () => {
    patchWithCleanup(features, { unsavedTitle: false });
    await mountView({ resModel: "partner", type: "form", resId: 1, arch: ARCH });
    getService("title").setParts({ action: "first" });
    await contains(NAME).edit("changed");
    expect(isMarked()).toBe(false);
});
