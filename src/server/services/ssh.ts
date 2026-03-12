import { Client } from 'ssh2';

export async function executeCommands(ip: string, username: string, password: string, commands: string[]): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    const results: Record<string, string> = {};

    conn.on('ready', () => {
      let current = 0;
      
      const next = () => {
        if (current >= commands.length) {
          conn.end();
          resolve(results);
          return;
        }
        
        const cmd = commands[current];
        conn.exec(cmd, (err, stream) => {
          if (err) {
            results[cmd] = `Error executing command: ${err.message}`;
            current++;
            next();
            return;
          }
          
          let output = '';
          stream.on('close', () => {
            results[cmd] = output;
            current++;
            next();
          }).on('data', (data: any) => {
            output += data.toString();
          }).stderr.on('data', (data: any) => {
            output += data.toString();
          });
        });
      };
      
      next();
    }).on('error', (err) => {
      reject(err);
    }).connect({
      host: ip,
      port: 22,
      username: username,
      password: password,
      readyTimeout: 15000, // 15 seconds timeout
      algorithms: {
        // Allow older algorithms often found in legacy network devices
        kex: [
          'diffie-hellman-group1-sha1',
          'diffie-hellman-group14-sha1',
          'diffie-hellman-group-exchange-sha1',
          'diffie-hellman-group-exchange-sha256',
          'ecdh-sha2-nistp256',
          'ecdh-sha2-nistp384',
          'ecdh-sha2-nistp521',
          'curve25519-sha256',
          'curve25519-sha256@libssh.org'
        ],
        cipher: [
          'aes128-ctr', 'aes192-ctr', 'aes256-ctr',
          'aes128-gcm', 'aes128-gcm@openssh.com',
          'aes256-gcm', 'aes256-gcm@openssh.com',
          'aes256-cbc', 'aes192-cbc', 'aes128-cbc',
          '3des-cbc'
        ]
      }
    });
  });
}
