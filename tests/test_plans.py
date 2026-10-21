"""Validate historical plan data with Python's standard library."""
import datetime
import json
import math
import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
REQUIRED = {
    "provider", "plan_id", "plan_name", "price_cny", "billing_cycle",
    "traffic_gb", "traffic_reset_rule", "validity_days", "device_limit",
    "observed_date", "source_type",
}
CYCLES = {"monthly", "quarterly", "semiannual", "annual", "one_time"}
RESETS = {"monthly", "fixed_total", "unknown"}
SOURCES = {"user_historical_summary", "verified_screenshot", "public_price_page"}


class PlanDataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.plans = json.loads((ROOT / "data/plans.json").read_text(encoding="utf-8"))
        cls.schema = json.loads((ROOT / "data/schema.json").read_text(encoding="utf-8"))

    def test_json_shape_and_schema_alignment(self):
        self.assertIsInstance(self.plans, list)
        self.assertGreater(len(self.plans), 0)
        self.assertEqual(set(self.schema["items"]["required"]), REQUIRED)
        self.assertEqual(set(self.schema["items"]["properties"]["billing_cycle"]["enum"]), CYCLES)
        self.assertEqual(set(self.schema["items"]["properties"]["traffic_reset_rule"]["enum"]), RESETS)

    def test_identifiers_and_required_fields(self):
        ids = []
        for plan in self.plans:
            self.assertTrue(REQUIRED <= plan.keys(), plan)
            self.assertTrue(set(plan) <= set(self.schema["items"]["properties"]), plan)
            for field in ("provider", "plan_id", "plan_name"):
                self.assertIsInstance(plan[field], str)
                self.assertTrue(plan[field].strip(), plan)
            self.assertRegex(plan["plan_id"], r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
            ids.append(plan["plan_id"])
        self.assertEqual(len(ids), len(set(ids)))

    def test_numbers_and_enums(self):
        for plan in self.plans:
            self.assertIn(plan["billing_cycle"], CYCLES, plan)
            self.assertIn(plan["traffic_reset_rule"], RESETS, plan)
            self.assertIn(plan["source_type"], SOURCES, plan)
            price = plan["price_cny"]
            self.assertIsInstance(price, (int, float), plan)
            self.assertFalse(isinstance(price, bool), plan)
            self.assertTrue(math.isfinite(price) and price >= 0, plan)
            traffic = plan["traffic_gb"]
            if traffic is not None:
                self.assertIsInstance(traffic, (int, float), plan)
                self.assertFalse(isinstance(traffic, bool), plan)
                self.assertTrue(math.isfinite(traffic) and traffic > 0, plan)
            for field in ("validity_days", "device_limit"):
                value = plan[field]
                if value is not None:
                    self.assertIsInstance(value, int, plan)
                    self.assertFalse(isinstance(value, bool), plan)
                    self.assertGreater(value, 0, plan)

    def test_date_format_and_calendar(self):
        for plan in self.plans:
            value = plan["observed_date"]
            self.assertRegex(value, r"^\d{4}-\d{2}(?:-\d{2})?$")
            datetime.date.fromisoformat(value + "-01" if len(value) == 7 else value)

    def test_cycle_reset_consistency(self):
        for plan in self.plans:
            if plan["billing_cycle"] == "one_time":
                self.assertEqual(plan["traffic_reset_rule"], "fixed_total", plan)
            if plan["traffic_reset_rule"] == "monthly":
                self.assertNotEqual(plan["billing_cycle"], "one_time", plan)
            if plan["traffic_reset_rule"] == "fixed_total" and plan["validity_days"] is not None:
                self.assertGreater(plan["validity_days"], 0, plan)
        by_id = {p["plan_id"]: p for p in self.plans}
        self.assertEqual(by_id["yuetong-mini-annual"]["billing_cycle"], "annual")
        self.assertEqual(by_id["yuetong-mini-annual"]["traffic_reset_rule"], "monthly")
        for plan in self.plans:
            if plan["provider"] == "山水云":
                self.assertEqual(plan["traffic_reset_rule"], "fixed_total")
                self.assertEqual(plan["validity_days"], 365)

    def test_ten_providers_and_source_provenance(self):
        self.assertEqual(len({p["provider"] for p in self.plans}), 10)
        self.assertTrue(all(p["observed_date"] == "2026-10" for p in self.plans))
        self.assertTrue(all(p["source_type"] == "user_historical_summary" for p in self.plans))


if __name__ == "__main__":
    unittest.main()
