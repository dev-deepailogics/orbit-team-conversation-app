import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('orbitElectron', {
  isElectron: true,
  platform: process.platform,
  version: process.versions.electron,
  sendNotification: (title: string, options?: NotificationOptions) => {
    ipcRenderer.send('orbit:notify', { title, options });
  },
  setBadgeCount: (count: number) => {
    ipcRenderer.send('orbit:badge', count);
  },
});
