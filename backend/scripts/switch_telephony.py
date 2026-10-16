"""Script to inspect or switch telephony adapter in Firestore or memory store.

Usage:
  python scripts/switch_telephony.py twilio
  python scripts/switch_telephony.py simulator
  python scripts/switch_telephony.py
"""

import asyncio
import os
import sys
from datetime import UTC, datetime

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import get_settings
from app.core.store import get_store


async def main() -> None:
    settings = get_settings()
    store = get_store()

    target_adapter = sys.argv[1].lower() if len(sys.argv) > 1 else None

    current_conf = await store.get_config("telephony") or {}
    current_adapter = current_conf.get("adapter", "simulator")

    if target_adapter is None:
        print(f"[*] Current telephony adapter: {current_adapter}")
        print(f"    Consecutive errors: {current_conf.get('consecutiveErrors', 0)}")
        print(f"    Last error: {current_conf.get('lastError', 'None')}")
        print(f"    Updated at: {current_conf.get('updatedAt', 'None')}")
        print("\nUsage to change: python scripts/switch_telephony.py [twilio|simulator]")
        return

    if target_adapter not in ("twilio", "simulator"):
        sys.stderr.write(
            f"Error: Invalid adapter '{target_adapter}'. Must be 'twilio' or 'simulator'.\n"
        )
        sys.exit(1)

    now_iso = datetime.now(UTC).isoformat()
    current_conf["adapter"] = target_adapter
    current_conf["consecutiveErrors"] = 0
    current_conf["updatedAt"] = now_iso

    await store.set_config("telephony", current_conf)
    print(f"[OK] Telephony adapter switched to '{target_adapter}' in config/telephony.")
    print(
        f"     Storage: {settings.STORE} ({settings.FIRESTORE_DB if settings.STORE == 'firestore' else 'in-memory'})"
    )


if __name__ == "__main__":
    asyncio.run(main())
