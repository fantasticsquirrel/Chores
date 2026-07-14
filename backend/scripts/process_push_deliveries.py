from __future__ import annotations

import json

from app.services.notifications import process_pending_push_deliveries


if __name__ == "__main__":
    print(json.dumps(process_pending_push_deliveries(limit=100), sort_keys=True))
