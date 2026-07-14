from __future__ import annotations

import json

from app.services.notifications import run_notification_scheduler


if __name__ == "__main__":
    print(json.dumps(run_notification_scheduler(), sort_keys=True))
