# Copyright 2026 Biricon IT Services GmbH
# License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl).

from odoo import api, fields, models

# feature key (as sent to the web client) -> default when the parameter is unset
FEATURE_DEFAULTS = {
    "bottom_pager": True,
    "form_undo": True,
    "ctrl_save": True,
    "jump_invalid": True,
    "pager_extras": True,
    "unsaved_title": True,
    "form_full_width": False,
}
PARAM_PREFIX = "web_usability_pack."


class ResConfigSettings(models.TransientModel):
    _inherit = "res.config.settings"

    # These fields deliberately do not use ``config_parameter``: a boolean
    # stored that way is *deleted* when unchecked, which would silently bring
    # back the "enabled" default of the features below.
    web_usability_bottom_pager = fields.Boolean(
        string="Pager at the Bottom",
        help="Repeat the pager below lists, kanban views, forms and "
        "sub-lists so that users do not have to scroll back up.",
    )
    web_usability_form_undo = fields.Boolean(
        string="Undo / Redo in Forms",
        help="Undo and redo unsaved field changes in form views "
        "(Ctrl+Z, Ctrl+Y or Ctrl+Shift+Z and two buttons).",
    )
    web_usability_ctrl_save = fields.Boolean(
        string="Save with Ctrl+S",
        help="Save the current form with Ctrl+S instead of opening the "
        "browser dialog for saving the web page.",
    )
    web_usability_jump_invalid = fields.Boolean(
        string="Jump to Missing Required Fields",
        help="When a form cannot be saved because of missing required "
        "fields, open the tab of the first one, scroll to it and focus it.",
    )
    web_usability_pager_extras = fields.Boolean(
        string="Page Size and First / Last Page in Pagers",
        help="Add a page size selector (20, 40, 80, 200) and buttons to "
        "jump to the first and to the last page to the pagers.",
    )
    web_usability_unsaved_title = fields.Boolean(
        string="Unsaved Changes in the Browser Tab",
        help="Mark the title of the browser tab while the form that is "
        "displayed has unsaved changes.",
    )
    web_usability_form_full_width = fields.Boolean(
        string="Full-Width Forms",
        help="Let form sheets use the whole available width on large screens.",
    )

    @api.model
    def _web_usability_features(self):
        """Return the state of every feature as ``{key: bool}``."""
        get_param = self.env["ir.config_parameter"].sudo().get_param
        result = {}
        for key, default in FEATURE_DEFAULTS.items():
            value = get_param(PARAM_PREFIX + key)
            if value in (None, False, ""):
                result[key] = default
            else:
                result[key] = str(value).strip().lower() in ("1", "true", "yes")
        return result

    @api.model
    def get_values(self):
        res = super().get_values()
        for key, value in self._web_usability_features().items():
            res["web_usability_" + key] = value
        return res

    def set_values(self):
        res = super().set_values()
        set_param = self.env["ir.config_parameter"].sudo().set_param
        current = self._web_usability_features()
        for key in FEATURE_DEFAULTS:
            value = bool(self["web_usability_" + key])
            if value != current[key]:
                set_param(PARAM_PREFIX + key, "True" if value else "False")
        return res
