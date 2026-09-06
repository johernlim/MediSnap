"""Download/inspect/import the official NPRA CSV. Run from repository root."""
import argparse
import json
from pathlib import Path
import sys
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))

from app.config import Settings  # noqa: E402
from app.database.database import SOURCE_URL, import_csv  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT / 'backend/data/npra/pharmaceutical_products.csv')
    parser.add_argument('--database', type=Path, default=Settings().npra_database_path)
    parser.add_argument('--download', action='store_true')
    args = parser.parse_args()
    try:
        if args.download:
            args.source.parent.mkdir(parents=True, exist_ok=True)
            temporary = args.source.with_suffix('.download')
            try:
                with urllib.request.urlopen(SOURCE_URL, timeout=60) as response, temporary.open('wb') as output:
                    while chunk := response.read(1024 * 1024):
                        output.write(chunk)
                temporary.replace(args.source)
            finally:
                temporary.unlink(missing_ok=True)
        stats = import_csv(args.source, args.database)
        print('NPRA import completed.')
        print(json.dumps(stats, indent=2))
    except Exception as exc:
        print(f'NPRA import FAILED: {type(exc).__name__}: {exc}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
