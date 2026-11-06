"""HRC scorecard PDF -> data/scorecards/hrc-<congress>.csv.

Usage: npm run scorecards:hrc. Review the diff: PDF layouts change.
"""

import csv
import datetime as dt
import re
import ssl
import sys
import urllib.request
from pathlib import Path

import certifi
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent.parent
URLS = {
    119: 'https://hrc-prod-requests.s3-us-west-2.amazonaws.com/files/documents/119th-Congressional-Scorecard.pdf',
}

STATES = {
    'ALABAMA': 'AL',
    'ALASKA': 'AK',
    'AMERICAN SAMOA': 'AS',
    'ARIZONA': 'AZ',
    'ARKANSAS': 'AR',
    'CALIFORNIA': 'CA',
    'COLORADO': 'CO',
    'CONNECTICUT': 'CT',
    'DELAWARE': 'DE',
    'DISTRICT OF COLUMBIA': 'DC',
    'FLORIDA': 'FL',
    'GEORGIA': 'GA',
    'GUAM': 'GU',
    'HAWAII': 'HI',
    'IDAHO': 'ID',
    'ILLINOIS': 'IL',
    'INDIANA': 'IN',
    'IOWA': 'IA',
    'KANSAS': 'KS',
    'KENTUCKY': 'KY',
    'LOUISIANA': 'LA',
    'MAINE': 'ME',
    'MARYLAND': 'MD',
    'MASSACHUSETTS': 'MA',
    'MICHIGAN': 'MI',
    'MINNESOTA': 'MN',
    'MISSISSIPPI': 'MS',
    'MISSOURI': 'MO',
    'MONTANA': 'MT',
    'NEBRASKA': 'NE',
    'NEVADA': 'NV',
    'NEW HAMPSHIRE': 'NH',
    'NEW JERSEY': 'NJ',
    'NEW MEXICO': 'NM',
    'NEW YORK': 'NY',
    'NORTH CAROLINA': 'NC',
    'NORTH DAKOTA': 'ND',
    'NORTHERN MARIANA ISLANDS': 'MP',
    'OHIO': 'OH',
    'OKLAHOMA': 'OK',
    'OREGON': 'OR',
    'PENNSYLVANIA': 'PA',
    'PUERTO RICO': 'PR',
    'RHODE ISLAND': 'RI',
    'SOUTH CAROLINA': 'SC',
    'SOUTH DAKOTA': 'SD',
    'TENNESSEE': 'TN',
    'TEXAS': 'TX',
    'U.S. VIRGIN ISLANDS': 'VI',
    'VIRGIN ISLANDS': 'VI',
    'UTAH': 'UT',
    'VERMONT': 'VT',
    'VIRGINIA': 'VA',
    'WASHINGTON': 'WA',
    'WEST VIRGINIA': 'WV',
    'WISCONSIN': 'WI',
    'WYOMING': 'WY',
}

# "[district] Last, First [footnote] (P) s1 s2 s3 ..." where scores may carry
# a trailing ^ ("House score", for senators who served in the House) or be N/A.
SCORE = r'(\d{1,3}\^?|N/A)'
ROW = re.compile(
    rf'^(?:(?P<district>\d{{1,2}}|AL)\s+)?'
    rf'(?P<last>[^,]+),\s*(?P<first>.+?)\s*\d*\s*\((?P<party>[A-Z])\)\s+'
    rf'{SCORE}\s+{SCORE}\s+{SCORE}'
)


def fetch_pdf(congress: int) -> Path:
    url = URLS[congress]
    out = ROOT / 'data' / 'raw' / 'hrc' / dt.date.today().isoformat() / url.rsplit('/', 1)[-1]
    if not out.exists():
        out.parent.mkdir(parents=True, exist_ok=True)
        # certifi: python.org macOS builds don't ship a CA bundle by default.
        ctx = ssl.create_default_context(cafile=certifi.where())
        with urllib.request.urlopen(url, context=ctx) as res:
            out.write_bytes(res.read())
    return out


def parse(pdf: Path, congress: int) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    chamber = None
    state = None
    for page_no, page in enumerate(PdfReader(pdf).pages, start=1):
        text = page.extract_text() or ''
        if 'SENATOR (Party)' in text:
            chamber = 'senate'
        elif 'REPRESENTATIVE (Party)' in text or re.search(r'^\d+ [^,]+, .+\([RDI]\)', text, re.M):
            chamber = 'house'
        else:
            continue
        for raw in text.splitlines():
            line = raw.strip()
            if line.upper() in STATES:
                state = STATES[line.upper()]
                continue
            m = ROW.match(line)
            if not m or not state:
                continue
            scores = m.groups()[-3:]
            for offset, value in enumerate(scores):
                if value == 'N/A':
                    continue
                rows.append(
                    {
                        'chamber': chamber,
                        'state': state,
                        'district': '0' if m['district'] == 'AL' else (m['district'] or ''),
                        'last': m['last'].strip(),
                        'first': m['first'].strip(),
                        'party': m['party'],
                        'congress': str(congress - offset),
                        'score': value.rstrip('^'),
                        'note': 'House score' if value.endswith('^') else '',
                        'page': str(page_no),
                    }
                )
    return rows


def main() -> None:
    congress = int(sys.argv[1]) if len(sys.argv) > 1 else max(URLS)
    rows = parse(fetch_pdf(congress), congress)
    out = ROOT / 'data' / 'scorecards' / f'hrc-{congress}.csv'
    with out.open('w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    current = [r for r in rows if r['congress'] == str(congress)]
    by_chamber = {c: sum(r['chamber'] == c for r in current) for c in ('senate', 'house')}
    print(
        f'Wrote {len(rows)} scores ({by_chamber} for the {congress}th) to {out.relative_to(ROOT)}'
    )


if __name__ == '__main__':
    main()
