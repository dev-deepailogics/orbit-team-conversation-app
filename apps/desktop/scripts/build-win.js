const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '../../..');
const desktopDir = path.resolve(__dirname, '..');
const releaseDir = path.join(desktopDir, 'release');
const winZip = path.join(releaseDir, 'electron-win.zip');
const winBuildDir = path.join(releaseDir, 'Orbit-win32-x64');

console.log('Compiling TypeScript...');
execSync('npm run build:main', { cwd: desktopDir, stdio: 'inherit' });

function download(url, cb) {
  https.get(url, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      return download(res.headers.location, cb);
    }
    const file = fs.createWriteStream(winZip);
    res.pipe(file);
    file.on('finish', () => file.close(cb));
  });
}

function packageWin() {
  if (fs.existsSync(winBuildDir)) fs.rmSync(winBuildDir, { recursive: true, force: true });
  fs.mkdirSync(winBuildDir, { recursive: true });

  console.log('Extracting Windows runtime...');
  execSync(`unzip -q "${winZip}" -d "${winBuildDir}"`);

  console.log('Renaming binary to Orbit.exe...');
  fs.renameSync(path.join(winBuildDir, 'electron.exe'), path.join(winBuildDir, 'Orbit.exe'));

  const appDir = path.join(winBuildDir, 'resources/app');
  if (!fs.existsSync(appDir)) fs.mkdirSync(appDir, { recursive: true });

  execSync(`ditto "${path.join(desktopDir, 'dist')}" "${path.join(appDir, 'dist')}"`);
  execSync(`ditto "${path.join(desktopDir, 'resources')}" "${path.join(appDir, 'resources')}"`);

  const pkg = require(path.join(desktopDir, 'package.json'));
  fs.writeFileSync(
    path.join(appDir, 'package.json'),
    JSON.stringify(
      {
        name: 'orbit',
        version: pkg.version,
        main: 'dist/main.js',
        productName: 'Orbit'
      },
      null,
      2
    )
  );

  console.log('Creating Windows distribution archive (Orbit-Windows-x64.zip)...');
  execSync(`cd "${releaseDir}" && zip -r -q Orbit-Windows-x64.zip Orbit-win32-x64`);
  if (fs.existsSync(winZip)) fs.unlinkSync(winZip);

  console.log('SUCCESS: Windows local standalone package generated at:');
  console.log(path.join(releaseDir, 'Orbit-Windows-x64.zip'));
}

if (fs.existsSync(winZip)) {
  packageWin();
} else {
  console.log('Fetching Windows runtime...');
  download('https://github.com/electron/electron/releases/download/v33.4.11/electron-v33.4.11-win32-x64.zip', packageWin);
}
