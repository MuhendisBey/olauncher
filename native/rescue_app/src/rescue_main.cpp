/**
 * OLauncher Native Rescue Headless Service (C++)
 *
 * Package: com.muhendisbey.olauncher.rescue
 * Purpose: Single-purpose headless recovery application that immediately
 *          restores the default Samsung Smart Hub launcher and launches it.
 */

#include <app.h>
#include <dlog.h>
#include <vconf.h>
#include <dlfcn.h>
#include <cstdlib>

#define LOG_TAG "OLauncherRescue"

typedef int (*aul_launch_fn)(const char*, void*);
typedef int (*app_op_fn)(const char*, const char*);

static const char* SAMSUNG_SMART_HUB = "com.samsung.tv.csfs";
static const char* SAMSUNG_HOME_ALT = "com.samsung.tv.home";
static const char* MAIN_OPERATION = "http://tizen.org/appcontrol/operation/main";

static void perform_rescue() {
    dlog_print(DLOG_INFO, LOG_TAG, "Emergency Rescue triggered. Restoring Samsung Smart Hub...");

    // 1. Reset vconf home_appid
    vconf_set_str("db/appfw/home_appid", SAMSUNG_SMART_HUB);

    // 2. Reset app_operation current app
    void* libop = dlopen("libcapi-appfw-app-operation-tv.so.0", RTLD_LAZY);
    if (libop) {
        app_op_fn set_op = (app_op_fn)dlsym(libop, "app_operation_set_current_app");
        if (set_op) {
            set_op(MAIN_OPERATION, SAMSUNG_SMART_HUB);
        }
        dlclose(libop);
    }

    // 3. Launch Samsung Smart Hub immediately via libaul
    void* libaul = dlopen("libaul.so.0", RTLD_LAZY);
    if (libaul) {
        aul_launch_fn launch_app = (aul_launch_fn)dlsym(libaul, "aul_launch_app");
        if (launch_app) {
            if (launch_app(SAMSUNG_SMART_HUB, nullptr) != 0) {
                launch_app(SAMSUNG_HOME_ALT, nullptr);
            }
        }
        dlclose(libaul);
    }

    dlog_print(DLOG_INFO, LOG_TAG, "Rescue completed successfully.");
}

static bool service_app_create(void* user_data) {
    perform_rescue();
    service_app_exit();
    return true;
}

static void service_app_terminate(void* user_data) {}
static void service_app_control(app_control_h app_control, void* user_data) {
    perform_rescue();
    service_app_exit();
}

int main(int argc, char* argv[]) {
    service_app_lifecycle_callback_s event_callback = {0};
    event_callback.create = service_app_create;
    event_callback.terminate = service_app_terminate;
    event_callback.app_control = service_app_control;

    return service_app_main(argc, argv, &event_callback, nullptr);
}
