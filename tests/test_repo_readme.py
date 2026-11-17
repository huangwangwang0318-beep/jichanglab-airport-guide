"""Check the public GitHub repository README as the first search landing page."""
import json
import pathlib
import re
import unittest
from urllib.parse import unquote

ROOT = pathlib.Path(__file__).resolve().parents[1]
README = ROOT / "README.md"
ALLOW = ROOT / "commercial-site" / "affiliate-links.json"
OWN_PAGES = "https://huangwangwang0318-beep.github.io/jichanglab-airport-guide/"


class RepositoryReadmeSEOTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.readme = README.read_text(encoding="utf-8")
        cls.allowed = json.loads(ALLOW.read_text(encoding="utf-8"))
        cls.links = re.findall(r"\]\(([^\s)]+)\)", cls.readme)

    def test_indexable_repository_headline_is_readable_and_specific(self):
        titles = re.findall(r"^# (.+)$", self.readme, flags=re.M)
        self.assertEqual(len(titles), 1)
        self.assertTrue(titles[0].startswith("2026机场推荐与套餐对比"))
        self.assertIn("成本计算器", titles[0])
        self.assertIn("2026-10", self.readme)
        self.assertIn("2026-11-17", self.readme)

    def test_all_ten_invitation_links_exactly_once_and_disclosed(self):
        targets = set(self.allowed.values())
        self.assertEqual(len(targets), 10)
        for name, url in self.allowed.items():
            self.assertIn(name, self.readme)
            self.assertEqual(self.readme.count(url), 1, (name, url))
        external = [href for href in self.links if href.startswith(("http://", "https://"))]
        self.assertTrue(all(url in targets or url.startswith(OWN_PAGES) for url in external), external)
        self.assertEqual(set(external) & targets, targets)
        self.assertIn("推广关系披露", self.readme)
        self.assertIn("佣金", self.readme)

    def test_ten_real_brand_details_from_current_pages_build(self):
        slugs = ["liuliuyun", "xingchen", "xiyouyun", "shanshuiyun",
                 "mojie", "wangjikuache", "flybit", "chaoshihui",
                 "wuguiyun", "hongxingyun"]
        for slug in slugs:
            self.assertIn(OWN_PAGES + "brands/" + slug + "/", self.links)
            self.assertTrue((ROOT / "commercial-site" / "brands" / slug / "index.html").is_file())

    def test_local_document_links_really_exist(self):
        for href in self.links:
            if href.startswith(("http://", "https://", "#")):
                continue
            path = unquote(href.split("#", 1)[0])
            self.assertTrue((ROOT / path).exists(), f"Broken repository doc: {href}")

    def test_no_unsubstantiated_real_time_or_testing_claim(self):
        self.assertIn("历史价格资料月份", self.readme)
        self.assertIn("不是独立测速排行榜", self.readme)
        self.assertNotIn("实测完成数为 0", self.readme)
        self.assertLess(len(self.readme.encode("utf-8")), 90_000)


if __name__ == "__main__":
    unittest.main()
