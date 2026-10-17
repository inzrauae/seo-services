#!/usr/bin/env python3
"""Submit seoservice.lk URLs to IndexNow so Bing, Yandex, Seznam, Naver and
other participating engines can crawl new or changed pages within minutes.

IndexNow does NOT notify Google. For Google, keep sitemap.xml lastmod values
accurate, link new pages from the blog index, and use Search Console's
URL Inspection > Request Indexing for the most important new URLs.

Run it only AFTER the new pages are live on https://seoservice.lk/ (the key
file below must also be reachable at KEY_LOCATION).

Usage (from the repository root):
    python scripts/indexnow-submit.py --dry-run              # list what would be sent
    python scripts/indexnow-submit.py --since 2026-10-17     # URLs with lastmod >= date
    python scripts/indexnow-submit.py --all                  # every URL in sitemap.xml
    python scripts/indexnow-submit.py --url https://seoservice.lk/blog

Requires only the Python standard library.
"""
import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

HOST = "seoservice.lk"
KEY = "00ed23337c3d483ebea5dbf8ebd3dbdf"
KEY_LOCATION = f"https://{HOST}/{KEY}.txt"
ENDPOINT = "https://api.indexnow.org/indexnow"
SITEMAP = Path(__file__).resolve().parent.parent / "sitemap.xml"
BATCH = 10000  # IndexNow accepts up to 10,000 URLs per request


def read_sitemap(since=None):
    xml = SITEMAP.read_text(encoding="utf-8")
    urls = []
    for block in re.findall(r"<url>(.*?)</url>", xml, re.S):
        loc = re.search(r"<loc>(.*?)</loc>", block)
        lastmod = re.search(r"<lastmod>(.*?)</lastmod>", block)
        if not loc:
            continue
        if since and (not lastmod or lastmod.group(1) < since):
            continue
        urls.append(loc.group(1).strip())
    return urls


def submit(urls):
    payload = json.dumps(
        {"host": HOST, "key": KEY, "keyLocation": KEY_LOCATION, "urlList": urls}
    ).encode("utf-8")
    req = urllib.request.Request(
        ENDPOINT,
        data=payload,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status
    except urllib.error.HTTPError as err:
        return err.code


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    group = ap.add_mutually_exclusive_group(required=True)
    group.add_argument("--all", action="store_true", help="submit every URL in sitemap.xml")
    group.add_argument("--since", metavar="YYYY-MM-DD", help="submit URLs whose lastmod is on/after this date")
    group.add_argument("--url", action="append", help="submit specific URL(s); repeatable")
    ap.add_argument("--dry-run", action="store_true", help="print the URLs without sending")
    args = ap.parse_args()

    if args.url:
        urls = args.url
    elif args.all:
        urls = read_sitemap()
    else:
        urls = read_sitemap(since=args.since)

    bad = [u for u in urls if not u.startswith(f"https://{HOST}/")]
    if bad:
        sys.exit(f"Refusing to submit URLs outside https://{HOST}/ : {bad[:3]}")
    if not urls:
        sys.exit("No URLs matched.")

    print(f"{len(urls)} URL(s) selected")
    for u in urls[:10]:
        print("  ", u)
    if len(urls) > 10:
        print(f"   ... and {len(urls) - 10} more")
    if args.dry_run:
        print("Dry run: nothing sent.")
        return

    # IndexNow status codes: 200 = received, 202 = received (key validation pending),
    # 400 = bad request, 403 = key not valid / key file not found, 422 = URL/host mismatch, 429 = too many requests
    for i in range(0, len(urls), BATCH):
        chunk = urls[i:i + BATCH]
        status = submit(chunk)
        print(f"Batch {i // BATCH + 1}: HTTP {status} ({len(chunk)} URLs)")
        if status not in (200, 202):
            sys.exit(f"IndexNow returned HTTP {status}. Check that {KEY_LOCATION} is live and the URLs are public.")
    print("Done.")


if __name__ == "__main__":
    main()
