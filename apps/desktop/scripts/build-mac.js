const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '../../..');
const desktopDir = path.resolve(__dirname, '..');
const electronApp = path.join(root, 'node_modules/electron/dist/Electron.app');
const releaseDir = path.join(desktopDir, 'release');
const destApp = path.join(releaseDir, 'Orbit.app');

console.log('Preparing output release directory...');
if (!fs.existsSync(releaseDir)) {
  fs.mkdirSync(releaseDir, { recursive: true });
}
if (fs.existsSync(destApp)) {
  fs.rmSync(destApp, { recursive: true, force: true });
}

console.log(`Copying base Electron bundle to ${destApp}...`);
execSync(`ditto "${electronApp}" "${destApp}"`);

console.log('Setting executable and bundle metadata to Orbit...');
const macosDir = path.join(destApp, 'Contents/MacOS');
fs.renameSync(path.join(macosDir, 'Electron'), path.join(macosDir, 'Orbit'));

const plistPath = path.join(destApp, 'Contents/Info.plist');
execSync(`/usr/libexec/PlistBuddy -c "Set :CFBundleName Orbit" "${plistPath}"`);
execSync(`/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName Orbit" "${plistPath}"`);
execSync(`/usr/libexec/PlistBuddy -c "Set :CFBundleExecutable Orbit" "${plistPath}"`);
execSync(`/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier chat.orbit.desktop" "${plistPath}"`);

// Replace icon
const icnsSource = path.join(desktopDir, 'resources/icon.icns');
if (fs.existsSync(icnsSource)) {
  const destIcon = path.join(destApp, 'Contents/Resources/electron.icns');
  fs.copyFileSync(icnsSource, destIcon);
}

// Copy app files
console.log('Bundling application code into app bundle...');
const appResources = path.join(destApp, 'Contents/Resources/app');
if (!fs.existsSync(appResources)) {
  fs.mkdirSync(appResources, { recursive: true });
}

execSync(`ditto "${path.join(desktopDir, 'dist')}" "${path.join(appResources, 'dist')}"`);
execSync(`ditto "${path.join(desktopDir, 'resources')}" "${path.join(appResources, 'resources')}"`);

const pkg = require(path.join(desktopDir, 'package.json'));
fs.writeFileSync(
  path.join(appResources, 'package.json'),
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

// Sign with ad-hoc signature so macOS recognizes the bundle
console.log('Applying macOS code signature...');
execSync(`codesign --force --deep --sign - "${destApp}"`);

console.log('\n=============================================');
console.log('SUCCESS: Standalone Orbit.app built successfully!');
console.log(`Location: ${destApp}`);
console.log('=============================================\n');

