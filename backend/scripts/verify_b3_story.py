import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("GEMINI_MODEL", "gemini-2.0-flash")
os.environ.setdefault("DATA_MODE", "demo")
os.environ.setdefault("STORE", "memory")

import asyncio

from fastapi.testclient import TestClient

from app.core.store_memory import MemoryStore
from app.main import create_app
from scripts.seed import seed


async def main():
    print("[*] Initializing store and seeding fixtures...")
    store = MemoryStore.get_instance()
    store.reset()
    await seed()

    app = create_app()
    client = TestClient(app)

    print("[*] 1. Hospital raising blood request for 2 units of O+ WHOLE_BLOOD...")
    resp = client.post(
        "/requests",
        headers={"X-Demo-Role": "hospital", "X-Demo-Hospital-Id": "hosp-sample-1"},
        json={
            "bloodGroup": "O+",
            "component": "WHOLE_BLOOD",
            "unitsNeeded": 2,
            "patientRef": "PATIENT-DEMO-01",
        },
    )
    req = resp.json()
    req_id = req["id"]
    print(f"    Created request: {req_id}, status: {req['status']}, round: {req['round']}")

    round_calls = list(store._calls.get(req_id, {}).values())
    print(
        f"    Dispatched {len(round_calls)} calls in round {req['round']} via SimulatorAdapter (all RINGING)."
    )

    sorted_calls = sorted(round_calls, key=lambda c: c.distance_km)
    call_1 = sorted_calls[0]
    call_2 = sorted_calls[1]
    call_3 = sorted_calls[2]

    print("[*] 2. Donors pressing keys in simulator...")
    c1 = client.post(f"/sim/calls/{call_1.id}/press", json={"key": "1"}).json()
    print(f"    Donor 1 ({call_1.donor_alias}) pressed 1 -> {c1['state']}")

    c2 = client.post(f"/sim/calls/{call_2.id}/press", json={"key": "1"}).json()
    print(f"    Donor 2 ({call_2.donor_alias}) pressed 1 -> {c2['state']}")

    c3 = client.post(f"/sim/calls/{call_3.id}/press", json={"key": "1"}).json()
    print(f"    Donor 3 ({call_3.donor_alias}) pressed 1 -> {c3['state']}")

    status_data = client.get(f"/requests/{req_id}/status").json()
    print(f"    Request status after 3 donors on the way (N+1 reached): {status_data['status']}")

    print("[*] 3. Blood centre staff clinically accepting arriving donors...")
    acc1 = client.post(
        f"/calls/{call_1.id}/accept",
        headers={"X-Demo-Role": "staff", "X-Demo-Centre-Id": "centre-sample-1"},
    ).json()
    print(f"    Staff accepted Donor 1 -> call state: {acc1['state']}")

    acc2 = client.post(
        f"/calls/{call_2.id}/accept",
        headers={"X-Demo-Role": "staff", "X-Demo-Centre-Id": "centre-sample-1"},
    ).json()
    print(f"    Staff accepted Donor 2 -> call state: {acc2['state']}")

    final_status = client.get(f"/requests/{req_id}/status").json()
    print(f"\n[FINAL STATUS] Request {final_status['id']} is {final_status['status']}.")
    print(
        f"               Hospital: {final_status['hospitalName']}, Group: {final_status['bloodGroup']}"
    )

    events = store._events.get(req_id, [])
    print(f"\n[TIMELINE EVENTS] ({len(events)} events recorded):")
    for e in events:
        print(f"  - [{e.kind}] {e.text}")


if __name__ == "__main__":
    asyncio.run(main())
