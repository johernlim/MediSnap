"""Conservative normalization preserving numbers and medicine name boundaries."""
from collections import Counter
import re
import unicodedata


def normalize_text(value: str | None) -> str:
    value = unicodedata.normalize('NFKC', value or '').casefold()
    value = re.sub(r'(?<=\d)\s*(?=mg\b|mcg\b|g\b|ml\b|iu\b)', ' ', value)
    value = re.sub(r'[^\w\s.]', ' ', value)
    value = re.sub(r'(?<!\d)\.|\.(?!\d)', ' ', value)
    return ' '.join(value.split())


def contains_phrase(haystack: str | None, needle: str | None) -> bool:
    h, n = normalize_text(haystack), normalize_text(needle)
    return bool(n) and f' {n} ' in f' {h} '


def contains_same_tokens(haystack: str | None, needle: str | None) -> bool:
    """Return true when every normalized needle token occurs in the haystack.

    Token counts are preserved, so this permits word reordering without treating
    a partial brand, a different strength, or a missing dosage form as the same
    printed product name.
    """
    haystack_tokens = Counter(normalize_text(haystack).split())
    needle_tokens = Counter(normalize_text(needle).split())
    return bool(needle_tokens) and all(
        haystack_tokens[token] >= count for token, count in needle_tokens.items())


def same_tokens(left: str | None, right: str | None) -> bool:
    """Compare normalized text as a token multiset instead of by word order."""
    left_tokens = Counter(normalize_text(left).split())
    right_tokens = Counter(normalize_text(right).split())
    return bool(left_tokens) and left_tokens == right_tokens


def strengths(value: str | None) -> set[str]:
    # Keep ratios intact: 10 mg is not equivalent to 10 mg / 5 ml.
    return {re.sub(r'\s+', '', match.group()).casefold() for match in re.finditer(
        r'\b\d+(?:\.\d+)?\s*(?:mcg|mg|g|ml|iu|%)(?:\s*/\s*\d*(?:\.\d+)?\s*(?:ml|g|dose))?',
        value or '', re.IGNORECASE)}
