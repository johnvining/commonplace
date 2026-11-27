#!/usr/bin/env bash
# Build Commonplace with every cache and build folder inside ios/.
#
# Why: Muse's sandbox can write inside the project without asking,
# but the default Xcode/SwiftPM folders under ~/Library cannot. Keeping
# DerivedData, the package cache, and the scratch dir in here means
# agent-run builds stop prompting for permission. Signing is off, so
# these are compile checks; build in Xcode for signed/device builds.
#
# One thing this script cannot move: SwiftPM's manifest diagnostics go
# to ~/Library/Caches/org.swift.swiftpm, with no flag to change it.
# Point that one folder at ios/.swiftpm-cache once (see README note in
# ios/.swiftpm-cache-redirect.txt) or xcodebuild fails in the sandbox.
#
# Usage:
#   ./build.sh          Mac app (default)
#   ./build.sh mac      Mac app
#   ./build.sh ios      iOS app (compile only, no signing)
#   ./build.sh kit      SwiftPM package only (fast check)
#   ./build.sh test     SwiftPM tests
#   ./build.sh all      kit, then Mac, then iOS
set -euo pipefail
cd "$(dirname "$0")"

SWIFTPM_FLAGS="--disable-sandbox --cache-path .swiftpm-cache --config-path .swiftpm/config --security-path .swiftpm/security --scratch-path .build"
XCODE_FLAGS="-project Commonplace.xcodeproj -derivedDataPath $PWD/DerivedData -packageCachePath $PWD/DerivedData/PackageCache CODE_SIGNING_ALLOWED=NO OTHER_SWIFT_FLAGS=-disable-sandbox"

kit() {
  # shellcheck disable=SC2086
  swift build $SWIFTPM_FLAGS
}

tests() {
  # shellcheck disable=SC2086
  swift test $SWIFTPM_FLAGS
}

mac() {
  # shellcheck disable=SC2086
  xcodebuild $XCODE_FLAGS -scheme CommonplaceMac -configuration Debug \
    -destination 'platform=macOS' build
}

ios() {
  # shellcheck disable=SC2086
  xcodebuild $XCODE_FLAGS -scheme Commonplace -configuration Debug \
    -destination 'generic/platform=iOS' build
}

case "${1:-mac}" in
  kit) kit ;;
  test) tests ;;
  mac) mac ;;
  ios) ios ;;
  all) kit; mac; ios ;;
  *) echo "usage: $0 [mac|ios|kit|test|all]" >&2; exit 2 ;;
esac
