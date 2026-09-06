"""Atomic NPRA snapshot import with source provenance and FTS5 search indexes."""
from contextlib import closing
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import tempfile

import pandas as pd

from ..models.schemas import Medicine
from ..utils.text_utils import normalize_text

SOURCE_URL = 'https://storage.data.gov.my/healthcare/pharmaceutical_products.csv'
CATALOGUE_URL = 'https://data.gov.my/data-catalogue/pharmaceutical_products'
# Verified against the actual downloaded official CSV header. Description is a
# regulatory product category, NOT dosage form. Missing fields stay null.
COLUMN_MAP = {
    'reg_no': 'registration_number', 'product': 'product_name', 'status': 'registration_status',
    'description': 'description', 'holder': 'holder', 'manufacturer': 'manufacturer',
    'date_reg': 'registration_date', 'date_end': 'expiry_date',
    'active_ingredient': 'active_ingredient', 'generic_name': 'generic_name',
}
SEARCH_FIELDS = ['product_name', 'generic_name', 'active_ingredient', 'manufacturer', 'registration_number']
DB_FIELDS = [name for name in Medicine.model_fields if name != 'source']


def import_csv(source: Path, destination: Path) -> dict:
    """Replace a complete snapshot atomically; failed imports leave the old DB intact.

    IDs derive from registration numbers so API links survive repeated imports.
    CSV structural errors fail loudly. Invalid records are reported with row numbers.
    Manufacturer alternatives are retained; other conflicting duplicates abort.
    """
    frame = pd.read_csv(source, dtype=str, keep_default_na=False, encoding='utf-8-sig')
    columns = {str(c): normalize_text(str(c)).replace(' ', '_') for c in frame.columns}
    if len(set(columns.values())) != len(columns):
        raise ValueError('Duplicate normalized column names')
    frame = frame.rename(columns=columns)
    required = {'reg_no', 'product'}
    if not required.issubset(frame.columns):
        raise ValueError(f'Missing required columns: {sorted(required - set(frame.columns))}')
    mapping = {c: target for c, target in COLUMN_MAP.items() if c in frame.columns}
    stats = {'source_columns': list(frame.columns), 'column_mapping': mapping,
             'unmapped_columns': [c for c in frame.columns if c not in mapping],
             'records_imported': 0, 'records_skipped': 0, 'duplicates': 0, 'malformed_rows': []}
    records = {}
    source_rows = []
    for index, row in frame.iterrows():
        record = {target: str(row[c]).strip() or None for c, target in mapping.items()}
        if not record.get('registration_number') or not record.get('product_name'):
            stats['malformed_rows'].append({'row': int(index)+2, 'reason': 'Missing registration or product'})
            stats['records_skipped'] += 1
            continue
        registration = record['registration_number'].upper()
        source_rows.append((registration, json.dumps(row.to_dict(), ensure_ascii=False)))
        record['registration_number'] = registration
        record['id'] = int(hashlib.sha256(registration.encode()).hexdigest()[:13], 16)
        if registration in records:
            existing = records[registration]
            if any(existing.get(k) != v for k, v in record.items() if k != 'manufacturer'):
                raise ValueError(f'Conflicting duplicate registration at CSV row {index + 2}')
            manufacturers = (existing.get('manufacturer') or '').split('\n')
            new_manufacturer = record.get('manufacturer')
            if new_manufacturer and normalize_text(new_manufacturer) not in {normalize_text(m) for m in manufacturers}:
                existing['manufacturer'] = '\n'.join(m for m in [*manufacturers, new_manufacturer] if m)
            stats['duplicates'] += 1
            continue
        records[registration] = record
    if not records:
        raise ValueError('No valid records; existing database was not changed')
    destination.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(prefix='npra-', suffix='.db', dir=destination.parent)
    os.close(handle)
    try:
        with closing(sqlite3.connect(temporary)) as connection, connection:
            declarations = ','.join(f'{field} INTEGER PRIMARY KEY' if field == 'id'
                else f'{field} TEXT' + (' UNIQUE NOT NULL' if field == 'registration_number' else '')
                for field in DB_FIELDS)
            normalized = ','.join(f'normalized_{field} TEXT' for field in SEARCH_FIELDS)
            connection.execute(f'CREATE TABLE medicines ({declarations}, {normalized}, source_json TEXT)')
            connection.execute('CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
            connection.execute('CREATE TABLE source_rows (registration_number TEXT, source_json TEXT)')
            connection.executemany('INSERT INTO source_rows VALUES (?,?)', source_rows)
            connection.execute('CREATE INDEX idx_source_registration ON source_rows(registration_number)')
            connection.execute('CREATE VIRTUAL TABLE medicine_fts USING fts5(search_text)')
            fields = DB_FIELDS + [f'normalized_{f}' for f in SEARCH_FIELDS] + ['source_json']
            for record in records.values():
                normalized_values = [normalize_text(record.get(f)) for f in SEARCH_FIELDS]
                values = [record.get(f) for f in DB_FIELDS] + normalized_values + [json.dumps(record)]
                connection.execute(f"INSERT INTO medicines ({','.join(fields)}) VALUES ({','.join('?' for _ in fields)})", values)
                connection.execute('INSERT INTO medicine_fts(rowid, search_text) VALUES (?,?)',
                                   (record['id'], ' '.join(normalized_values)))
            for field in SEARCH_FIELDS:
                connection.execute(f'CREATE INDEX idx_{field} ON medicines(normalized_{field})')
            metadata = {'source_url': SOURCE_URL, 'catalogue_url': CATALOGUE_URL,
                        'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                        'imported_at': datetime.now(timezone.utc).isoformat(),
                        'source_columns': json.dumps(list(frame.columns)), 'schema_version': '1',
                        'record_count': str(len(records))}
            connection.executemany('INSERT INTO metadata VALUES (?,?)', metadata.items())
            connection.execute('PRAGMA user_version=1')
        os.replace(temporary, destination)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    stats['records_imported'] = len(records)
    stats['database'] = str(destination.resolve())
    return stats
