/* Copyright 2026 Biricon IT Services GmbH
 * License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl). */

import { Pager } from "@web/core/pager/pager";
import { patch } from "@web/core/utils/patch";
import { features } from "../features";

export const PAGE_SIZES = [20, 40, 80, 200];

/**
 * Page size selector and "first page" / "last page" buttons for the standard
 * pager. They are opt-in through the `wupExtras` prop, which is only set on
 * the pagers of the control panel, of the x2many fields and on the pagers
 * this module adds at the bottom: other pagers (e.g. the small ones of the
 * groups of a grouped list) stay as they are.
 *
 *  - "view": pager of a view (list, kanban, form, ...)
 *  - "x2many": pager of a one2many / many2many field
 */
patch(Pager, {
    props: {
        ...Pager.props,
        wupExtras: { type: String, optional: true },
    },
});

patch(Pager.prototype, {
    get wupShowExtras() {
        return features.pagerExtras && Boolean(this.props.wupExtras) && !this.env.isSmall;
    },

    /**
     * The record pager of a form view goes through the records one by one:
     * a page size makes no sense there.
     */
    get wupShowPageSize() {
        return (
            this.wupShowExtras &&
            (this.props.wupExtras === "x2many" || this.env.config?.viewType !== "form")
        );
    },

    get wupPageSizes() {
        const sizes = [...PAGE_SIZES];
        if (!sizes.includes(this.props.limit)) {
            // e.g. a limit set in the view, or a range typed in the pager
            sizes.push(this.props.limit);
            sizes.sort((a, b) => a - b);
        }
        return sizes;
    },

    get wupIsFirstPage() {
        return this.props.offset === 0;
    },

    get wupIsLastPage() {
        // if the real total is unknown, there may always be a further page
        return !this.props.updateTotal && this.maximum >= this.props.total;
    },

    async wupGoToFirstPage() {
        if (!this.wupIsFirstPage) {
            await this.update(0, this.props.limit, true);
        }
    },

    async wupGoToLastPage() {
        const limit = this.props.limit;
        let total = this.props.total;
        if (this.props.updateTotal) {
            total = await this.props.updateTotal();
        }
        const offset = Math.max(total - (total % limit || limit), 0);
        if (offset !== this.props.offset) {
            await this.update(offset, limit, true);
        }
    },

    /**
     * @param {Event} ev
     */
    async wupOnPageSizeChange(ev) {
        const limit = parseInt(ev.target.value, 10);
        if (!limit || limit === this.props.limit) {
            return;
        }
        // stay on the page that contains the first record displayed so far
        const offset = Math.floor(this.props.offset / limit) * limit;
        await this.update(offset, limit);
    },
});
