from __future__ import annotations

import json

from app.services.notification_push import process_pending_push_deliveries
from app.services.native_push_delivery import process_pending_native_push_deliveries


if __name__ == "__main__":
    print(json.dumps({
        "browser": process_pending_push_deliveries(limit=100),
        "native": process_pending_native_push_deliveries(limit=100),
    }, sort_keys=True))
