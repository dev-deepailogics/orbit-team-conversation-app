import { app, BrowserWindow, shell, ipcMain, Notification } from 'electron';
import * as path from 'path';

// Explicitly set the application name so macOS Dock, Menu Bar, and taskbar show "Orbit"
app.name = 'Orbit';

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;
const DEFAULT_PROD_URL = 'https://orbit.wondercraftz.com';
const WEB_URL = process.env.ORBIT_WEB_URL || (isDev ? 'http://localhost:3000' : DEFAULT_PROD_URL);
const ICON_PATH = path.join(__dirname, '../resources/icon.png');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    title: 'Orbit',
    icon: ICON_PATH,
    backgroundColor: '#090D16',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  // Set macOS dock icon
  if (process.platform === 'darwin' && app.dock) {
    try {
      app.dock.setIcon(ICON_PATH);
    } catch {
      // Fallback if icon format not supported
    }
  }

  // Load the running Next.js application
  mainWindow.loadURL(WEB_URL);

  // Open external marketing/auth links in system browser, keep Orbit web routes inside the desktop app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      const isInternalOrbit =
        url.includes('orbit.wondercraftz.com') ||
        url.includes('localhost:3000');

      if (!isInternalOrbit) {
        shell.openExternal(url);
        return { action: 'deny' };
      }
    }
    return { action: 'allow' };
  });

  // Handle reload failure / wait for dev server
  mainWindow.webContents.on('did-fail-load', () => {
    if (isDev) {
      setTimeout(() => {
        mainWindow?.loadURL(WEB_URL);
      }, 1500);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.on('orbit:notify', (_event, { title, options }) => {
  if (Notification.isSupported()) {
    new Notification({
      title,
      body: options?.body,
      silent: options?.silent,
    }).show();
  }
});

ipcMain.on('orbit:badge', (_event, count: number) => {
  if (process.platform === 'darwin') {
    app.dock.setBadge(count > 0 ? String(count) : '');
  } else if (app.setBadgeCount) {
    app.setBadgeCount(count);
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
