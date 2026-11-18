/* Copyright 2026 Biricon IT Services GmbH
 * License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl). */

import { defineMailModels } from "@mail/../tests/mail_test_helpers";
import { expect, test } from "@odoo/hoot";
import { queryAllTexts } from "@odoo/hoot-dom";
import {
    contains,
    defineModels,
    fields,
    models,
    mountView,
    patchWithCleanup,
} from "@web/../tests/web_test_helpers";
import { features } from "@web_usability_pack/features";

class Partner extends models.Model {
    name = fields.Char();
    line_ids = fields.One2many({ relation: "line", relation_field: "partner_id" });

    _records = [
        { id: 1, name: "first", line_ids: [1, 2, 3, 4, 5] },
        { id: 2, name: "second" },
        { id: 3, name: "third" },
        { id: 4, name: "fourth" },
        { id: 5, name: "fifth" },
    ];
}

class Line extends models.Model {
    name = fields.Char();
    partner_id = fields.Many2one({ relation: "partner" });

    _records = [
        { id: 1, name: "line 1", partner_id: 1 },
        { id: 2, name: "line 2", partner_id: 1 },
        { id: 3, name: "line 3", partner_id: 1 },
        { id: 4, name: "line 4", partner_id: 1 },
        { id: 5, name: "line 5", partner_id: 1 },
    ];
}

// mail is a dependency (through web_chatter_position): its models are needed
defineMailModels();
defineModels([Partner, Line]);

const TOP = ".o_control_panel .o_pager";
const BOTTOM = ".o_wup_bottom_pager .o_pager";

test("list view: the pager is repeated below the list and works", async () => {
    await mountView({
        resModel: "partner",
        type: "list",
        arch: `<list limit="2"><field name="name"/></list>`,
    });
    expect(TOP).toHaveCount(1);
    expect(BOTTOM).toHaveCount(1);
    expect(`${BOTTOM} .o_pager_counter`).toHaveText("1-2 / 5");

    await contains(`${BOTTOM} .o_pager_next`).click();
    expect(`${BOTTOM} .o_pager_counter`).toHaveText("3-4 / 5");
    expect(`${TOP} .o_pager_counter`).toHaveText("3-4 / 5");
    expect(queryAllTexts(".o_data_cell")).toEqual(["third", "fourth"]);

    // the range can be edited in the bottom pager as well
    await contains(`${BOTTOM} .o_pager_value`).click();
    await contains(`${BOTTOM} input.o_pager_value`).edit("1-4");
    expect(`${TOP} .o_pager_counter`).toHaveText("1-4 / 5");
    expect(".o_data_row").toHaveCount(4);

    await contains(`${TOP} .o_pager_next`).click();
    expect(`${BOTTOM} .o_pager_counter`).toHaveText("5-5 / 5");
});

test("list view: no bottom pager when the feature is disabled", async () => {
    patchWithCleanup(features, { bottomPager: false });
    await mountView({
        resModel: "partner",
        type: "list",
        arch: `<list limit="2"><field name="name"/></list>`,
    });
    expect(TOP).toHaveCount(1);
    expect(".o_wup_bottom_pager").toHaveCount(0);
});

test("kanban view: the pager is repeated below the records", async () => {
    await mountView({
        resModel: "partner",
        type: "kanban",
        arch: `
            <kanban limit="2">
                <templates><t t-name="card"><field name="name"/></t></templates>
            </kanban>`,
    });
    expect(`${BOTTOM} .o_pager_counter`).toHaveText("1-2 / 5");
    await contains(`${BOTTOM} .o_pager_next`).click();
    expect(`${TOP} .o_pager_counter`).toHaveText("3-4 / 5");
    expect(queryAllTexts(".o_kanban_record:not(.o_kanban_ghost)")).toEqual(["third", "fourth"]);
});

test("form view: the record pager is repeated below the form", async () => {
    await mountView({
        resModel: "partner",
        type: "form",
        resId: 1,
        resIds: [1, 2, 3],
        arch: `<form><field name="name"/></form>`,
    });
    expect(`${BOTTOM} .o_pager_counter`).toHaveText("1 / 3");
    await contains(`${BOTTOM} .o_pager_next`).click();
    expect(`${BOTTOM} .o_pager_counter`).toHaveText("2 / 3");
    expect(`${TOP} .o_pager_counter`).toHaveText("2 / 3");
    expect(".o_field_widget[name=name] input").toHaveValue("second");
    await contains(`${BOTTOM} .o_pager_previous`).click();
    expect(".o_field_widget[name=name] input").toHaveValue("first");
});

test("x2many list in a form: second pager below the list if there are several pages", async () => {
    await mountView({
        resModel: "partner",
        type: "form",
        resId: 1,
        arch: `
            <form>
                <field name="line_ids">
                    <list limit="2"><field name="name"/></list>
                </field>
            </form>`,
    });
    const X2M_TOP = ".o_field_widget[name=line_ids] .o_x2m_control_panel .o_pager";
    const X2M_BOTTOM = ".o_field_widget[name=line_ids] .o_wup_x2m_bottom_pager .o_pager";
    expect(X2M_TOP).toHaveCount(1);
    expect(X2M_BOTTOM).toHaveCount(1);
    await contains(`${X2M_BOTTOM} .o_pager_next`).click();
    expect(`${X2M_TOP} .o_pager_counter`).toHaveText("3-4 / 5");
    expect(`${X2M_BOTTOM} .o_pager_counter`).toHaveText("3-4 / 5");
    expect(queryAllTexts(".o_field_widget[name=line_ids] .o_data_cell")).toEqual([
        "line 3",
        "line 4",
    ]);
});

test("x2many list in a form: no pager at all if everything fits on one page", async () => {
    await mountView({
        resModel: "partner",
        type: "form",
        resId: 1,
        arch: `
            <form>
                <field name="line_ids">
                    <list limit="10"><field name="name"/></list>
                </field>
            </form>`,
    });
    expect(".o_field_widget[name=line_ids] .o_pager").toHaveCount(0);
});
