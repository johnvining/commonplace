// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CommonplaceKit",
    platforms: [.macOS(.v14), .iOS(.v17)],
    products: [
        .library(name: "CommonplaceKit", targets: ["CommonplaceKit"]),
        .executable(name: "CommonplaceApp", targets: ["CommonplaceApp"]),
    ],
    targets: [
        .target(name: "CommonplaceKit", path: "Sources/CommonplaceKit"),
        .executableTarget(name: "CommonplaceApp", dependencies: ["CommonplaceKit"], path: "Sources/CommonplaceApp"),
        .testTarget(name: "CommonplaceKitTests", dependencies: ["CommonplaceKit"], path: "Tests/CommonplaceKitTests"),
    ]
)
