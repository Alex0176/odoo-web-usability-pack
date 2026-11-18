/* Copyright 2026 Biricon IT Services GmbH
 * License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl). */

import { Component, useState } from "@odoo/owl";
import { Pager } from "@web/core/pager/pager";
import { patch } from "@web/core/utils/patch";
import { Layout } from "@web/search/layout";
import { X2ManyField } from "@web/views/fields/x2many/x2many_field";
import { features } from "../features";

/**
 * Second pager displayed below the content of a view. It uses the very same
 * props as the pager of the control panel (`env.config.pagerProps`, filled by
 * the `usePager` hook of the list, kanban and form controllers), so both
 * pagers always show the same state and trigger the same code.
 */
export class BottomPager extends Component {
    static template = "web_usability_pack.BottomPager";
    static components = { Pager };
    static props = {};

    setup() {
        this.pagerProps = this.env.config.pagerProps
            ? useState(this.env.config.pagerProps)
            : undefined;
    }

    get isVisible() {
        // same condition as the pager of the control panel (see web.ControlPanel)
        const props = this.pagerProps;
        return features.bottomPager && !this.env.isSmall && Boolean(props) && props.total > 0;
    }

    get bottomPagerProps() {
        // The access keys (alt+p / alt+n) stay on the pager of the control panel.
        return { ...this.pagerProps, withAccessKey: false, wupExtras: "view" };
    }
}

patch(Layout.prototype, {
    // Exposed through a getter (and used with t-component) so that the patched
    // template also works for components that redefine "static components".
    get wupBottomPager() {
        return BottomPager;
    },
});

patch(X2ManyField.prototype, {
    get wupPager() {
        return Pager;
    },
    /**
     * The standard pager of an x2many field is only displayed while the list
     * has more records than its limit. Once the page size has been changed
     * with the pager, it stays: otherwise choosing a size that shows all the
     * lines would remove the only way to go back to a smaller one.
     */
    get wupShowPager() {
        const list = this.props.record.data[this.props.name];
        return (
            list.count > list.limit ||
            (features.pagerExtras && Boolean(this.wupPageSizeChanged) && list.count > 0)
        );
    },
    get wupShowBottomPager() {
        return features.bottomPager && !this.env.isSmall && this.wupShowPager;
    },
    get pagerProps() {
        const pagerProps = super.pagerProps;
        const onUpdate = pagerProps.onUpdate;
        return {
            ...pagerProps,
            onUpdate: (params, ...args) => {
                if (params.limit !== pagerProps.limit) {
                    this.wupPageSizeChanged = true;
                }
                return onUpdate(params, ...args);
            },
        };
    },
});
