#!/bin/bash
# ==============================================================================
# OLauncher — Samsung TV (Tizen 6.5) SDB Deployment & Home Control Script
# ==============================================================================
set -e

TV_IP="$1"

if [ -z "$TV_IP" ]; then
    echo "Kullanım: $0 <TV_IP_ADRESI> [query|apply|restore|install-wgt]"
    echo "Örnek:"
    echo "  $0 192.0.2.93 query         # TV'nin mevcut Home durumunu okur"
    echo "  $0 192.0.2.93 install-wgt   # Web Launcher paketini TV'ye yükler"
    echo "  $0 192.0.2.93 apply         # Home tuşunu OLauncher'a yönlendirir"
    echo "  $0 192.0.2.93 restore       # Orijinal Smart Hub'ı geri getirir"
    exit 1
fi

ACTION="${2:-query}"
REMOTE_TMP="/opt/usr/home/owner/share/tmp"

echo "[1/4] TV'ye bağlanılıyor: $TV_IP:26101..."
sdb connect "$TV_IP:26101" || true

case "$ACTION" in
    "install-wgt")
        echo "[2/4] OLauncher .wgt TV'ye yükleniyor..."
        if [ ! -f "dist/olauncher.wgt" ]; then
            echo "dist/olauncher.wgt bulunamadı! Önce 'npm run package' çalıştırın."
            exit 1
        fi
        sdb install dist/olauncher.wgt
        echo "[BİLGİ] Kurulum tamamlandı! TV'nin uygulama menüsünden OLauncher'ı test edebilirsiniz."
        ;;

    "query")
        echo "[2/4] Mevcut Home konfigürasyonu sorgulanıyor..."
        sdb shell "mkdir -p $REMOTE_TMP"
        sdb push native/build/olauncher_native_ctl "$REMOTE_TMP/" 2>/dev/null || true
        sdb shell "chmod +x $REMOTE_TMP/olauncher_native_ctl && $REMOTE_TMP/olauncher_native_ctl query" > home-baseline.json
        echo "[BAŞARILI] Mevcut sistem durumu 'home-baseline.json' dosyasına kaydedildi:"
        cat home-baseline.json
        ;;

    "apply")
        echo "[UYARI] Home tuşu OLauncher1.OLauncher olarak ayarlanacak."
        read -p "Devam etmek istiyor musunuz? (e/h): " onay
        if [ "$onay" = "e" ] || [ "$onay" = "E" ]; then
            sdb shell "chmod +x $REMOTE_TMP/olauncher_native_ctl && $REMOTE_TMP/olauncher_native_ctl apply"
            echo "[BAŞARILI] Home tuşu yönlendirildi!"
        fi
        ;;

    "restore")
        echo "[GERİ ALMA] Orijinal Samsung Smart Hub geri yükleniyor..."
        sdb shell "chmod +x $REMOTE_TMP/olauncher_native_ctl && $REMOTE_TMP/olauncher_native_ctl restore"
        echo "[BAŞARILI] Varsayılan Samsung Smart Hub geri getirildi."
        ;;

    *)
        echo "Bilinmeyen aksiyon: $ACTION"
        exit 1
        ;;
esac
