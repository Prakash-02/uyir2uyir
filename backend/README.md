# U2U Backend

Python 3.12 FastAPI modular monolith deployed on Cloud Run (`asia-south1`).

- **Backend Specification & Brief:** [docs/BACKEND.md](../docs/BACKEND.md)
- **System Architecture:** [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)
- **API Contract:** [docs/API_CONTRACT.md](../docs/API_CONTRACT.md)
- **AI Design & Safety:** [docs/AI_DESIGN.md](../docs/AI_DESIGN.md)

---

## Database Seeding

Seed the simulated demo database (3 Chennai hospitals, 2 blood centres, 30 donors, and initial app config):

```bash
cd backend && DATA_MODE=demo STORE=firestore .venv/bin/python scripts/seed.py
```

On Windows PowerShell:
```powershell
cd backend
$env:DATA_MODE="demo"; $env:STORE="firestore"; .\.venv\Scripts\python.exe scripts/seed.py
```

