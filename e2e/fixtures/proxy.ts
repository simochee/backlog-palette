import { createServer, type Server } from 'node:http';
import { connect } from 'node:net';

export type ConnectProxy = { port: number; close: () => Promise<void> };

/**
 * Firefox には Chromium の --host-resolver-rules が無い。HTTPS の CONNECT をすべて
 * 偽スペースへ繋ぐプロキシを立て、network.proxy.* の prefs でブラウザに向ける。
 * TLS はトンネルの中で偽スペースと直接張るので、証明書の扱いはブラウザ側の設定に従う。
 */
export async function startConnectProxy(targetPort: number): Promise<ConnectProxy> {
  const server: Server = createServer((_req, res) => {
    res.writeHead(400);
    res.end();
  });

  server.on('connect', (_req, socket, head) => {
    const upstream = connect(targetPort, '127.0.0.1', () => {
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      upstream.write(head);
      upstream.pipe(socket);
      socket.pipe(upstream);
    });
    upstream.on('error', () => {
      socket.destroy();
    });
    socket.on('error', () => {
      upstream.destroy();
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('TCP ポートが取れない');

  return {
    port: address.port,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      }),
  };
}
