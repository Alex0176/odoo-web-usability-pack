# Copyright 2026 Biricon IT Services GmbH
# License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl).

from odoo import models


class IrHttp(models.AbstractModel):
    _inherit = "ir.http"

    def session_info(self):
        result = super().session_info()
        if result.get("is_internal_user"):
            result["web_usability_pack"] = self.env[
                "res.config.settings"
            ]._web_usability_features()
        return result
