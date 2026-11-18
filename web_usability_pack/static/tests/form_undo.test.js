/* Copyright 2026 Biricon IT Services GmbH
 * License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl). */

import { defineMailModels } from "@mail/../tests/mail_test_helpers";
import { expect, test } from "@odoo/hoot";
import { press, queryAllTexts } from "@odoo/hoot-dom";
import { animationFrame } from "@odoo/hoot-mock";
import {
    clickSave,
    contains,
    defineModels,
    fields,
    models,
    mountView,
    onRpc,
    patchWithCleanup,
} from "@web/../tests/web_test_helpers";
import { features } from "@web_usability_pack/features";

class Partner extends models.Model {
    name = fields.Char();
    foo = fields.Char();
    size = fields.Integer();
    line_ids = fields.One2many({ relation: "line", relation_field: "partner_id" });

    _onChanges = {
        foo(record) {
            record.size = (record.foo || "").length;
        },
    };

    _records = [{ id: 1, name: "first", foo: "abc", size: 3, line_ids: [1, 2] }];
}

class Line extends models.Model {
    name = fields.Char();
    qty = fields.Integer();
    partner_id = fields.Many2one({ relation: "partner" });

    _records = [
        { id: 1, name: "line 1", qty: 1, partner_id: 1 },
        { id: 2, name: "line 2", qty: 2, partner_id: 1 },
    ];
}

// mail is a dependency (through web_chatter_position): its models are needed
defineMailModels();
defineModels([Partner, Line]);

const FORM_ARCH = `
    <form>
        <field name="name"/>
        <field name="foo"/>
        <field name="size"/>
        <field name="line_ids">
            <list editable="bottom">
                <field name="name"/>
                <field name="qty"/>
            </list>
        </field>
    </form>`;

const NAME = ".o_field_widget[name=name] input";
const FOO = ".o_field_widget[name=foo] input";
const SIZE = ".o_field_widget[name=size] input";

/**
 * Clicks outside of the fields: leaves the edited input and the edited line.
 */
async function leaveField() {
    await contains(".o_control_panel").click();
    await animationFrame();
}

async function undo() {
    await contains(".o_wup_undo").click();
    await animationFrame();
}

async function redo() {
    await contains(".o_wup_redo").click();
    await animationFrame();
}

function lines() {
    return queryAllTexts(".o_field_widget[name=line_ids] .o_data_row").map((text) =>
        text.replace(/\s+/g, " ").trim()
    );
}

test("the buttons are disabled as long as there is nothing to undo or redo", async () => {
    await mountView({ resModel: "partner", type: "form", resId: 1, arch: FORM_ARCH });
    expect(".o_control_panel .o_wup_undo").toHaveCount(1);
    expect(".o_wup_undo").not.toBeEnabled();
    expect(".o_wup_redo").not.toBeEnabled();

    await contains(NAME).edit("changed");
    expect(".o_wup_undo").toBeEnabled();
    expect(".o_wup_redo").not.toBeEnabled();
});

test("no buttons and no shortcut when the feature is disabled", async () => {
    patchWithCleanup(features, { formUndo: false });
    await mountView({ resModel: "partner", type: "form", resId: 1, arch: FORM_ARCH });
    expect(".o_wup_undo").toHaveCount(0);
    await contains(NAME).edit("changed");
    await leaveField();
    await press(["control", "z"]);
    await animationFrame();
    expect(NAME).toHaveValue("changed");
});

test("undo and redo field changes step by step", async () => {
    await mountView({ resModel: "partner", type: "form", resId: 1, arch: FORM_ARCH });
    await contains(NAME).edit("second");
    await contains(NAME).edit("third");
    expect(NAME).toHaveValue("third");

    await undo();
    expect(NAME).toHaveValue("second");
    expect(".o_wup_redo").toBeEnabled();
    await undo();
    expect(NAME).toHaveValue("first");
    expect(".o_wup_undo").not.toBeEnabled();

    await redo();
    expect(NAME).toHaveValue("second");
    await redo();
    expect(NAME).toHaveValue("third");
    expect(".o_wup_redo").not.toBeEnabled();

    // a new change drops what could be redone
    await undo();
    await contains(NAME).edit("other");
    expect(".o_wup_redo").not.toBeEnabled();
    await undo();
    expect(NAME).toHaveValue("second");
});

test("a step contains the consequences of the onchange", async () => {
    await mountView({ resModel: "partner", type: "form", resId: 1, arch: FORM_ARCH });
    await contains(FOO).edit("abcdef");
    expect(SIZE).toHaveValue("6");
    await undo();
    expect(FOO).toHaveValue("abc");
    expect(SIZE).toHaveValue("3");
    await redo();
    expect(FOO).toHaveValue("abcdef");
    expect(SIZE).toHaveValue("6");
});

test("keyboard shortcuts", async () => {
    await mountView({ resModel: "partner", type: "form", resId: 1, arch: FORM_ARCH });
    await contains(NAME).edit("second");
    await contains(NAME).edit("third");
    await leaveField();

    await press(["control", "z"]);
    await animationFrame();
    expect(NAME).toHaveValue("second");
    await press(["control", "z"]);
    await animationFrame();
    expect(NAME).toHaveValue("first");
    await press(["control", "y"]);
    await animationFrame();
    expect(NAME).toHaveValue("second");
    await press(["control", "shift", "z"]);
    await animationFrame();
    expect(NAME).toHaveValue("third");
});

test("the shortcut is left to the browser while text is being typed", async () => {
    await mountView({ resModel: "partner", type: "form", resId: 1, arch: FORM_ARCH });
    await contains(NAME).edit("second");
    expect(".o_wup_undo").toBeEnabled();

    // type without leaving the field: this is not a change of the record yet
    await contains(FOO).edit("typing", { confirm: false });
    await press(["control", "z"]);
    await animationFrame();
    // nothing has been undone in the record
    expect(NAME).toHaveValue("second");
    expect(".o_wup_redo").not.toBeEnabled();
});

test("undo and redo in an x2many list, then save", async () => {
    onRpc("web_save", ({ args }) => {
        expect.step("web_save");
        expect(args[1]).toEqual({
            line_ids: [
                [1, 1, { qty: 10 }],
                [0, args[1].line_ids[1][1], { name: "new line", qty: 0 }],
            ],
        });
    });
    await mountView({ resModel: "partner", type: "form", resId: 1, arch: FORM_ARCH });
    expect(lines()).toEqual(["line 1 1", "line 2 2"]);

    // change a line
    await contains(".o_data_row:eq(0) td[name=qty]").click();
    await contains(".o_data_row:eq(0) td[name=qty] input").edit("10", { confirm: "blur" });
    await leaveField();
    expect(lines()).toEqual(["line 1 10", "line 2 2"]);

    // add a line
    await contains(".o_field_x2many_list_row_add a").click();
    await contains(".o_selected_row td[name=name] input").edit("new line", { confirm: "blur" });
    await leaveField();
    expect(lines()).toEqual(["line 1 10", "line 2 2", "new line 0"]);

    // delete a line
    await contains(".o_data_row:eq(1) .o_list_record_remove").click();
    expect(lines()).toEqual(["line 1 10", "new line 0"]);

    await undo(); // the deletion
    expect(lines()).toEqual(["line 1 10", "line 2 2", "new line 0"]);
    await undo(); // the name of the new line
    await undo(); // the new line
    expect(lines()).toEqual(["line 1 10", "line 2 2"]);
    await undo(); // the quantity
    expect(lines()).toEqual(["line 1 1", "line 2 2"]);
    expect(".o_wup_undo").not.toBeEnabled();

    await redo();
    await redo();
    await redo();
    expect(lines()).toEqual(["line 1 10", "line 2 2", "new line 0"]);
    expect(".o_wup_redo").toBeEnabled();

    await clickSave();
    expect.verifySteps(["web_save"]);
    // saving is the end of the history
    expect(".o_wup_undo").not.toBeEnabled();
    expect(".o_wup_redo").not.toBeEnabled();
});

test("everything undone: nothing is sent to the server for the lines", async () => {
    onRpc("web_save", ({ args }) => {
        expect.step("web_save");
        expect(args[1]).toEqual({ name: "saved" });
    });
    await mountView({ resModel: "partner", type: "form", resId: 1, arch: FORM_ARCH });
    await contains(".o_data_row:eq(0) .o_list_record_remove").click();
    expect(lines()).toEqual(["line 2 2"]);
    await undo();
    expect(lines()).toEqual(["line 1 1", "line 2 2"]);
    await contains(NAME).edit("saved");
    await clickSave();
    expect.verifySteps(["web_save"]);
});

test("the history is dropped when the changes are discarded", async () => {
    await mountView({ resModel: "partner", type: "form", resId: 1, arch: FORM_ARCH });
    await contains(NAME).edit("second");
    await contains(NAME).edit("third");
    await undo();
    expect(".o_wup_undo").toBeEnabled();
    expect(".o_wup_redo").toBeEnabled();

    await contains(".o_form_button_cancel").click();
    expect(NAME).toHaveValue("first");
    expect(".o_wup_undo").not.toBeEnabled();
    expect(".o_wup_redo").not.toBeEnabled();
});

test("the history is dropped when another record is displayed", async () => {
    Partner._records.push({ id: 2, name: "other" });
    onRpc("web_save", () => expect.step("web_save"));
    await mountView({
        resModel: "partner",
        type: "form",
        resId: 1,
        resIds: [1, 2],
        arch: FORM_ARCH,
    });
    await contains(NAME).edit("second");
    expect(".o_wup_undo").toBeEnabled();
    await contains(".o_control_panel .o_pager_next").click();
    expect.verifySteps(["web_save"]);
    expect(NAME).toHaveValue("other");
    expect(".o_wup_undo").not.toBeEnabled();

    // the first change made after a save can be undone as well
    await contains(NAME).edit("other 2");
    await contains(NAME).edit("other 3");
    await undo();
    expect(NAME).toHaveValue("other 2");
    await undo();
    expect(NAME).toHaveValue("other");
});

test("new record: undo back to the default values", async () => {
    await mountView({ resModel: "partner", type: "form", arch: FORM_ARCH });
    await contains(NAME).edit("new one");
    await contains(FOO).edit("xy");
    expect(SIZE).toHaveValue("2");
    await undo();
    await undo();
    expect(NAME).toHaveValue("");
    expect(FOO).toHaveValue("");
    expect(".o_wup_undo").not.toBeEnabled();
});

test("Ctrl+S saves the record", async () => {
    onRpc("web_save", ({ args }) => {
        expect.step("web_save");
        expect(args[1]).toEqual({ name: "saved with the keyboard" });
    });
    await mountView({ resModel: "partner", type: "form", resId: 1, arch: FORM_ARCH });
    await contains(NAME).edit("saved with the keyboard", { confirm: false });
    await press(["control", "s"]);
    await animationFrame();
    expect.verifySteps(["web_save"]);
});

test("Ctrl+S is not captured when the feature is disabled", async () => {
    patchWithCleanup(features, { ctrlSave: false });
    onRpc("web_save", () => expect.step("web_save"));
    await mountView({ resModel: "partner", type: "form", resId: 1, arch: FORM_ARCH });
    await contains(NAME).edit("not saved", { confirm: false });
    await press(["control", "s"]);
    await animationFrame();
    expect.verifySteps([]);
});
