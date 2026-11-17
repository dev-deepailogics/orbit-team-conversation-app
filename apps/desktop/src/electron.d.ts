declare module 'electron' {
  export const app: any;
  export class BrowserWindow {
    constructor(options?: any);
    loadURL(url: string): Promise<void>;
    webContents: any;
    on(event: string, callback: (...args: any[]) => void): this;
    static getAllWindows(): any[];
  }
  export const shell: any;
  export const ipcMain: any;
  export const ipcRenderer: any;
  export const contextBridge: any;
  export const Notification: any;
}
