import * as express from 'express';

import { App } from './App';

export interface IApiOptions {
	port: number;
}

export class Api {

	protected app: App;
	protected options: IApiOptions;
	protected server: express.Application;

	constructor(app: App, options: IApiOptions) {
		this.app = app;
		this.options = options;

		this.run();
	}

	protected run() {
		this.server = express();

		this.server.listen(this.options.port, '0.0.0.0', () => {
			this.app.log(`Api http server listening on http://0.0.0.0:${this.options.port}`);
		});

		this.server.post('/service/:service/:branch/restart', (req: express.Request, res: express.Response) => {
			const { service, branch } = req.params;
			const serviceManager = this.app.getServiceManager();

			serviceManager.restartInstance(service, branch);

			res.status(200);
			res.send(JSON.stringify({ status: 'OK' }));
		});
	}

}