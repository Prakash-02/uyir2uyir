from collections.abc import Awaitable, Callable
from typing import Any, TypeVar

from google.cloud import firestore
from google.cloud.firestore import AsyncClient
from google.cloud.firestore_v1.async_transaction import AsyncTransaction
from google.cloud.firestore_v1.base_query import FieldFilter

from app.core.config import get_settings
from app.core.entities import Centre, Donor, Hospital
from app.core.store import Store, TransactionStore
from app.requests.models import BloodRequest, Call, TimelineEvent

T = TypeVar("T")


async def _get_one_doc(transaction: AsyncTransaction, ref: Any) -> Any:
    """Helper reading a single document snapshot inside an async transaction."""
    async for snap in transaction.get(ref):
        return snap if snap.exists else None
    return None


class FirestoreTransactionStore(TransactionStore):
    """Transaction-scoped Firestore view enforcing that all reads precede all writes."""

    def __init__(
        self,
        transaction: AsyncTransaction,
        client: AsyncClient,
        data_mode: str,
    ) -> None:
        self.transaction = transaction
        self.client = client
        self.data_mode = data_mode
        self._has_written = False

    def _assert_can_read(self) -> None:
        if self._has_written:
            raise RuntimeError("Firestore transaction error: All reads must precede writes.")

    # --- READS ---

    async def get_request(self, request_id: str) -> BloodRequest | None:
        self._assert_can_read()
        ref = self.client.collection("requests").document(request_id)
        snap = await _get_one_doc(self.transaction, ref)
        if snap and snap.exists:
            return BloodRequest.model_validate(snap.to_dict())
        return None

    async def get_call(self, request_id: str, call_id: str) -> Call | None:
        self._assert_can_read()
        ref = (
            self.client.collection("requests")
            .document(request_id)
            .collection("calls")
            .document(call_id)
        )
        snap = await _get_one_doc(self.transaction, ref)
        if snap and snap.exists:
            return Call.model_validate(snap.to_dict())
        return None

    async def list_calls(self, request_id: str) -> list[Call]:
        """Reads all calls under a request in the current round or full set."""
        self._assert_can_read()
        calls_col = self.client.collection("requests").document(request_id).collection("calls")
        snaps = [snap async for snap in self.transaction.get(calls_col)]
        return [Call.model_validate(s.to_dict()) for s in snaps if s.exists]

    async def get_donor(self, donor_id: str) -> Donor | None:
        self._assert_can_read()
        ref = self.client.collection("donors").document(donor_id)
        snap = await _get_one_doc(self.transaction, ref)
        if snap and snap.exists:
            return Donor.model_validate(snap.to_dict())
        return None

    async def get_config(self, config_id: str) -> dict[str, Any] | None:
        self._assert_can_read()
        ref = self.client.collection("config").document(config_id)
        snap = await _get_one_doc(self.transaction, ref)
        if snap and snap.exists:
            return snap.to_dict()
        return None

    # --- WRITES ---

    async def save_request(self, request: BloodRequest) -> None:
        self._has_written = True
        ref = self.client.collection("requests").document(request.id)
        data = request.model_dump(by_alias=True)
        data["dataMode"] = self.data_mode
        data["isSimulated"] = self.data_mode == "demo"
        self.transaction.set(ref, data)

    async def save_call(self, request_id: str, call: Call) -> None:
        self._has_written = True
        ref = (
            self.client.collection("requests")
            .document(request_id)
            .collection("calls")
            .document(call.id)
        )
        data = call.model_dump(by_alias=True)
        data["dataMode"] = self.data_mode
        data["isSimulated"] = self.data_mode == "demo"
        self.transaction.set(ref, data)

    async def append_event(self, request_id: str, event: TimelineEvent) -> None:
        self._has_written = True
        ref = (
            self.client.collection("requests")
            .document(request_id)
            .collection("events")
            .document(event.id)
        )
        data = event.model_dump(by_alias=True)
        data["dataMode"] = self.data_mode
        data["isSimulated"] = self.data_mode == "demo"
        self.transaction.set(ref, data)

    async def save_donor(self, donor: Donor) -> None:
        self._has_written = True
        ref = self.client.collection("donors").document(donor.id)
        data = donor.model_dump(by_alias=True)
        data["dataMode"] = self.data_mode
        data["isSimulated"] = self.data_mode == "demo"
        self.transaction.set(ref, data)

    async def set_config(self, config_id: str, data: dict[str, Any]) -> None:
        self._has_written = True
        ref = self.client.collection("config").document(config_id)
        payload = dict(data)
        payload["dataMode"] = self.data_mode
        payload["isSimulated"] = self.data_mode == "demo"
        self.transaction.set(ref, payload)


class FirestoreStore(Store):
    """Google Cloud Firestore storage implementation with transactional guarantees."""

    def __init__(
        self,
        client: AsyncClient | None = None,
        data_mode: str | None = None,
        database: str | None = None,
        project: str | None = None,
    ) -> None:
        settings = get_settings()
        self.data_mode = data_mode or settings.DATA_MODE
        self._database = database or settings.FIRESTORE_DB
        self._project = project or settings.GOOGLE_CLOUD_PROJECT
        self._client = client

    @property
    def client(self) -> AsyncClient:
        if self._client is None:
            self._client = AsyncClient(
                project=self._project,
                database=self._database,
            )
        return self._client

    # Hospitals
    async def get_hospital(self, hospital_id: str) -> Hospital | None:
        doc = await self.client.collection("hospitals").document(hospital_id).get()
        if doc.exists:
            return Hospital.model_validate(doc.to_dict())
        return None

    async def save_hospital(self, hospital: Hospital) -> None:
        ref = self.client.collection("hospitals").document(hospital.id)
        data = hospital.model_dump(by_alias=True)
        data["dataMode"] = self.data_mode
        data["isSimulated"] = self.data_mode == "demo"
        await ref.set(data)

    async def list_hospitals(self) -> list[Hospital]:
        snaps = [d async for d in self.client.collection("hospitals").stream()]
        return [Hospital.model_validate(d.to_dict()) for d in snaps if d.exists]

    # Centres
    async def get_centre(self, centre_id: str) -> Centre | None:
        doc = await self.client.collection("centres").document(centre_id).get()
        if doc.exists:
            return Centre.model_validate(doc.to_dict())
        return None

    async def save_centre(self, centre: Centre) -> None:
        ref = self.client.collection("centres").document(centre.id)
        data = centre.model_dump(by_alias=True)
        data["dataMode"] = self.data_mode
        data["isSimulated"] = self.data_mode == "demo"
        await ref.set(data)

    async def list_centres(self) -> list[Centre]:
        snaps = [d async for d in self.client.collection("centres").stream()]
        return [Centre.model_validate(d.to_dict()) for d in snaps if d.exists]

    # Donors
    async def get_donor(self, donor_id: str) -> Donor | None:
        doc = await self.client.collection("donors").document(donor_id).get()
        if doc.exists:
            return Donor.model_validate(doc.to_dict())
        return None

    async def save_donor(self, donor: Donor) -> None:
        ref = self.client.collection("donors").document(donor.id)
        data = donor.model_dump(by_alias=True)
        data["dataMode"] = self.data_mode
        data["isSimulated"] = self.data_mode == "demo"
        await ref.set(data)

    async def list_donors(self) -> list[Donor]:
        snaps = [d async for d in self.client.collection("donors").stream()]
        return [Donor.model_validate(d.to_dict()) for d in snaps if d.exists]

    # Requests
    async def get_request(self, request_id: str) -> BloodRequest | None:
        doc = await self.client.collection("requests").document(request_id).get()
        if doc.exists:
            return BloodRequest.model_validate(doc.to_dict())
        return None

    async def save_request(self, request: BloodRequest) -> None:
        ref = self.client.collection("requests").document(request.id)
        data = request.model_dump(by_alias=True)
        data["dataMode"] = self.data_mode
        data["isSimulated"] = self.data_mode == "demo"
        await ref.set(data)

    async def list_requests_by_hospital(self, hospital_id: str) -> list[BloodRequest]:
        query = self.client.collection("requests").where(
            filter=FieldFilter("hospitalId", "==", hospital_id)
        )
        snaps = [d async for d in query.stream()]
        return [BloodRequest.model_validate(d.to_dict()) for d in snaps if d.exists]

    async def list_requests_by_centre(self, centre_id: str) -> list[BloodRequest]:
        query = self.client.collection("requests").where(
            filter=FieldFilter("centreId", "==", centre_id)
        )
        snaps = [d async for d in query.stream()]
        return [BloodRequest.model_validate(d.to_dict()) for d in snaps if d.exists]

    # Calls
    async def get_call(self, request_id: str, call_id: str) -> Call | None:
        ref = (
            self.client.collection("requests")
            .document(request_id)
            .collection("calls")
            .document(call_id)
        )
        doc = await ref.get()
        if doc.exists:
            return Call.model_validate(doc.to_dict())
        return None

    async def save_call(self, request_id: str, call: Call) -> None:
        ref = (
            self.client.collection("requests")
            .document(request_id)
            .collection("calls")
            .document(call.id)
        )
        data = call.model_dump(by_alias=True)
        data["dataMode"] = self.data_mode
        data["isSimulated"] = self.data_mode == "demo"
        await ref.set(data)

    async def list_calls(self, request_id: str) -> list[Call]:
        calls_col = self.client.collection("requests").document(request_id).collection("calls")
        snaps = [d async for d in calls_col.stream()]
        return [Call.model_validate(d.to_dict()) for d in snaps if d.exists]

    # Events
    async def append_event(self, request_id: str, event: TimelineEvent) -> None:
        ref = (
            self.client.collection("requests")
            .document(request_id)
            .collection("events")
            .document(event.id)
        )
        data = event.model_dump(by_alias=True)
        data["dataMode"] = self.data_mode
        data["isSimulated"] = self.data_mode == "demo"
        await ref.set(data)

    async def list_events(self, request_id: str) -> list[TimelineEvent]:
        events_col = self.client.collection("requests").document(request_id).collection("events")
        snaps = [d async for d in events_col.stream()]
        events = [TimelineEvent.model_validate(d.to_dict()) for d in snaps if d.exists]
        return sorted(events, key=lambda e: e.at)

    # Config
    async def get_config(self, config_id: str) -> dict[str, Any] | None:
        ref = self.client.collection("config").document(config_id)
        doc = await ref.get()
        if doc.exists:
            return doc.to_dict()
        return None

    async def set_config(self, config_id: str, data: dict[str, Any]) -> None:
        ref = self.client.collection("config").document(config_id)
        payload = dict(data)
        payload["dataMode"] = self.data_mode
        payload["isSimulated"] = self.data_mode == "demo"
        await ref.set(payload)

    # Transactions
    async def run_transaction(self, fn: Callable[[TransactionStore], Awaitable[T]]) -> T:
        transaction = self.client.transaction()

        @firestore.async_transactional
        async def _execute_tx(txn: AsyncTransaction) -> T:
            tx_store = FirestoreTransactionStore(txn, self.client, self.data_mode)
            return await fn(tx_store)

        return await _execute_tx(transaction)
