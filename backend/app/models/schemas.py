"""Public contracts separate observations from NPRA records and heuristic scores."""
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

Status = Literal['MATCH_FOUND', 'LOW_CONFIDENCE', 'AMBIGUOUS', 'UNKNOWN',
                 'NO_MEDICINE_DETECTED', 'IMAGE_TOO_POOR', 'PROCESSING_ERROR']
Level = Literal['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']
SpokenLanguage = Literal['en', 'ms', 'zh']


class MedicineVisualEvidence(BaseModel):
    model_config = ConfigDict(extra='forbid', str_max_length=2000)
    # Required nullable fields allow strict Responses API structured output.
    imprint: str | None
    visible_text: list[str] = Field(max_length=40)
    brand_name: str | None
    manufacturer: str | None
    color: str | None
    shape: str | None
    dosage: str | None
    dosage_unit: str | None
    dosage_form: str | None
    packaging_text: str | None
    other_markings: list[str] = Field(max_length=40)
    registration_number: str | None
    active_ingredient: str | None
    image_quality: Literal['good', 'fair', 'poor']
    text_visibility: Literal['clear', 'partial', 'unreadable', 'none']


class AIIdentitySuggestion(BaseModel):
    """Model-knowledge suggestion, always separate from observed/NPRA evidence."""
    model_config = ConfigDict(extra='forbid', str_max_length=2000)
    product_name: str | None
    active_ingredient: str | None
    strength: str | None
    dosage_form: str | None
    common_uses: list[str] = Field(max_length=5)
    confidence: Literal['LOW', 'MEDIUM']
    basis: str


class GeneralMedicineGuidance(BaseModel):
    """Model-generated educational guidance for one NPRA-supported product."""
    model_config = ConfigDict(extra='forbid', str_max_length=1000)
    common_uses: list[str] = Field(max_length=5)
    adult_general_dosage: str | None
    child_general_dosage: str | None
    dosage_notes: list[str] = Field(max_length=5)


class PreliminaryMedicineSummary(BaseModel):
    """Short ingredient-level help when a precise product is not confirmed."""
    model_config = ConfigDict(extra='forbid', str_max_length=1000)
    possible_name: str
    common_uses: list[str] = Field(max_length=3)


class Medicine(BaseModel):
    id: int
    product_name: str
    registration_number: str
    active_ingredient: str | None = None
    generic_name: str | None = None
    manufacturer: str | None = None
    holder: str | None = None
    dosage_form: str | None = None
    strength: str | None = None
    registration_status: str | None = None
    registration_date: str | None = None
    expiry_date: str | None = None
    description: str | None = None
    # Only populated if present in a future authoritative source, never inferred.
    imprint: str | None = None
    color: str | None = None
    shape: str | None = None
    source: str = 'Malaysian NPRA pharmaceutical product dataset'


class Candidate(BaseModel):
    medicine: Medicine
    score: float
    evidence_matches: list[str] = Field(default_factory=list)
    conflicts: list[str] = Field(default_factory=list)
    strong_identity: bool = False


class MatchResult(BaseModel):
    status: Status = 'UNKNOWN'
    confidence_level: Level = 'UNKNOWN'
    score: float = 0
    identification_confidence: float = 0
    medicine: Medicine | None = None
    candidates: list[Candidate] = Field(default_factory=list)
    message: str = 'The medicine could not be confidently identified.'
    score_description: str = 'Heuristic evidence score, not a medical probability.'


class QualityResult(BaseModel):
    usable: bool
    blur: float
    brightness: float
    width: int
    height: int
    reasons: list[str] = Field(default_factory=list)


class DetectionResult(BaseModel):
    id: int
    bbox: list[int]
    crop_bbox: list[int]
    detection_confidence: float
    class_id: int
    class_name: str
    detection_source: Literal['yolo', 'full_image_fallback'] = 'yolo'
    status: Status
    quality: QualityResult | None = None
    visual_evidence: MedicineVisualEvidence | None = None
    match: MatchResult | None = None
    ai_suggestion: AIIdentitySuggestion | None = None
    ai_suggestion_npra_status: Literal['FOUND_IN_NPRA', 'NOT_FOUND_IN_NPRA', 'NOT_CHECKED'] = 'NOT_CHECKED'
    ai_suggestion_npra_record: Medicine | None = None
    ai_suggestion_message: str | None = None
    common_uses: list[str] = Field(default_factory=list, max_length=5)
    common_uses_source: Literal['OPENAI_GENERAL_INFORMATION'] | None = None
    general_guidance: GeneralMedicineGuidance | None = None
    general_guidance_message: str | None = None
    preliminary_summary: PreliminaryMedicineSummary | None = None
    possible_guidance: GeneralMedicineGuidance | None = None
    possible_guidance_message: str | None = None
    message: str | None = None
    vision_attempted: bool = False
    timings_ms: dict[str, float] = Field(default_factory=dict)


class RecognitionResponse(BaseModel):
    success: bool
    status: Status
    message: str
    processing_time_ms: float = 0
    image_width: int | None = None
    image_height: int | None = None
    detections: list[DetectionResult] = Field(default_factory=list)
    timings_ms: dict[str, float] = Field(default_factory=dict)
    language: SpokenLanguage = 'en'
    refinement_used: bool = False
    disclaimer: str = ('This system provides medicine identification assistance only. Always verify '
                       'the medicine and its packaging with a pharmacist, doctor, or the original '
                       'prescription before taking it.')


class SearchResponse(BaseModel):
    results: list[Medicine]
    truncated: bool = False


class HealthResponse(BaseModel):
    status: Literal['healthy', 'degraded']
    yolo_loaded: bool
    npra_database: bool
    openai_configured: bool
    npra_records: int = 0
    npra_imported_at: str | None = None
    message: str
