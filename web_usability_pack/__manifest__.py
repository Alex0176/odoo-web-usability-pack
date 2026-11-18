# Copyright 2026 Biricon IT Services GmbH
# License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl).
{
    "name": "Web Usability Pack",
    "summary": "Pager at the bottom, page size and first/last page, undo/redo "
    "in forms, jump to missing required fields, Ctrl+S and more",
    "version": "19.0.1.0.0",
    "category": "Web",
    "author": "Biricon IT Services GmbH",
    "website": "https://www.biricon.eu",
    "license": "AGPL-3",
    "depends": [
        "base_setup",
        "web",
        # OCA/web
        "web_chatter_position",
        "web_refresher",
        "web_remember_tree_column_width",
        "web_widget_one2many_tree_line_duplicate",
    ],
    "data": [
        "views/res_config_settings_views.xml",
    ],
    "assets": {
        "web.assets_backend": [
            "web_usability_pack/static/src/**/*.js",
            "web_usability_pack/static/src/**/*.scss",
            # The extensions of the core templates are loaded right after the
            # templates they extend: a template that inherits from one of them
            # in "primary" mode (the buttons of the form view dialogs, the
            # x2many fields of other modules, ...) only gets the extensions
            # that are registered before it.
            (
                "after",
                "web/static/src/core/pager/pager.xml",
                "web_usability_pack/static/src/pager_extras/pager_extras.xml",
            ),
            (
                "after",
                "web/static/src/search/control_panel/control_panel.xml",
                "web_usability_pack/static/src/pager_extras/control_panel_pager.xml",
            ),
            (
                "after",
                "web/static/src/search/layout.xml",
                "web_usability_pack/static/src/bottom_pager/bottom_pager.xml",
            ),
            (
                "after",
                "web/static/src/views/fields/x2many/x2many_field.xml",
                "web_usability_pack/static/src/bottom_pager/x2many_bottom_pager.xml",
            ),
            (
                "after",
                "web/static/src/views/form/form_controller.xml",
                "web_usability_pack/static/src/form_undo/form_undo.xml",
            ),
        ],
        "web.assets_unit_tests": [
            "web_usability_pack/static/tests/**/*",
        ],
    },
    "installable": True,
    "application": False,
    "auto_install": False,
}
