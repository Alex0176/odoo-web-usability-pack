/* Copyright 2026 Biricon IT Services GmbH
 * License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl). */

import { defineMailModels } from "@mail/../tests/mail_test_helpers";
import { expect, test } from "@odoo/hoot";
import { queryAllTexts } from "@odoo/hoot-dom";
import { animationFrame } from "@odoo/hoot-mock";
import {
    contains,
    defineModels,
    fields,
    models,
    mountView,
    onRpc,
} from "@web/../tests/web_test_helpers";

// Checks that the features of this module get along with the OCA modules it
// depends on (web_refresher, web_widget_one2many_tree_line_duplicate).

class Partner extends models.Model {
    name = fields.Char();
    line_ids = fields.One2many({ relation: "line", relation_field: "partner_id" });

    _records = [
        { id: 1, name: "first", line_ids: [1, 2] },
        { id: 2, name: "second" },
        { id: 3, name: "third" },
    ];
}

class Line extends models.Model {
    name = fields.Char();
    qty = fields.Integer();
    sequence = fields.Integer();
    partner_id = fields.Many2one({ relation: "partner" });

    _records = [
        { id: 1, name: "line 1", qty: 1, sequence: 1, partner_id: 1 },
        { id: 2, name: "line 2", qty: 2, sequence: 2, partner_id: 1 },
    ];
}

// mail is a dependency (through web_chatter_position): its models are needed
defineMailModels();
defineModels([Partner, Line]);

test("web_refresher: the refresh button stays next to the top pager only", async () => {
    await mountView({
        resModel: "partner",
        type: "list",
        arch: `<list limit="2"><field name="name"/></list>`,
    });
    expect(".o_control_panel .oe_cp_refresher .oe_pager_refresh").toHaveCount(1);
    expect(".o_wup_bottom_pager .oe_pager_refresh").toHaveCount(0);
    expect(".o_control_panel .o_wup_pager_size").toHaveCount(1);

    await contains(".o_wup_bottom_pager .o_pager_next").click();
    await contains(".o_control_panel .oe_pager_refresh").click();
    await animationFrame();
    // refreshing keeps the page
    expect(".o_wup_bottom_pager .o_pager_counter").toHaveText("3-3 / 3");
});

test("line duplicate: duplicating a line is one step that can be undone", async () => {
    // not implemented by the mock server: the copies get the values they are sent
    onRpc("onchange_batch", ({ args }) =>
        args[0].map((values) => ({
            value: { name: values.name, qty: values.qty, sequence: values.sequence },
        }))
    );
    await mountView({
        resModel: "partner",
        type: "form",
        resId: 1,
        arch: `
            <form>
                <field name="line_ids" options="{'allow_clone': True}">
                    <list editable="bottom">
                        <field name="sequence" widget="handle"/>
                        <field name="name"/>
                        <field name="qty"/>
                    </list>
                </field>
            </form>`,
    });
    const lines = () =>
        queryAllTexts(".o_field_widget[name=line_ids] .o_data_row").map((text) =>
            text.replace(/\s+/g, " ").trim()
        );
    expect(lines()).toEqual(["line 1 1", "line 2 2"]);

    await contains(".o_data_row:eq(0) .o_list_duplicate_line button").click();
    await animationFrame();
    expect(lines()).toHaveLength(3);
    expect(lines().filter((line) => line === "line 1 1")).toHaveLength(2);
    expect(".o_wup_undo").toBeEnabled();

    await contains(".o_wup_undo").click();
    await animationFrame();
    expect(lines()).toEqual(["line 1 1", "line 2 2"]);
    expect(".o_wup_undo").not.toBeEnabled();

    await contains(".o_wup_redo").click();
    await animationFrame();
    expect(lines()).toHaveLength(3);
});
