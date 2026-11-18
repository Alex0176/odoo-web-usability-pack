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

    _records = [...Array(50).keys()].map((i) => ({
        id: i + 1,
        name: `partner ${i + 1}`,
        line_ids: i === 0 ? [...Array(45).keys()].map((j) => j + 1) : [],
    }));
}

class Line extends models.Model {
    name = fields.Char();
    partner_id = fields.Many2one({ relation: "partner" });

    _records = [...Array(45).keys()].map((j) => ({
        id: j + 1,
        name: `line ${j + 1}`,
        partner_id: 1,
    }));
}

// mail is a dependency (through web_chatter_position): its models are needed
defineMailModels();
defineModels([Partner, Line]);

const TOP = ".o_control_panel .o_pager";
const BOTTOM = ".o_wup_bottom_pager .o_pager";

test("list view: page size selector in both pagers", async () => {
    await mountView({
        resModel: "partner",
        type: "list",
        arch: `<list limit="10"><field name="name"/></list>`,
    });
    for (const pager of [TOP, BOTTOM]) {
        expect(`${pager} .o_wup_pager_size`).toHaveCount(1);
        // the limit of the view is offered in addition to the standard sizes
        expect(queryAllTexts(`${pager} .o_wup_pager_size option`)).toEqual([
            "10",
            "20",
            "40",
            "80",
            "200",
        ]);
        expect(`${pager} .o_wup_pager_size`).toHaveValue("10");
    }

    await contains(`${TOP} .o_pager_next`).click();
    expect(`${TOP} .o_pager_counter`).toHaveText("11-20 / 50");

    await contains(`${BOTTOM} .o_wup_pager_size`).select("20");
    // the page that contains the first record displayed before
    expect(`${TOP} .o_pager_counter`).toHaveText("1-20 / 50");
    expect(`${BOTTOM} .o_pager_counter`).toHaveText("1-20 / 50");
    expect(".o_data_row").toHaveCount(20);
    expect(`${TOP} .o_wup_pager_size`).toHaveValue("20");

    await contains(`${TOP} .o_wup_pager_size`).select("200");
    expect(`${BOTTOM} .o_pager_counter`).toHaveText("1-50 / 50");
    expect(".o_data_row").toHaveCount(50);
});

test("list view: first and last page", async () => {
    await mountView({
        resModel: "partner",
        type: "list",
        arch: `<list limit="20"><field name="name"/></list>`,
    });
    expect(`${TOP} .o_wup_pager_first`).not.toBeEnabled();
    expect(`${TOP} .o_wup_pager_last`).toBeEnabled();

    await contains(`${BOTTOM} .o_wup_pager_last`).click();
    expect(`${TOP} .o_pager_counter`).toHaveText("41-50 / 50");
    expect(".o_data_row").toHaveCount(10);
    expect(`${TOP} .o_wup_pager_last`).not.toBeEnabled();
    expect(`${BOTTOM} .o_wup_pager_last`).not.toBeEnabled();

    await contains(`${TOP} .o_wup_pager_first`).click();
    expect(`${BOTTOM} .o_pager_counter`).toHaveText("1-20 / 50");
    expect(`${BOTTOM} .o_wup_pager_first`).not.toBeEnabled();
});

test("nothing is added to the pagers when the feature is disabled", async () => {
    patchWithCleanup(features, { pagerExtras: false });
    await mountView({
        resModel: "partner",
        type: "list",
        arch: `<list limit="20"><field name="name"/></list>`,
    });
    expect(".o_pager").toHaveCount(2);
    expect(".o_wup_pager_size").toHaveCount(0);
    expect(".o_wup_pager_first").toHaveCount(0);
    expect(".o_wup_pager_last").toHaveCount(0);
});

test("form view: first and last record, but no page size", async () => {
    await mountView({
        resModel: "partner",
        type: "form",
        resId: 2,
        resIds: [1, 2, 3, 4],
        arch: `<form><field name="name"/></form>`,
    });
    expect(".o_wup_pager_size").toHaveCount(0);
    expect(`${TOP} .o_wup_pager_last`).toHaveCount(1);
    await contains(`${BOTTOM} .o_wup_pager_last`).click();
    expect(`${TOP} .o_pager_counter`).toHaveText("4 / 4");
    expect(".o_field_widget[name=name] input").toHaveValue("partner 4");
    await contains(`${TOP} .o_wup_pager_first`).click();
    expect(".o_field_widget[name=name] input").toHaveValue("partner 1");
});

test("x2many list: page size, first and last page in both pagers", async () => {
    await mountView({
        resModel: "partner",
        type: "form",
        resId: 1,
        arch: `
            <form>
                <field name="line_ids">
                    <list limit="20"><field name="name"/></list>
                </field>
            </form>`,
    });
    const X2M_TOP = ".o_field_widget[name=line_ids] .o_x2m_control_panel .o_pager";
    const X2M_BOTTOM = ".o_field_widget[name=line_ids] .o_wup_x2m_bottom_pager .o_pager";
    const ROWS = ".o_field_widget[name=line_ids] .o_data_row";
    expect(`${X2M_TOP} .o_wup_pager_size`).toHaveCount(1);
    expect(`${X2M_BOTTOM} .o_wup_pager_size`).toHaveCount(1);
    // the record pager of the form itself has no page size
    expect(`${TOP} .o_wup_pager_size`).toHaveCount(0);

    await contains(`${X2M_BOTTOM} .o_wup_pager_last`).click();
    expect(`${X2M_TOP} .o_pager_counter`).toHaveText("41-45 / 45");
    expect(ROWS).toHaveCount(5);

    await contains(`${X2M_TOP} .o_wup_pager_first`).click();
    expect(`${X2M_BOTTOM} .o_pager_counter`).toHaveText("1-20 / 45");

    await contains(`${X2M_TOP} .o_wup_pager_size`).select("40");
    expect(`${X2M_BOTTOM} .o_pager_counter`).toHaveText("1-40 / 45");
    expect(ROWS).toHaveCount(40);

    // all the lines fit on one page: the pagers stay, to be able to go back
    await contains(`${X2M_BOTTOM} .o_wup_pager_size`).select("200");
    expect(ROWS).toHaveCount(45);
    expect(X2M_TOP).toHaveCount(1);
    expect(X2M_BOTTOM).toHaveCount(1);
    await contains(`${X2M_TOP} .o_wup_pager_size`).select("20");
    expect(ROWS).toHaveCount(20);
});
