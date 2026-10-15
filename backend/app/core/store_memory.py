import asyncio
from collections.abc import Awaitable, Callable
from typing import Any, TypeVar

from app.core.entities import Centre, Donor, Hospital
from app.core.store import Store, TransactionStore
from app.requests.models import BloodRequest, Call, TimelineEvent

T = TypeVar("T")


class MemoryTransactionStore(TransactionStore):
    """Transaction-scoped view over MemoryStore staging all updates in memory."""

    def __init__(self, store: "MemoryStore") -> None:
        self._store = store
        self._pending_requests: dict[str, BloodRequest] = {}
        self._pending_calls: dict[tuple[str, str], Call] = {}
        self._pending_events: list[tuple[str, TimelineEvent]] = []
        self._pending_donors: dict[str, Donor] = {}
        self._pending_configs: dict[str, dict[str, Any]] = {}
        self._pending_locks: dict[str, dict[str, Any]] = {}

    async def get_request(self, request_id: str) -> BloodRequest | None:
        if request_id in self._pending_requests:
            return self._pending_requests[request_id].model_copy(deep=True)
        req = self._store._requests.get(request_id)
        return req.model_copy(deep=True) if req else None

    async def save_request(self, request: BloodRequest) -> None:
        self._pending_requests[request.id] = request.model_copy(deep=True)

    async def get_call(self, request_id: str, call_id: str) -> Call | None:
        key = (request_id, call_id)
        if key in self._pending_calls:
            return self._pending_calls[key].model_copy(deep=True)
        calls = self._store._calls.get(request_id, {})
        call = calls.get(call_id)
        return call.model_copy(deep=True) if call else None

    async def save_call(self, request_id: str, call: Call) -> None:
        self._pending_calls[(request_id, call.id)] = call.model_copy(deep=True)

    async def list_calls(self, request_id: str) -> list[Call]:
        calls = self._store._calls.get(request_id, {})
        store_calls = {c.id: c.model_copy(deep=True) for c in calls.values()}
        for (req_id, call_id), call in self._pending_calls.items():
            if req_id == request_id:
                store_calls[call_id] = call.model_copy(deep=True)
        return list(store_calls.values())

    async def append_event(self, request_id: str, event: TimelineEvent) -> None:
        self._pending_events.append((request_id, event.model_copy(deep=True)))

    async def get_donor(self, donor_id: str) -> Donor | None:
        if donor_id in self._pending_donors:
            return self._pending_donors[donor_id].model_copy(deep=True)
        d = self._store._donors.get(donor_id)
        return d.model_copy(deep=True) if d else None

    async def save_donor(self, donor: Donor) -> None:
        self._pending_donors[donor.id] = donor.model_copy(deep=True)

    async def get_config(self, config_id: str) -> dict[str, Any] | None:
        if config_id in self._pending_configs:
            return dict(self._pending_configs[config_id])
        conf = self._store._configs.get(config_id)
        return dict(conf) if conf is not None else None

    async def set_config(self, config_id: str, data: dict[str, Any]) -> None:
        self._pending_configs[config_id] = dict(data)

    async def get_lock(self, lock_id: str) -> dict[str, Any] | None:
        if lock_id in self._pending_locks:
            return dict(self._pending_locks[lock_id])
        lock = self._store._locks.get(lock_id)
        return dict(lock) if lock is not None else None

    async def set_lock(self, lock_id: str, data: dict[str, Any]) -> None:
        self._pending_locks[lock_id] = dict(data)

    def apply(self) -> None:
        """Applies all staged updates into the backing MemoryStore."""
        for req in self._pending_requests.values():
            self._store._requests[req.id] = req

        for (req_id, call_id), call in self._pending_calls.items():
            if req_id not in self._store._calls:
                self._store._calls[req_id] = {}
            self._store._calls[req_id][call_id] = call

        for req_id, event in self._pending_events:
            if req_id not in self._store._events:
                self._store._events[req_id] = []
            self._store._events[req_id].append(event)

        for donor in self._pending_donors.values():
            self._store._donors[donor.id] = donor

        for config_id, conf in self._pending_configs.items():
            self._store._configs[config_id] = conf

        for lock_id, lock_data in self._pending_locks.items():
            self._store._locks[lock_id] = lock_data


class MemoryStore(Store):
    """Thread-safe, coroutine-safe in-memory store for offline development and testing."""

    _instance: "MemoryStore | None" = None

    def __init__(self, data_mode: str = "demo") -> None:
        self.data_mode = data_mode
        self._lock = asyncio.Lock()
        self._hospitals: dict[str, Hospital] = {}
        self._centres: dict[str, Centre] = {}
        self._donors: dict[str, Donor] = {}
        self._requests: dict[str, BloodRequest] = {}
        self._calls: dict[str, dict[str, Call]] = {}
        self._events: dict[str, list[TimelineEvent]] = {}
        self._configs: dict[str, dict[str, Any]] = {}
        self._locks: dict[str, dict[str, Any]] = {}

    @classmethod
    def get_instance(cls) -> "MemoryStore":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @classmethod
    def reset_instance(cls) -> None:
        cls._instance = cls()

    def reset(self) -> None:
        """Clears all stored records."""
        self._hospitals.clear()
        self._centres.clear()
        self._donors.clear()
        self._requests.clear()
        self._calls.clear()
        self._events.clear()
        self._configs.clear()
        self._locks.clear()

    # Hospitals
    async def get_hospital(self, hospital_id: str) -> Hospital | None:
        async with self._lock:
            h = self._hospitals.get(hospital_id)
            return h.model_copy(deep=True) if h else None

    async def save_hospital(self, hospital: Hospital) -> None:
        async with self._lock:
            doc = hospital.model_copy(
                update={"is_simulated": self.data_mode == "demo", "data_mode": self.data_mode},
                deep=True,
            )
            self._hospitals[hospital.id] = doc

    async def list_hospitals(self) -> list[Hospital]:
        async with self._lock:
            return [h.model_copy(deep=True) for h in self._hospitals.values()]

    # Centres
    async def get_centre(self, centre_id: str) -> Centre | None:
        async with self._lock:
            c = self._centres.get(centre_id)
            return c.model_copy(deep=True) if c else None

    async def save_centre(self, centre: Centre) -> None:
        async with self._lock:
            doc = centre.model_copy(
                update={"is_simulated": self.data_mode == "demo", "data_mode": self.data_mode},
                deep=True,
            )
            self._centres[centre.id] = doc

    async def list_centres(self) -> list[Centre]:
        async with self._lock:
            return [c.model_copy(deep=True) for c in self._centres.values()]

    # Donors
    async def get_donor(self, donor_id: str) -> Donor | None:
        async with self._lock:
            d = self._donors.get(donor_id)
            return d.model_copy(deep=True) if d else None

    async def save_donor(self, donor: Donor) -> None:
        async with self._lock:
            doc = donor.model_copy(
                update={"is_simulated": self.data_mode == "demo", "data_mode": self.data_mode},
                deep=True,
            )
            self._donors[donor.id] = doc

    async def list_donors(self) -> list[Donor]:
        async with self._lock:
            return [d.model_copy(deep=True) for d in self._donors.values()]

    # Requests
    async def get_request(self, request_id: str) -> BloodRequest | None:
        async with self._lock:
            req = self._requests.get(request_id)
            return req.model_copy(deep=True) if req else None

    async def save_request(self, request: BloodRequest) -> None:
        async with self._lock:
            doc = request.model_copy(
                update={"is_simulated": self.data_mode == "demo"},
                deep=True,
            )
            self._requests[request.id] = doc

    async def list_requests_by_hospital(self, hospital_id: str) -> list[BloodRequest]:
        async with self._lock:
            return [
                req.model_copy(deep=True)
                for req in self._requests.values()
                if req.hospital_id == hospital_id
            ]

    async def list_requests_by_centre(self, centre_id: str) -> list[BloodRequest]:
        async with self._lock:
            return [
                req.model_copy(deep=True)
                for req in self._requests.values()
                if req.centre_id == centre_id
            ]

    async def list_all_requests(self) -> list[BloodRequest]:
        async with self._lock:
            return [req.model_copy(deep=True) for req in self._requests.values()]

    # Calls
    async def get_call(self, request_id: str, call_id: str) -> Call | None:
        async with self._lock:
            calls = self._calls.get(request_id, {})
            call = calls.get(call_id)
            return call.model_copy(deep=True) if call else None

    async def save_call(self, request_id: str, call: Call) -> None:
        async with self._lock:
            if request_id not in self._calls:
                self._calls[request_id] = {}
            self._calls[request_id][call.id] = call.model_copy(deep=True)

    async def list_calls(self, request_id: str) -> list[Call]:
        async with self._lock:
            calls = self._calls.get(request_id, {})
            return [c.model_copy(deep=True) for c in calls.values()]

    # Events
    async def append_event(self, request_id: str, event: TimelineEvent) -> None:
        async with self._lock:
            if request_id not in self._events:
                self._events[request_id] = []
            self._events[request_id].append(event.model_copy(deep=True))

    async def list_events(self, request_id: str) -> list[TimelineEvent]:
        async with self._lock:
            events = self._events.get(request_id, [])
            return [e.model_copy(deep=True) for e in events]

    # Config
    async def get_config(self, config_id: str) -> dict[str, Any] | None:
        async with self._lock:
            conf = self._configs.get(config_id)
            return dict(conf) if conf is not None else None

    async def set_config(self, config_id: str, data: dict[str, Any]) -> None:
        async with self._lock:
            self._configs[config_id] = dict(data)

    # Locks
    async def get_lock(self, lock_id: str) -> dict[str, Any] | None:
        async with self._lock:
            lock = self._locks.get(lock_id)
            return dict(lock) if lock is not None else None

    async def set_lock(self, lock_id: str, data: dict[str, Any]) -> None:
        async with self._lock:
            self._locks[lock_id] = dict(data)

    # Transactions
    async def run_transaction(self, fn: Callable[[TransactionStore], Awaitable[T]]) -> T:
        async with self._lock:
            tx = MemoryTransactionStore(self)
            result = await fn(tx)
            tx.apply()
            return result
