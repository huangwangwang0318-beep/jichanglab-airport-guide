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
CYCLES = {"monthly", "quarterly", "semiannual", "annual", "one_time", "unknown"}
RESETS = {"monthly", "fixed_total", "unknown"}
SOURCES = {"user_historical_summary", "verified_screenshot", "public_price_page", "user_invitation_only"}
PROVIDERS = {"六六云", "星辰VPN", "西游云", "山水云", "魔戒", "网际快车", "FlyBit", "超实惠加速", "乌龟云", "红杏云"}


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
        if price is not None:
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
        for plan in self.plans:
            if plan["provider"] == "山水云":
                self.assertEqual(plan["traffic_reset_rule"], "fixed_total")
                self.assertEqual(plan["validity_days"], 365)

    def test_ten_providers_and_source_provenance(self):
        self.assertEqual({p["provider"] for p in self.plans}, PROVIDERS)
        for p in self.plans:
            if p["provider"] in {"FlyBit", "超实惠加速", "乌龟云", "红杏云"}:
                self.assertEqual(p["source_type"], "user_invitation_only")
                self.assertIsNone(p["price_cny"])
                self.assertIsNone(p["traffic_gb"])
                self.assertEqual(p["billing_cycle"], "unknown")
            else:
                self.assertEqual(p["source_type"], "user_historical_summary")
                self.assertEqual(p["observed_date"], "2026-10")

    def test_no_unapproved_external_links_in_content(self):
        """The open-source demo must stay clean; commercial source uses exact invitation URLs."""
        from urllib.parse import urlsplit
        commercial = ROOT / "commercial-site"
        approved = set(json.loads((commercial / "affiliate-links.json").read_text(encoding="utf-8")).values())
        self.assertEqual(len(approved), 10)
        allowed_hosts = {"jichanglab.net", "json-schema.org", "wiki.metacubex.one", "127.0.0.1", "localhost"}
        pages_demo = "https://huangwangwang0318-beep.github.io/jichanglab-airport-guide/"
        for file in ROOT.rglob("*"):
            if not file.is_file() or file.suffix not in {".md", ".html", ".json"}:
                continue
            content = file.read_text(encoding="utf-8")
            urls = re.findall(r"https?://[^\s<>\]\)\"']+", content)
            published = ROOT / "tools" / "airport-plan-calculator" / "site"
            if commercial in file.parents:
                self.assertTrue(all(url in approved for url in urls), (file, urls))
            elif published in file.parents:
                # The only non-clickable external identifier is the JSON-LD
                # schema.org context on the calculator homepage. HTML anchors
                # are separately checked in the Pages payload verifier.
                def approved_page_url(url):
                    return (url in approved or url.startswith(pages_demo)
                            or (file == published / "index.html"
                                and url == "https://schema.org"
                                and '<script type="application/ld+json">' in content))
                self.assertTrue(all(approved_page_url(url) for url in urls), (file, urls))
            elif file == ROOT / "README.md":
                # The repository landing README itself may link to ten existing
                # commission targets and to its own verified GitHub Pages guides.
                self.assertTrue(all(url in approved or url.startswith(pages_demo) for url in urls), (file, urls))
            else:
                self.assertTrue(all(url == pages_demo or urlsplit(url).hostname in allowed_hosts for url in urls), (file, urls))

    def test_commercial_pages_and_exact_affiliate_targets(self):
        """All ten brands have real pages, and every outbound CTA is approved and sponsored."""
        from html.parser import HTMLParser
        class LinkParser(HTMLParser):
            def __init__(self):
                super().__init__()
                self.links = []
            def handle_starttag(self, tag, attrs):
                if tag == "a":
                    self.links.append(dict(attrs))
        commercial = ROOT / "commercial-site"
        approved = set(json.loads((commercial / "affiliate-links.json").read_text(encoding="utf-8")).values())
        pages = sorted(commercial.rglob("index.html"))
        self.assertEqual(len(pages), 11)
        outbound = set()
        for page in pages:
            content = page.read_text(encoding="utf-8")
            self.assertEqual(content.count("<h1"), 1, page)
            parser = LinkParser()
            parser.feed(content)
            for a in parser.links:
                href = a.get("href", "")
                if href.startswith(("http://", "https://")):
                    self.assertIn(href, approved, (page, href))
                    self.assertIn("sponsored", a.get("rel", "").split(), page)
                    outbound.add(href)
        self.assertEqual(outbound, approved)
        for filename in ("commercial-site/assets/app.js", "commercial-site/assets/site.css"):
            text = (ROOT / filename).read_text(encoding="utf-8")
            self.assertNotRegex(text, r"https?://|fetch\(|XMLHttpRequest|sendBeacon")


if __name__ == "__main__":
    unittest.main()
