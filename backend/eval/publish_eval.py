"""Publishes local evaluation results (backend/eval/results/latest.json)

to the Firestore config doc 'evalLatest' in the u2u-demo database.

Uses local Application Default Credentials (ADC).
Target database: u2u-demo
Target document: config/evalLatest
"""

import json
import os
import sys
from pathlib import Path
from typing import Any

from google.cloud import firestore

PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "uyir2uyir-53929")
DATABASE_ID = os.environ.get("FIRESTORE_DB", "u2u-demo")

RESULTS_FILE = Path(__file__).resolve().parent / "results" / "latest.json"


def load_latest_results() -> dict[str, Any]:
    if not RESULTS_FILE.exists():
        print(f"[ERROR] Evaluation results file not found at: {RESULTS_FILE}", file=sys.stderr)
        sys.exit(1)

    try:
        data = json.loads(RESULTS_FILE.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"[ERROR] Failed to parse {RESULTS_FILE}: {e}", file=sys.stderr)
        sys.exit(1)

    required_keys = [
        "promptVersion",
        "runAt",
        "total",
        "correct",
        "paymentToHospital",
        "wrongHospitalIds",
        "p95LatencyMs",
        "rows",
    ]
    for key in required_keys:
        if key not in data:
            print(f"[ERROR] Missing required field '{key}' in {RESULTS_FILE}", file=sys.stderr)
            sys.exit(1)

    return data


def publish_eval() -> None:
    print(f"[*] Loading evaluation results from: {RESULTS_FILE}")
    results = load_latest_results()

    total = results["total"]
    correct = results["correct"]
    accuracy = (correct / total * 100) if total else 0.0

    print(f"    Total test samples : {total}")
    print(f"    Correct extractions: {correct} ({accuracy:.1f}%)")
    print(f"    Payment to hosp    : {results['paymentToHospital']}")
    print(f"    Wrong hospital IDs : {results['wrongHospitalIds']}")
    print(f"    p95 latency (ms)   : {results['p95LatencyMs']:.2f}")

    print(f"[*] Connecting to Firestore (Project: '{PROJECT_ID}', Database: '{DATABASE_ID}')...")
    try:
        client = firestore.Client(project=PROJECT_ID, database=DATABASE_ID)
    except Exception as e:
        print(f"[ERROR] Failed to initialize Firestore client: {e}", file=sys.stderr)
        print(
            "Please ensure you are authenticated with: gcloud auth application-default login",
            file=sys.stderr,
        )
        sys.exit(1)

    print("    Publishing to config/evalLatest...")
    try:
        doc_ref = client.collection("config").document("evalLatest")
        doc_ref.set(results)
        print(f"[OK] Successfully wrote evalLatest to Firestore: config/evalLatest ({DATABASE_ID})")
    except Exception as e:
        print(f"[ERROR] Failed to write document to Firestore: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    publish_eval()
