import TcpSockets from 'react-native-tcp-socket';

let moveCounter = 0;

/** Connects to a LocalGameHost over the same WiFi. Zero backend/API calls. */
export class LocalGameClient {
  private socket: any;
  private userId = '';
  private buffer = '';
  private pending = new Map<string, { resolve: () => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();

  connect(
    ip: string,
    port: number,
    user: { userId: string; name: string; avatarUrl?: string },
    onUpdate: (room: any) => void,
    onError: (message: string) => void,
  ): Promise<void> {
    this.userId = user.userId;
    return new Promise((resolve, reject) => {
      let settled = false;
      this.socket = TcpSockets.createConnection({ port, host: ip }, () => {
        this.send({ type: 'hello', userId: user.userId, name: user.name, avatarUrl: user.avatarUrl });
        if (!settled) {
          settled = true;
          resolve();
        }
      });

      this.socket.on('data', (data: any) => {
        this.buffer += data.toString();
        let idx: number;
        while ((idx = this.buffer.indexOf('\n')) !== -1) {
          const line = this.buffer.slice(0, idx);
          this.buffer = this.buffer.slice(idx + 1);
          if (!line.trim()) continue;
          let msg: any;
          try {
            msg = JSON.parse(line);
          } catch {
            continue;
          }
          if (msg.type === 'state') {
            onUpdate(msg.room);
            // Any in-flight move that wasn't explicitly rejected has succeeded.
            for (const [, p] of this.pending) {
              clearTimeout(p.timer);
              p.resolve();
            }
            this.pending.clear();
          } else if (msg.type === 'moveError') {
            const p = msg.moveId ? this.pending.get(msg.moveId) : undefined;
            if (p) {
              clearTimeout(p.timer);
              p.reject(new Error(msg.message));
              this.pending.delete(msg.moveId);
            } else {
              onError(msg.message);
            }
          } else if (msg.type === 'error') {
            onError(msg.message);
          }
        }
      });

      this.socket.on('error', (e: Error) => {
        if (!settled) {
          settled = true;
          reject(e);
        }
        onError(e.message || 'Connection error.');
      });
      this.socket.on('close', () => onError('Disconnected from host.'));
    });
  }

  private send(obj: any) {
    try {
      this.socket?.write(JSON.stringify(obj) + '\n');
    } catch {}
  }

  makeMove(action: string, payload?: any): Promise<void> {
    const moveId = `m${moveCounter++}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(moveId);
        resolve(); // assume success if the host stays silent (no error) past the timeout
      }, 4000);
      this.pending.set(moveId, { resolve, reject, timer });
      this.send({ type: 'move', userId: this.userId, action, payload, moveId });
    });
  }

  leave() {
    this.send({ type: 'leave', userId: this.userId });
    try {
      this.socket?.destroy();
    } catch {}
  }
}
