"""Read-only indexed search; all SQL values are parameterized."""
from contextlib import closing
import logging
from pathlib import Path
import re
import sqlite3

from ..models.schemas import Medicine, SearchResponse
from ..utils.errors import ProcessingError
from ..utils.text_utils import normalize_text

logger = logging.getLogger(__name__)
STOP_WORDS = {'tablet', 'tablets', 'capsule', 'capsules', 'mg', 'ml', 'mcg', 'medicine',
              'the', 'and', 'for', 'sdn', 'bhd', 'ltd', 'inc', 'limited'}


class NPRAService:
    def __init__(self, path: Path):
        self.path = Path(path)

    def connect(self):
        # mode=ro never accidentally creates an empty database.
        connection = sqlite3.connect(self.path.resolve().as_uri() + '?mode=ro', uri=True, timeout=5)
        connection.row_factory = sqlite3.Row
        return connection

    def health(self) -> tuple[bool, int, str | None]:
        try:
            with closing(self.connect()) as connection:
                count = connection.execute('SELECT count(*) FROM medicines').fetchone()[0]
                stamp = connection.execute("SELECT value FROM metadata WHERE key='imported_at'").fetchone()
                connection.execute('SELECT rowid FROM medicine_fts LIMIT 1').fetchone()
                return count > 0, count, stamp[0] if stamp else None
        except sqlite3.Error as exc:
            logger.warning('npra_unavailable error_type=%s', type(exc).__name__)
            return False, 0, None

    def _query(self, query: str, parameters: tuple) -> list[Medicine]:
        try:
            with closing(self.connect()) as connection:
                return [Medicine.model_validate(dict(row)) for row in connection.execute(query, parameters)]
        except sqlite3.Error as exc:
            logger.error('npra_query_failed error_type=%s', type(exc).__name__)
            raise ProcessingError('The NPRA database is unavailable. Import the official dataset and retry.') from exc

    def get(self, medicine_id: int) -> Medicine | None:
        result = self._query('SELECT * FROM medicines WHERE id=?', (medicine_id,))
        return result[0] if result else None

    def search(self, imprint=None, visible_text=None, brand_name=None, manufacturer=None,
               active_ingredient=None, registration_number=None, limit: int = 500) -> SearchResponse:
        values = [imprint, brand_name, registration_number, *(visible_text or [])]
        registrations = {m.group().upper() for value in values if value for m in
                         re.finditer(r'\bMAL\d{8}[A-Z]+\b', value, re.I)}
        if len(registrations) == 1:
            exact = self._query('SELECT * FROM medicines WHERE normalized_registration_number=?',
                                (normalize_text(next(iter(registrations))),))
            if exact:
                return SearchResponse(results=exact)
        if not any(value and normalize_text(value) not in STOP_WORDS for value in values):
            values.extend([manufacturer, active_ingredient])
        terms = set()
        for value in values:
            for term in re.findall(r'\w+', normalize_text(value)):
                if len(term) >= 3 and term not in STOP_WORDS:
                    terms.add(term)
        if not terms:
            return SearchResponse(results=[])
        # Prefix matching finds FENO-TG from FENO; the matcher separately applies
        # exact token boundaries. Retrieval is intentionally broader than scoring.
        expression = ' OR '.join('"' + term + '"*' for term in sorted(terms)[:100])
        records = self._query('''SELECT m.* FROM medicine_fts f
            JOIN medicines m ON m.id=f.rowid WHERE medicine_fts MATCH ?
            ORDER BY bm25(medicine_fts), m.registration_number LIMIT ?''', (expression, limit+1))
        return SearchResponse(results=records[:limit], truncated=len(records) > limit or len(terms) > 100)
