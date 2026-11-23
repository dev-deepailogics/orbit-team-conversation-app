export class DesktopNotifier {
  private static pending: Promise<boolean> | null = null;

  /**
   * Resolves once the user has answered the permission prompt. Browsers block or quietly hide prompts that weren't
   * triggered by the user, so while it hasn't been asked yet, it's asked on the first click or key press. One shared
   * promise, so callers that run again (e.g. on workspace switch) never stack extra listeners or prompts.
   */
  static requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) return Promise.resolve(false);
    if (Notification.permission !== 'default') return Promise.resolve(Notification.permission === 'granted');
    if (!this.pending) {
      this.pending = new Promise((resolve) => {
        const ask = () => {
          window.removeEventListener('pointerdown', ask, true);
          window.removeEventListener('keydown', ask, true);
          Notification.requestPermission().then(
            (p) => resolve(p === 'granted'),
            () => resolve(false),
          );
        };
        window.addEventListener('pointerdown', ask, true);
        window.addEventListener('keydown', ask, true);
      });
    }
    return this.pending;
  }

  static send(title: string, body: string, icon?: string, onClick?: () => void) {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    try {
      const notif = new Notification(title, {
        body,
        icon: icon || '/api/avatar/identicon/svg?seed=orbit',
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
