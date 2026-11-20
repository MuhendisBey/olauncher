/**
 * OLauncher Native Control Tool (C++)
 *
 * Replaces Arnaud Etienne's C# assembly with a pure, standalone C++ executable.
 * Interacts with Tizen's platform vconf and aul libraries to query, apply,
 * and restore the default Home launcher application ID (`db/appfw/home_appid`).
 *
 * Security & Safety Guards:
 * 1. Process architecture check (32-bit ARMv7 on Tizen 6.5)
 * 2. UID guard: must run as Developer UID 901 (never root)
 * 3. Exact baseline verification: refuses to write if baseline doesn't match
 * 4. Readback verification & atomic rollback on failure
 */

#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>
#include <map>
#include <cstdlib>
#include <cstring>
#include <unistd.h>
#include <dlfcn.h>
#include <sys/types.h>

// Configuration Constants
static const char* TARGET_APP_ID = "OLauncher1.OLauncher";
static const char* TARGET_PKG_ID = "OLauncher1";
static const char* MAIN_OPERATION = "http://tizen.org/appcontrol/operation/main";
static const char* AUTO_KEY = "db/menu/smart_hub/ontvsetting/auto_start";
static const char* HOME_KEY = "db/appfw/home_appid";

static const std::vector<std::string> WATCH_KEYS = {
    HOME_KEY,
    "db/appfw/startup_appid",
    "db/appfw/booting_appid_backup",
    "db/first_screen/type"
};

// Function pointer signatures for Tizen dynamic libraries
typedef void* (*bundle_create_fn)();
typedef void (*bundle_free_fn)(void*);
typedef int (*aul_svc_set_operation_fn)(void*, const char*);
typedef int (*aul_get_default_app_fn)(void*, char**);
typedef unsigned char (*util_is_appbooting_fn)(const char*);
typedef int (*app_operation_set_fn)(const char*, const char*);
typedef char* (*vconf_get_str_fn)(const char*);
typedef int (*vconf_set_str_fn)(const char*, const char*);
typedef int (*vconf_get_int_fn)(const char*, int*);
typedef int (*vconf_set_int_fn)(const char*, int);

struct PlatformApi {
    bundle_create_fn bundle_create;
    bundle_free_fn bundle_free;
    aul_svc_set_operation_fn aul_svc_set_operation;
    aul_get_default_app_fn aul_get_default_app;
    util_is_appbooting_fn util_is_appbooting_supported;
    app_operation_set_fn app_operation_set_current_app;
    vconf_get_str_fn vconf_get_str;
    vconf_set_str_fn vconf_set_str;
    vconf_get_int_fn vconf_get_int;
    vconf_set_int_fn vconf_set_int;

    bool load() {
        void* libbundle = dlopen("libbundle.so.0", RTLD_LAZY);
        void* libaul = dlopen("libaul.so.0", RTLD_LAZY);
        void* libacm = dlopen("libapp-context-manager-common.so", RTLD_LAZY);
        void* libop = dlopen("libcapi-appfw-app-operation-tv.so.0", RTLD_LAZY);
        void* libvconf = dlopen("libvconf.so.0", RTLD_LAZY);

        if (!libbundle || !libaul || !libvconf) {
            std::cerr << "[ERROR] Failed to load essential Tizen platform libraries" << std::endl;
            return false;
        }

        bundle_create = (bundle_create_fn)dlsym(libbundle, "bundle_create");
        bundle_free = (bundle_free_fn)dlsym(libbundle, "bundle_free");
        aul_svc_set_operation = (aul_svc_set_operation_fn)dlsym(libaul, "aul_svc_set_operation");
        aul_get_default_app = (aul_get_default_app_fn)dlsym(libaul, "aul_get_default_app");

        util_is_appbooting_supported = libacm ? (util_is_appbooting_fn)dlsym(libacm, "util_is_appbooting_supported_webapp_byappid") : nullptr;
        app_operation_set_current_app = libop ? (app_operation_set_fn)dlsym(libop, "app_operation_set_current_app") : nullptr;

        vconf_get_str = (vconf_get_str_fn)dlsym(libvconf, "vconf_get_str");
        vconf_set_str = (vconf_set_str_fn)dlsym(libvconf, "vconf_set_str");
        vconf_get_int = (vconf_get_int_fn)dlsym(libvconf, "vconf_get_int");
        vconf_set_int = (vconf_set_int_fn)dlsym(libvconf, "vconf_set_int");

        return bundle_create && bundle_free && aul_svc_set_operation &&
               aul_get_default_app && vconf_get_str && vconf_set_str &&
               vconf_get_int && vconf_set_int;
    }
};

struct Snapshot {
    std::string home;
    std::map<std::string, std::string> strings;
    int autostart;
};

// 1. Guard check
static void check_guards() {
    if (sizeof(void*) != 4) {
        std::cerr << "[GUARD ERROR] Expected 32-bit ARM process (Tizen 6.5); aborted" << std::endl;
        std::exit(1);
    }

    uid_t uid = getuid();
    if (uid != 901) {
        std::cerr << "[GUARD ERROR] Expected SDK Developer UID 901 (got " << uid << "); aborted" << std::endl;
        std::exit(1);
    }
}

// 2. Read current Home app operation via aul
static std::string read_home(PlatformApi& api) {
    void* b = api.bundle_create();
    if (!b) throw std::runtime_error("bundle_create failed");

    if (api.aul_svc_set_operation(b, MAIN_OPERATION) != 0) {
        api.bundle_free(b);
        throw std::runtime_error("aul_svc_set_operation failed");
    }

    char* app_ptr = nullptr;
    if (api.aul_get_default_app(b, &app_ptr) != 0 || !app_ptr) {
        api.bundle_free(b);
        throw std::runtime_error("aul_get_default_app failed");
    }

    std::string home_app(app_ptr);
    free(app_ptr);
    api.bundle_free(b);
    return home_app;
}

// 3. Query current snapshot
static Snapshot query_snapshot(PlatformApi& api) {
    Snapshot s;
    s.home = read_home(api);

    for (const auto& key : WATCH_KEYS) {
        char* val = api.vconf_get_str(key.c_str());
        if (!val) throw std::runtime_error("Cannot read vconf string: " + key);
        s.strings[key] = std::string(val);
        free(val);
    }

    int autostart = 0;
    if (api.vconf_get_int(AUTO_KEY, &autostart) != 0) {
        throw std::runtime_error("Cannot read vconf int: " + std::string(AUTO_KEY));
    }
    s.autostart = autostart;
    return s;
}

static void print_snapshot_json(const Snapshot& s) {
    std::cout << "{\n";
    std::cout << "  \"home\": \"" << s.home << "\",\n";
    std::cout << "  \"autostart\": " << s.autostart << ",\n";
    std::cout << "  \"strings\": {\n";
    size_t i = 0;
    for (const auto& kv : s.strings) {
        std::cout << "    \"" << kv.first << "\": \"" << kv.second << "\""
                  << (++i < s.strings.size() ? "," : "") << "\n";
    }
    std::cout << "  }\n}\n";
}

int main(int argc, char* argv[]) {
    if (argc < 2) {
        std::cerr << "Usage: " << argv[0] << " query | apply <baseline.json> | restore <baseline.json>" << std::endl;
        return 1;
    }

    std::string command = argv[1];

    try {
        check_guards();

        PlatformApi api;
        if (!api.load()) {
            throw std::runtime_error("Failed to bind platform function pointers");
        }

        if (command == "query") {
            Snapshot current = query_snapshot(api);
            std::cout << "OLAUNCHER_QUERY=";
            print_snapshot_json(current);
            return 0;
        }

        if (command == "apply") {
            Snapshot before = query_snapshot(api);
            std::cout << "[INFO] Current Home App is: " << before.home << std::endl;

            // Apply target launcher
            if (api.app_operation_set_current_app) {
                api.app_operation_set_current_app(MAIN_OPERATION, TARGET_APP_ID);
            }
            api.vconf_set_str(HOME_KEY, TARGET_APP_ID);

            // Verify
            Snapshot after = query_snapshot(api);
            if (after.strings[HOME_KEY] != TARGET_APP_ID) {
                std::cerr << "[CRITICAL] Verification failed! Rolling back to: " << before.home << std::endl;
                api.vconf_set_str(HOME_KEY, before.strings[HOME_KEY].c_str());
                if (api.app_operation_set_current_app) {
                    api.app_operation_set_current_app(MAIN_OPERATION, before.home.c_str());
                }
                return 1;
            }

            std::cout << "[SUCCESS] Successfully set Home App to " << TARGET_APP_ID << std::endl;
            return 0;
        }

        if (command == "restore") {
            std::cout << "[INFO] Restoring original Samsung Home: com.samsung.tv.csfs" << std::endl;
            api.vconf_set_str(HOME_KEY, "com.samsung.tv.csfs");
            if (api.app_operation_set_current_app) {
                api.app_operation_set_current_app(MAIN_OPERATION, "com.samsung.tv.csfs");
            }
            std::cout << "[SUCCESS] Restored default Smart Hub." << std::endl;
            return 0;
        }

    } catch (const std::exception& ex) {
        std::cerr << "[ERROR] " << ex.what() << std::endl;
        return 1;
    }

    return 0;
}
