import * as fs from 'fs';
import * as path from 'path';
import * as express from 'express';
import * as httpProxy from 'http-proxy';

import { App } from './App';
import { ServiceInstance } from './ServiceInstance';
import { portIsBusy } from './utils/portIsBusy';

import { IServiceConfig } from './interfaces';

export interface IServiceOptions extends IServiceConfig {}

export class Service {

	protected app: App;
	protected options: IServiceOptions;
	protected instances: ServiceInstance[] = [];
	protected server: express.Application;

	constructor(app: App, options: IServiceOptions) {
		this.app = app;
		this.options = options;
	}

	init() {
		this.app.log(`Init service ${this.options.name}`);

		this.audit();

		this.startHttpWrapper();
	}

	destroy() {
		this.app.log(`Start destroy service "${this.getName()}"`);

		for (let i = 0; i < this.instances.length; i++) {
			this.destroyInstanceById(this.instances[i].getId(), true);
		}

		this.instances = [];

		this.app.log(`Finish destroy service "${this.getName()}"`);
	}

	getName() {
		return this.options.name;
	}

	audit() {
		fs.readdir(this.options.dir, (err, list) => {
			const dirs = list.filter((item) => !this.options.exclude?.includes(item));

			this.instances.forEach((instance: ServiceInstance) => {
				if (dirs.indexOf(instance.getId()) === -1) {
					this.destroyInstanceById(instance.getId());
				}
			});

			dirs.forEach((dir: string) => {
				const { instance } = this.getInstanceBydId(dir);

				if (!instance) {
					this.initInstance(dir);
				}
			})
		});
	}

	restartById(id: string) {
		this.destroyInstanceById(id);
		this.initInstance(id);
	}

	destroyInstanceById(id: string, noSplice?: boolean) {
		this.app.log(`Destroy instance with id "${id}" in service "${this.options.name}"`);

		const { index, instance } = this.getInstanceBydId(id);

		if (instance) {
			instance.destroy();

			if (!noSplice) {
				this.instances.splice(index, 1);
			}
		}
	}

	getInstanceBydId(id: string) {
		this.app.log(`Find instance with id "${id}" in service "${this.options.name}"`);

		const instance = this.instances.find((instance: ServiceInstance) => instance.getId() === id);
		const index = this.instances.findIndex((instance: ServiceInstance) => instance.getId() === id);

		if (instance) {
			return { index, instance };
		} else {
			this.app.log(`Instance with id "${id}" in service "${this.options.name}" not found`);

			return  { index: null, instance: null };
		}
	}

	protected async initInstance(dir: string) {
		const port = await this.getPort();
		const cwd = path.resolve(this.options.dir, dir);

		if (!fs.existsSync(cwd)) {
			this.app.log(`Init instance failed. Directory "${cwd}" not found`);
		} else {
			const instance = new ServiceInstance(this.app, {
				serviceName: this.options.name,
				id: dir,
				port,
				cwd,
				exec: this.options.exec,
				logPrefixFormat: this.options.logPrefixFormat,
			});

			instance.run();

			this.instances.push(instance);
		}
	}

	protected startHttpWrapper() {
		this.server = express();

		this.server.listen(this.options.port, '0.0.0.0', () => {
			this.app.log(`Service ${this.options.name} http server listening on http://0.0.0.0:${this.options.port}`);

			this.server.all('*', (req: express.Request, res: express.Response) => {
				const port = this.getProxyPort(req);

				if (port) {
					this.app.log(`Instance found on port ${port}`);

					try {
						const proxy = httpProxy.createProxyServer();

						proxy.web(req, res, { target: `http://127.0.0.1:${port}` });

						proxy.on('error', (err: Error) => {
							this.app.log(`Error proxy: `, err && err.toString());

							this.proxyErrorHandler(res, err);

							proxy.close();
						});

						proxy.on('close', () => this.app.log(`Proxy to port ${port} closed`));
					} catch (err) {
						this.proxyErrorHandler(res, err);
					}
				} else {
					this.app.log(`Proxy port is not found`);

					res.status(404);
					res.send('<h1>Instance not found</h1>');
				}
			});
		});
	}

	protected getProxyPort(req: express.Request): number {
		const instanceId = this.options.getInstanceIdByReq(req);
		const instance = this.instances.find((instance: ServiceInstance) => instance.getId() === instanceId);

		return instance ? instance.getPort() : null;
	}

	protected async getPort() {
		for (let i = this.options.startPort; i < this.options.endPort; i++) {
			try {
				const isBusy = await portIsBusy(i);

				if (!isBusy) {
					return i;
				}
			} catch (err) {
				this.app.log(`Check next port`);
			}
		}

		return null;
	}

	protected proxyErrorHandler(res: express.Response, err: Error) {
		res.status(500);
		res.send(`
			<h1>Error proxy</h1>
			<pre>${err && err.toString()}</pre>
			<pre>${err && err.stack}</pre>
		`);
	}
}
