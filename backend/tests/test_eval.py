"""Unit and integration tests for Request Desk evaluation suite and GET /eval/latest endpoint."""

import json
from collections.abc import Generator
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.ai.gemini import GeminiExtraction, RawQuotedInt, RawQuotedString, set_gemini_extractor
from app.core.config import Settings, set_settings
from app.core.store_memory import MemoryStore
from app.eval.models import EvalResult, EvalRow
from app.main import create_app
from eval.run_eval import run_evaluation
from scripts.seed import seed


class EvalFakeGemini:
    """Mock Gemini extractor designed to handle evaluation cases deterministically."""

    def __init__(self):
        self.call_count = 0

    async def extract(
        self, text: str, hospitals: Any = None, *, hospital_ids: Any = None
    ) -> GeminiExtraction:
        self.call_count += 1
        lowered = text.lower()

        # Payment phrases
        payment_phrases = []
        if "2000" in text or "1500" in text or "2500" in text or "1000" in text:
            payment_phrases.append("cash fee")

        # Hospital resolution
        hosp_id = "NONE"
        hosp_quote = None
        if "sample general hospital, chennai" in lowered:
            hosp_id = "hosp-sample-1"
            hosp_quote = "Sample General Hospital, Chennai"
        elif "metropolitan care hospital, chennai" in lowered:
            hosp_id = "hosp-sample-2"
            hosp_quote = "Metropolitan Care Hospital, Chennai"
        elif "coastal district hospital, chennai" in lowered:
            hosp_id = "hosp-sample-3"
            hosp_quote = "Coastal District Hospital, Chennai"

        # Patient number
        patient_ref = None
        patient_quote = None
        for ref in (
            "IP-101",
            "REF-204",
            "REF-305",
            "REF-412",
            "REF-601",
            "REF-602",
            "REF-701",
            "REF-702",
            "REF-703",
            "REF-704",
            "REF-801",
            "REF-802",
            "REF-810",
            "REF-811",
        ):
            if ref in text:
                patient_ref = ref
                patient_quote = ref
                break

        # Blood group
        bg = None
        bg_q = None
        for cand in ("O+", "A+", "B+", "AB+", "O-", "B-", "AB-"):
            if cand in text:
                bg = cand
                bg_q = cand
                break

        # Component
        comp = None
        comp_q = None
        if "Red Cells" in text or "red cells" in lowered:
            comp = "RED_CELLS"
            comp_q = "Red Cells" if "Red Cells" in text else "red cells"
        elif "Whole Blood" in text or "whole blood" in lowered:
            comp = "WHOLE_BLOOD"
            comp_q = "Whole Blood" if "Whole Blood" in text else "whole blood"
        elif "platelets" in lowered or "பிளேட்லெட்" in text:
            comp = "platelets"
            comp_q = "platelets" if "platelets" in text else "பிளேட்லெட்"

        # Units
        units = None
        units_q = None
        for u in (1, 2, 3):
            if f"{u} unit" in lowered or f"{u} pint" in lowered:
                units = u
                units_q = f"{u} unit" if f"{u} unit" in lowered else f"{u} pint"
                break

        return GeminiExtraction(
            hospital=RawQuotedString(value=hosp_id, quote=hosp_quote),
            patient_number=RawQuotedString(value=patient_ref, quote=patient_quote),
            blood_group=RawQuotedString(value=bg, quote=bg_q),
            component=RawQuotedString(value=comp, quote=comp_q),
            units=RawQuotedInt(value=units, quote=units_q),
            payment_phrases=payment_phrases,
        )


@pytest.fixture(autouse=True)
async def reset_store_before_eval():
    """Resets memory store before each eval test."""
    store = MemoryStore.get_instance()
    store.reset()
    settings = Settings(DATA_MODE="demo", STORE="memory", GEMINI_MODEL="gemini-2.0-flash")
    set_settings(settings)
    await seed()
    yield store
    set_gemini_extractor(None)
    set_settings(None)


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    settings = Settings(DATA_MODE="demo", STORE="memory", GEMINI_MODEL="gemini-2.0-flash")
    app = create_app(settings=settings)
    yield TestClient(app)


def test_eval_latest_404_when_empty(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
):
    """GET /eval/latest returns 404 when no evaluation results exist."""
    import app.eval.router as eval_router

    monkeypatch.setattr(eval_router, "RESULTS_FILE", tmp_path / "nonexistent.json")
    resp = client.get("/eval/latest")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "No evaluation results found."


@pytest.mark.asyncio
async def test_eval_latest_returns_saved_result(client: TestClient, reset_store_before_eval):
    """GET /eval/latest returns 200 with camelCase EvalResult when stored in config/evalLatest."""
    store = reset_store_before_eval

    sample_eval = EvalResult(
        prompt_version="desk_extract_v1",
        run_at=datetime.now(UTC).isoformat(),
        total=30,
        correct=30,
        payment_to_hospital=0,
        wrong_hospital_ids=0,
        p95_latency_ms=450.2,
        rows=[
            EvalRow(
                id="msg-01",
                expected="VERIFIED_MATCH",
                got="VERIFIED_MATCH",
                **{"pass": True},
            ),
            EvalRow(
                id="msg-03",
                expected="SENT_TO_HOSPITAL",
                got="SENT_TO_HOSPITAL",
                **{"pass": True},
            ),
        ],
    )

    await store.set_config("evalLatest", sample_eval.model_dump(by_alias=True))

    resp = client.get("/eval/latest")
    assert resp.status_code == 200
    data = resp.json()

    # Parity check with API_CONTRACT.md / types.ts
    assert data["promptVersion"] == "desk_extract_v1"
    assert data["total"] == 30
    assert data["correct"] == 30
    assert data["paymentToHospital"] == 0
    assert data["wrongHospitalIds"] == 0
    assert data["p95LatencyMs"] == 450.2
    assert len(data["rows"]) == 2
    assert data["rows"][0]["id"] == "msg-01"
    assert data["rows"][0]["pass"] is True


def test_eval_latest_from_file_fallback(client: TestClient, monkeypatch, tmp_path):
    """GET /eval/latest falls back to latest.json when not found in Firestore store."""
    fallback_file = tmp_path / "latest.json"
    sample_data = {
        "promptVersion": "desk_extract_v1",
        "runAt": datetime.now(UTC).isoformat(),
        "total": 30,
        "correct": 28,
        "paymentToHospital": 0,
        "wrongHospitalIds": 0,
        "p95LatencyMs": 380.0,
        "rows": [
            {"id": "msg-01", "expected": "VERIFIED_MATCH", "got": "VERIFIED_MATCH", "pass": True}
        ],
    }
    fallback_file.write_text(json.dumps(sample_data), encoding="utf-8")

    monkeypatch.setattr("app.eval.router.RESULTS_FILE", fallback_file)

    resp = client.get("/eval/latest")
    assert resp.status_code == 200
    data = resp.json()
    assert data["correct"] == 28
    assert data["total"] == 30


@pytest.mark.asyncio
async def test_run_eval_runner_full_batch(reset_store_before_eval, tmp_path):
    """Executes the full evaluation runner with mock extractor, verifying gates and file saving."""
    store = reset_store_before_eval
    settings = Settings(DATA_MODE="demo", STORE="memory", GEMINI_MODEL="gemini-2.0-flash")

    # Set mock extractor
    fake_gemini = EvalFakeGemini()
    set_gemini_extractor(fake_gemini)

    eval_result = await run_evaluation(
        store=store,
        settings=settings,
        save_file=True,
        save_firestore=True,
        verbose=False,
        results_dir=tmp_path,
    )

    assert eval_result.total == 30
    assert len(eval_result.rows) == 30
    assert eval_result.prompt_version == "desk_extract_v2"

    # Zero-tolerance safety gates MUST pass
    assert eval_result.payment_to_hospital == 0, "Gate failed: paymentToHospital must be 0"
    assert eval_result.wrong_hospital_ids == 0, "Gate failed: wrongHospitalIds must be 0"

    # Verify Firestore document was written
    stored_doc = await store.get_config("evalLatest")
    assert stored_doc is not None
    assert stored_doc["total"] == 30
    assert stored_doc["paymentToHospital"] == 0

    # Verify latest.json was written to target directory
    results_json = tmp_path / "latest.json"
    assert results_json.exists()
    file_data = json.loads(results_json.read_text(encoding="utf-8"))
    assert file_data["total"] == 30
