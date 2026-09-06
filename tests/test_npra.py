import sqlite3
import pytest
from app.database.database import import_csv
from app.services.npra_service import NPRAService
from app.utils.errors import ProcessingError


@pytest.mark.parametrize('query,count', [('TESTPRODUCT 10mg', 2), ('testprod', 2),
    ('MAL00000001T', 1), ('nonsense', 0), ('" OR 1=1 --', 0)])
def test_search(npra_db, query, count):
    assert len(NPRAService(npra_db).search(visible_text=[query]).results) == count


def test_indexed_lookup_and_missing_fields(npra_db):
    service = NPRAService(npra_db)
    product = service.search(visible_text=['MAL00000001T']).results[0]
    assert service.get(product.id).product_name == product.product_name
    assert product.strength is None and product.imprint is None and product.dosage_form is None
    assert product.id < 2**53
    assert service.health()[1] == 2
    assert service.search(visible_text=['TESTPRODUCT'], limit=1).truncated


def test_repeat_import_no_duplicates(tmp_path, npra_db):
    before = NPRAService(npra_db).search(visible_text=['TESTPRODUCT']).results
    stats = import_csv(tmp_path / 'npra.csv', npra_db)
    after = NPRAService(npra_db).search(visible_text=['TESTPRODUCT']).results
    assert stats['records_imported'] == 2
    assert before == after


def test_exact_registration_avoids_broad_manufacturer_truncation(npra_db):
    result = NPRAService(npra_db).search(registration_number='MAL00000001T',
        manufacturer='TEST MAKER', visible_text=['TESTPRODUCT'], limit=1)
    assert len(result.results) == 1 and not result.truncated
    assert result.results[0].registration_number == 'MAL00000001T'


def test_malformed_report_and_duplicate_manufacturers(tmp_path):
    source, dest = tmp_path / 'rows.csv', tmp_path / 'rows.db'
    source.write_text('reg_no,product,manufacturer\nA,TEST,Maker A\nA,TEST,Maker B\nB,,Maker C\n')
    stats = import_csv(source, dest)
    assert stats['records_skipped'] == 1 and stats['duplicates'] == 1
    assert stats['malformed_rows'][0]['row'] == 4
    assert NPRAService(dest).search(visible_text=['TEST']).results[0].manufacturer == 'Maker A\nMaker B'
    with sqlite3.connect(dest) as connection:
        assert connection.execute('SELECT count(*) FROM source_rows').fetchone()[0] == 2


@pytest.mark.parametrize('content', ['wrong,columns\na,b\n', 'reg_no,product\n,\n',
    'reg_no,product\nA,TEST\nA,CONFLICT\n'])
def test_failed_import_preserves_snapshot(tmp_path, npra_db, content):
    source = tmp_path / 'invalid.csv'
    source.write_text(content)
    with pytest.raises(ValueError):
        import_csv(source, npra_db)
    assert NPRAService(npra_db).health()[1] == 2


def test_missing_empty_corrupt_databases(tmp_path):
    path = tmp_path / 'absent.db'
    service = NPRAService(path)
    assert service.health()[0] is False
    with pytest.raises(ProcessingError):
        service.search(imprint='TEST')
    assert not path.exists()
    path.write_bytes(b'not sqlite')
    assert service.health()[0] is False
