const { execSync } = require('child_process');

function isMusl() {
  if (!process.report || typeof process.report.getReport !== 'function') {
    try {
      const lddPath = execSync('which ldd').toString().trim();
      return execSync(`cat ${lddPath}`).toString().includes('musl');
    } catch (error) {
      return true;
    }
  }

  const { glibcVersionRuntime } = process.report.getReport().header;
  return !glibcVersionRuntime;
}

function packageWorks(packageName) {
  try {
    require(packageName);
    return true;
  } catch (error) {
    return false;
  }
}

function expectedParcelPackages() {
  const { platform, arch } = process;

  if (platform === 'darwin') {
    return [arch === 'arm64' ? '@parcel/rust-darwin-arm64' : '@parcel/rust-darwin-x64'];
  }

  if (platform === 'win32') {
    return [
      arch === 'arm64'
        ? '@parcel/rust-win32-arm64-msvc'
        : '@parcel/rust-win32-x64-msvc',
    ];
  }

  if (platform === 'linux') {
    if (arch === 'arm64') {
      return [
        isMusl()
          ? '@parcel/rust-linux-arm64-musl'
          : '@parcel/rust-linux-arm64-gnu',
      ];
    }

    if (arch === 'arm') {
      return [
        isMusl()
          ? '@parcel/rust-linux-arm-musleabihf'
          : '@parcel/rust-linux-arm-gnueabihf',
      ];
    }

    if (arch === 'x64') {
      return [
        isMusl()
          ? '@parcel/rust-linux-x64-musl'
          : '@parcel/rust-linux-x64-gnu',
      ];
    }
  }

  return [];
}

function expectedWatcherPackages() {
  const { platform, arch } = process;

  if (platform === 'darwin') {
    return [arch === 'arm64' ? '@parcel/watcher-darwin-arm64' : '@parcel/watcher-darwin-x64'];
  }

  if (platform === 'win32') {
    return [
      arch === 'arm64'
        ? '@parcel/watcher-win32-arm64'
        : arch === 'ia32'
          ? '@parcel/watcher-win32-ia32'
          : '@parcel/watcher-win32-x64',
    ];
  }

  if (platform === 'linux') {
    if (arch === 'arm64') {
      return [
        isMusl()
          ? '@parcel/watcher-linux-arm64-musl'
          : '@parcel/watcher-linux-arm64-glibc',
      ];
    }

    if (arch === 'arm') {
      return [
        isMusl()
          ? '@parcel/watcher-linux-arm-musleabihf'
          : '@parcel/watcher-linux-arm-glibc',
      ];
    }

    if (arch === 'x64') {
      return [
        isMusl() ? '@parcel/watcher-linux-x64-musl' : '@parcel/watcher-linux-x64-glibc',
      ];
    }
  }

  return [];
}

function ensureParcelDependencies() {
  const parcelPackages = expectedParcelPackages();
  const watcherPackages = expectedWatcherPackages();
  const packages = [...parcelPackages, ...watcherPackages].filter(Boolean);

  if (packages.length === 0) {
    return;
  }

  const missingPackages = packages.filter((pkg) => !packageWorks(pkg));
  if (missingPackages.length === 0) {
    return;
  }

  const installCommand = `npm install --no-save --include=optional --no-audit --no-fund --no-package-lock ${missingPackages.join(
    ' ',
  )}`;
  try {
    execSync(installCommand, { stdio: 'inherit' });
  } catch (error) {
    console.error(
      'Failed to install Parcel native bindings. If npm reports an auth error, run `npm login` and retry.',
    );
    throw error;
  }
}

ensureParcelDependencies();
