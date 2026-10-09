export class DesktopNotifier {
  static async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }
    if (Notification.permission === 'granted') {
      return true;
    }
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }

  static send(title: string, body: string, icon?: string, onClick?: () => void) {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    try {
      const notif = new Notification(title, {
        body,
        icon: icon || 'https://api.dicebear.com/7.x/identicon/svg?seed=orbit',
        silent: true, // We use our sound manager for audio
      });

      if (onClick) {
        notif.onclick = () => {
          window.focus();
          onClick();
          notif.close();
        };
      }
    } catch (err) {
      console.error('Failed to show notification', err);
    }
  }
}
