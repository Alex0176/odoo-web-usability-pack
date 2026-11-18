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
    models,
    mountView,
    onRpc,
    patchWithCleanup,
} from "@web/../tests/web_test_helpers";
import { features } from "@web_usability_pack/features";

class Partner extends models.Model {
    name = fields.Char();
    code = fields.Char();
    line_ids = fields.One2many({ relation: "line", relation_field: "partner_id" });

    _records = [{ id: 1, name: "first", code: "", line_ids: [1, 2, 3] }];
}

class Line extends models.Model {
    name = fields.Char();
    qty = fields.Integer();
    partner_id = fields.Many2one({ relation: "partner" });

    _records = [
        { id: 1, name: "line 1", qty: 1, partner_id: 1 },
        { id: 2, name: "line 2", qty: 2, partner_id: 1 },
        { id: 3, name: "line 3", qty: 3, partner_id: 1 },
    ];
}

// mail is a dependency (through web_chatter_position): its models are needed
defineMailModels();
defineModels([Partner, Line]);

const ARCH = `
    <form>
        <sheet>
            <field name="name"/>
            <notebook>
                <page string="First" name="first">
                    <field name="line_ids">
                        <list editable="bottom" limit="2">
                            <field name="name" required="1"/>
                            <field name="qty"/>
                        </list>
                    </field>
                </page>
                <page string="Second" name="second">
                    <field name="code" required="1"/>
                </page>
            </notebook>
        </sheet>
    </form>`;

/**
 * Waits until the jump is over: it needs a few frames (rendering of the
 * invalid classes, of the tab, of the page of the list).
 */
async function settle() {
    for (let i = 0; i < 8; i++) {
        await animationFrame();
    }
}

test("the tab of the missing required field is opened and the field is focused", async () => {
    onRpc("web_save", () => expect.step("web_save"));
    await mountView({ resModel: "partner", type: "form", resId: 1, arch: ARCH });
    expect(".o_notebook_headers .nav-link.active").toHaveText("First");

    await contains(".o_field_widget[name=name] input").edit("changed");
    await clickSave();
    await settle();

    expect.verifySteps([]);
    expect(".o_notification").toHaveCount(1); // the standard message stays
    expect(".o_notebook_headers .nav-link.active").toHaveText("Second");
    expect(".o_field_widget[name=code] input").toBeFocused();
});

test("the tab is not changed when the feature is disabled", async () => {
    patchWithCleanup(features, { jumpInvalid: false });
    await mountView({ resModel: "partner", type: "form", resId: 1, arch: ARCH });
    await contains(".o_field_widget[name=name] input").edit("changed");
    await clickSave();
    await settle();
    expect(".o_notebook_headers .nav-link.active").toHaveText("First");
    expect(".o_notebook_headers .nav-link.o_page_invalid").toHaveText("Second");
});

test("an invalid field that is displayed is preferred to one in another tab", async () => {
    await mountView({
        resModel: "partner",
        type: "form",
        resId: 1,
        arch: ARCH.replace(`<field name="name"/>`, `<field name="name" required="1"/>`),
    });
    await contains(".o_field_widget[name=name] input").edit("");
    await clickSave();
    await settle();
    expect(".o_notebook_headers .nav-link.active").toHaveText("First");
    expect(".o_field_widget[name=name] input").toBeFocused();
});

test("invalid line of an x2many list in another tab and on another page", async () => {
    Partner._records[0].code = "ok";
    onRpc("web_save", () => expect.step("web_save"));
    await mountView({ resModel: "partner", type: "form", resId: 1, arch: ARCH });
    const ROWS = ".o_field_widget[name=line_ids] .o_data_row";

    // empty the required name of the third line, which is on the second page
    await contains(".o_field_widget[name=line_ids] .o_x2m_control_panel .o_pager_next").click();
    expect(ROWS).toHaveCount(1);
    await contains(`${ROWS} td[name=name]`).click();
    await contains(`${ROWS} td[name=name] input`).edit("", { confirm: "blur" });

    // go back to the first page of the list, and to the other tab
    await contains(".o_field_widget[name=line_ids] .o_x2m_control_panel .o_pager_previous").click();
    await contains(".o_notebook_headers .nav-link:contains(Second)").click();
    expect(".o_field_widget[name=line_ids]").toHaveCount(0);

    await clickSave();
    await settle();

    expect.verifySteps([]);
    expect(".o_notebook_headers .nav-link.active").toHaveText("First");
    // the page of the list that contains the invalid line is displayed ...
    expect(".o_field_widget[name=line_ids] .o_x2m_control_panel .o_pager_counter").toHaveText(
        "3-3 / 3"
    );
    // ... and the line is opened on the invalid cell
    expect(`${ROWS}.o_selected_row`).toHaveCount(1);
    expect(`${ROWS} td[name=name] input`).toBeFocused();
});
