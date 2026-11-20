#!/usr/bin/env python3
"""
OLauncher Home Assistant Remote Action Trigger Tool
--------------------------------------------------
Fires a 'tizen_tv_action' event to Home Assistant, which OLauncher
receives over WebSocket to launch apps or trigger actions immediately.

Required environment variables:
    HA_URL   - Base URL of your Home Assistant instance (e.g. http://192.0.2.104:8123)
    HA_TOKEN - Home Assistant Long-Lived Access Token

Optional environment variables:
    TV_DEVICE_ID - Target TV device_id (default: living_room_tv)

Usage:
    HA_URL=http://192.0.2.104:8123 HA_TOKEN=YOUR_TOKEN python3 tools/ha_remote_ctl.py netflix
"""

import json
import os
import sys
import urllib.request


def send_action(action, target=None):
    ha_url = os.getenv("HA_URL", "").strip().rstrip("/")
    token = os.getenv("HA_TOKEN", "").strip()
    if not ha_url or not token:
        print("[HATA] HA_URL ve HA_TOKEN ortam değişkenleri zorunludur.", file=sys.stderr)
        print("Örnek: HA_URL=http://192.0.2.104:8123 HA_TOKEN=YOUR_LONG_LIVED_ACCESS_TOKEN_HERE python3 tools/ha_remote_ctl.py netflix", file=sys.stderr)
        sys.exit(1)

    target_id = target or os.getenv("TV_DEVICE_ID", "living_room_tv").strip()
    endpoint = f"{ha_url}/api/events/tizen_tv_action"
    payload = json.dumps({"action": action, "target": target_id}).encode("utf-8")
    req = urllib.request.Request(
        endpoint,
        data=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status == 200:
                print(f"[BAŞARILI] Home Assistant eylemi tetiklendi: action='{action}' target='{target_id}'")
                print("           TV'deki OLauncher uygulaması komutu aldı ve çalıştırıyor.")
            else:
                print(f"[UYARI] HTTP Yanıt Kodu: {response.status}")
    except Exception as e:
        print(f"[HATA] Home Assistant bağlantı hatası: {e}")
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Kullanım: python3 tools/ha_remote_ctl.py <netflix|youtube|browser|stremio|spotify|xbox|home|play_pause>")
        sys.exit(1)

    act = sys.argv[1].lower().strip()
    send_action(act)
