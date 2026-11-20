#!/usr/bin/env python3
"""
Deploy all OLauncher Siri/Home Assistant scripts directly to Home Assistant.
Uses Home Assistant Config API with environment-configured URL and token.

Required environment variables:
    HA_URL   - Base URL of your Home Assistant instance (e.g. http://192.0.2.104:8123)
    HA_TOKEN - Home Assistant Long-Lived Access Token

Optional environment variables:
    TV_DEVICE_ID            - Target TV device_id (default: living_room_tv)
    TV_MEDIA_PLAYER_ENTITY  - Media player entity for play/pause (default: media_player.living_room_tv)
    TV_SOURCE_SELECT_ENTITY - Input select entity for source sync (default: input_select.living_room_tv_source)
"""

import json
import os
import sys
import urllib.error
import urllib.request


def build_scripts(device_id, media_player_entity, source_select_entity):
    return {
        "tv_netflix_ac": {
            "alias": "Netflix Aç",
            "icon": "mdi:netflix",
            "sequence": [
                {
                    "event": "tizen_tv_action",
                    "event_data": {"action": "netflix", "target": device_id}
                }
            ],
            "mode": "single"
        },
        "tv_youtube_ac": {
            "alias": "YouTube Aç",
            "icon": "mdi:youtube",
            "sequence": [
                {
                    "event": "tizen_tv_action",
                    "event_data": {"action": "youtube", "target": device_id}
                }
            ],
            "mode": "single"
        },
        "tv_interneti_ac": {
            "alias": "İnterneti Aç",
            "icon": "mdi:web",
            "sequence": [
                {
                    "event": "tizen_tv_action",
                    "event_data": {"action": "browser", "target": device_id}
                }
            ],
            "mode": "single"
        },
        "tv_stremio_ac": {
            "alias": "Stremio Aç",
            "icon": "mdi:play-circle",
            "sequence": [
                {
                    "event": "tizen_tv_action",
                    "event_data": {"action": "stremio", "target": device_id}
                }
            ],
            "mode": "single"
        },
        "tv_spotify_ac": {
            "alias": "Spotify Aç",
            "icon": "mdi:spotify",
            "sequence": [
                {
                    "event": "tizen_tv_action",
                    "event_data": {"action": "spotify", "target": device_id}
                }
            ],
            "mode": "single"
        },
        "tv_xbox_gec": {
            "alias": "XBOX'a Geç",
            "icon": "mdi:microsoft-xbox",
            "sequence": [
                {
                    "event": "tizen_tv_action",
                    "event_data": {"action": "xbox", "target": device_id}
                }
            ],
            "mode": "single"
        },
        "tv_durdur_oynat": {
            "alias": "TV Durdur Oynat",
            "icon": "mdi:play-pause",
            "sequence": [
                {
                    "event": "tizen_tv_action",
                    "event_data": {"action": "play_pause", "target": device_id}
                },
                {
                    "service": "media_player.media_play_pause",
                    "target": {"entity_id": media_player_entity}
                }
            ],
            "mode": "single"
        },
        "tv_ana_ekran": {
            "alias": "TV Ana Ekran",
            "icon": "mdi:home",
            "sequence": [
                {
                    "event": "tizen_tv_action",
                    "event_data": {"action": "home", "target": device_id}
                }
            ],
            "mode": "single"
        },
        "tv_select_source": {
            "alias": "TV Kaynak Seç",
            "icon": "mdi:television-box",
            "fields": {
                "source": {
                    "description": "Seçilecek uygulama/kaynak",
                    "example": "YouTube"
                }
            },
            "sequence": [
                {
                    "choose": [
                        {
                            "conditions": [
                                {"condition": "template", "value_template": "{{ \"ana\" in (source | string | lower) or \"ekran\" in (source | string | lower) or \"home\" in (source | string | lower) or \"olauncher\" in (source | string | lower) }}"}
                            ],
                            "sequence": [
                                {"action": "script.tv_ana_ekran"},
                                {
                                    "action": "input_select.select_option",
                                    "target": {"entity_id": source_select_entity},
                                    "data": {"option": "Ana Ekran"}
                                }
                            ]
                        },
                        {
                            "conditions": [
                                {"condition": "template", "value_template": "{{ \"youtube\" in (source | string | lower) }}"}
                            ],
                            "sequence": [
                                {"action": "script.tv_youtube_ac"},
                                {
                                    "action": "input_select.select_option",
                                    "target": {"entity_id": source_select_entity},
                                    "data": {"option": "YouTube"}
                                }
                            ]
                        },
                        {
                            "conditions": [
                                {"condition": "template", "value_template": "{{ \"netflix\" in (source | string | lower) }}"}
                            ],
                            "sequence": [
                                {"action": "script.tv_netflix_ac"},
                                {
                                    "action": "input_select.select_option",
                                    "target": {"entity_id": source_select_entity},
                                    "data": {"option": "Netflix"}
                                }
                            ]
                        },
                        {
                            "conditions": [
                                {"condition": "template", "value_template": "{{ \"stremio\" in (source | string | lower) }}"}
                            ],
                            "sequence": [
                                {"action": "script.tv_stremio_ac"},
                                {
                                    "action": "input_select.select_option",
                                    "target": {"entity_id": source_select_entity},
                                    "data": {"option": "Stremio"}
                                }
                            ]
                        },
                        {
                            "conditions": [
                                {"condition": "template", "value_template": "{{ \"web\" in (source | string | lower) or \"internet\" in (source | string | lower) or \"tarayici\" in (source | string | lower) or \"tarayıcı\" in (source | string | lower) }}"}
                            ],
                            "sequence": [
                                {"action": "script.tv_interneti_ac"},
                                {
                                    "action": "input_select.select_option",
                                    "target": {"entity_id": source_select_entity},
                                    "data": {"option": "Web Tarayıcı"}
                                }
                            ]
                        },
                        {
                            "conditions": [
                                {"condition": "template", "value_template": "{{ \"spotify\" in (source | string | lower) }}"}
                            ],
                            "sequence": [
                                {"action": "script.tv_spotify_ac"},
                                {
                                    "action": "input_select.select_option",
                                    "target": {"entity_id": source_select_entity},
                                    "data": {"option": "Spotify"}
                                }
                            ]
                        },
                        {
                            "conditions": [
                                {"condition": "template", "value_template": "{{ \"xbox\" in (source | string | lower) }}"}
                            ],
                            "sequence": [
                                {"action": "script.tv_xbox_gec"},
                                {
                                    "action": "input_select.select_option",
                                    "target": {"entity_id": source_select_entity},
                                    "data": {"option": "XBOX"}
                                }
                            ]
                        }
                    ]
                }
            ],
            "mode": "single"
        }
    }


def post_json(url, token, body):
    payload = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, ""
    except urllib.error.HTTPError as err:
        return err.code, str(err)
    except Exception as err:
        return 0, str(err)


def deploy():
    ha_url = os.getenv("HA_URL", "").strip().rstrip("/")
    token = os.getenv("HA_TOKEN", "").strip()
    if not ha_url or not token:
        print("[HATA] HA_URL ve HA_TOKEN ortam değişkenleri zorunludur.", file=sys.stderr)
        print("Örnek: HA_URL=http://192.0.2.104:8123 HA_TOKEN=YOUR_LONG_LIVED_ACCESS_TOKEN_HERE python3 tools/deploy_ha_scripts.py", file=sys.stderr)
        sys.exit(1)

    device_id = os.getenv("TV_DEVICE_ID", "living_room_tv").strip()
    media_player_entity = os.getenv("TV_MEDIA_PLAYER_ENTITY", "media_player.living_room_tv").strip()
    source_select_entity = os.getenv("TV_SOURCE_SELECT_ENTITY", "input_select.living_room_tv_source").strip()

    scripts = build_scripts(device_id, media_player_entity, source_select_entity)
    base_url = f"{ha_url}/api/config/script/config"

    print(f"[HA DEPLOY] {len(scripts)} adet Home Assistant scripti yukleniyor...")
    for script_id, body in scripts.items():
        code, err_msg = post_json(f"{base_url}/{script_id}", token, body)
        if code in (200, 201):
            print(f"  ✅ Yuklendi: {body['alias']} ({script_id}) [HTTP {code}]")
        else:
            print(f"  ❌ Hata ({script_id}): HTTP {code} {err_msg}")

    reload_url = f"{ha_url}/api/services/script/reload"
    code_reload, err_reload = post_json(reload_url, token, {})
    if code_reload in (200, 201):
        print("[HA DEPLOY] Home Assistant scriptleri basariyla yeniden yuklendi (Reloaded)!")
    else:
        print(f"[HA DEPLOY] Reload uyarisi: HTTP {code_reload} {err_reload}")


if __name__ == "__main__":
    deploy()
