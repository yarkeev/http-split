import * as net from 'net';

import { App } from '../App';

export const portIsBusy = async (port: number): Promise<boolean> => {
	return new Promise<boolean>((resolve, reject) => {
		App.log(`Check port ${port}`);

		const server = net.createServer();

		server.once('error', (err: NodeJS.ErrnoException) => {
			if (err.code === 'EADDRINUSE') {
				App.log(`Port ${port} already used`);
			} else {
				App.log(`Port ${port} error ${err.toString()}`);
			}

			reject(true);
		});

		server.once('listening', function () {
			App.log(`Port ${port} ready to use`);

			resolve(false);
			server.close();
		});

		server.listen(port, '0.0.0.0');
	});
};