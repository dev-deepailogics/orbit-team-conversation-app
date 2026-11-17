const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '../../..');
const desktopDir = path.resolve(__dirname, '..');
const releaseDir = path.join(desktopDir, 'release');
const linuxZip = path.join(releaseDir, 'electron-linux.zip');
const linuxBuildDir = path.join(releaseDir, 'Orbit-linux-x64');

console.log('Compiling TypeScript...');
execSync('npm run build:main', { cwd: desktopDir, stdio: 'inherit' });

function download(url, cb) {
  https.get(url, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      return download(res.headers.location, cb);
    }
    const file = fs.createWriteStream(linuxZip);
    res.pipe(file);
    file.on('finish', () => file.close(cb));
  });
}

function packageLinux() {
  if (fs.existsSync(linuxBuildDir)) fs.rmSync(linuxBuildDir, { recursive: true, force: true });
  fs.mkdirSync(linuxBuildDir, { recursive: true });

  console.log('Extracting Linux binary...');
  execSync(`unzip -q "${linuxZip}" -d "${linuxBuildDir}"`);

  console.log('Setting binary name and desktop assets...');
  fs.renameSync(path.join(linuxBuildDir, 'electron'), path.join(linuxBuildDir, 'orbit'));

  const appDir = path.join(linuxBuildDir, 'resources/app');
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

  const desktopShortcut = `[Desktop Entry]
Name=Orbit
Exec="${path.join(linuxBuildDir, 'orbit')}" %U
Terminal=false
Type=Application
Icon="${path.join(appDir, 'resources/icon.png')}"
StartupWMClass=Orbit
Comment=Orbit Team Conversation App
Categories=Network;Chat;InstantMessaging;
`;
  fs.writeFileSync(path.join(linuxBuildDir, 'orbit.desktop'), desktopShortcut);

  console.log('Creating Linux distribution archive...');
  execSync(`cd "${releaseDir}" && tar -czf Orbit-Linux-x64.tar.gz Orbit-linux-x64`);
  if (fs.existsSync(linuxZip)) fs.unlinkSync(linuxZip);

  console.log('SUCCESS: Linux local standalone package generated at:');
  console.log(path.join(releaseDir, 'Orbit-Linux-x64.tar.gz'));
}

if (fs.existsSync(linuxZip)) {
  packageLinux();
} else {
  console.log('Fetching Linux runtime...');
  download('https://github.com/electron/electron/releases/download/v33.4.11/electron-v33.4.11-linux-x64.zip', packageLinux);
}
