import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.core.store import get_store
from app.eval.models import EvalResult

router = APIRouter(tags=["eval"])

RESULTS_FILE = Path(__file__).resolve().parent.parent.parent / "eval" / "results" / "latest.json"


@router.get("/eval/latest", response_model=EvalResult)
async def get_latest_eval() -> EvalResult:
    """Returns the latest Request Desk evaluation result, or 404 if none yet."""
    store = get_store()
    doc = await store.get_config("evalLatest")
    if doc:
        return EvalResult.model_validate(doc)

    # Secondary check on local filesystem (backend/eval/results/latest.json)
    if RESULTS_FILE.exists():
        try:
            content = RESULTS_FILE.read_text(encoding="utf-8")
            data = json.loads(content)
            return EvalResult.model_validate(data)
        except Exception:
            pass

    raise HTTPException(status_code=404, detail="No evaluation results found.")
