from __future__ import annotations

import json

from app.services.notification_reminders import run_notification_scheduler


if __name__ == "__main__":
    print(json.dumps(run_notification_scheduler(), sort_keys=True))
