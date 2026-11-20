cmake_minimum_required(VERSION 3.10)
project(olauncher_native CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# 1. Native Control Tool (CLI binary for sdb shell)
add_executable(olauncher_native_ctl tools/olauncher_native_ctl.cpp)
target_link_libraries(olauncher_native_ctl dl)

# 2. Rescue Service Application
add_executable(rescue_service rescue_app/src/rescue_main.cpp)
target_link_libraries(rescue_service dl)
