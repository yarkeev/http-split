import * as fs from 'fs';
import * as path from 'path';
import * as express from 'express';
import * as httpProxy from 'http-proxy';

import { App } from './App';
import { ServiceInstance } from './ServiceInstance';

import { IServiceConfig } from './interfaces';

export interface IServiceOptions extends IServiceConfig {}

export class Service {

	protected app: App;
	protected options: IServiceOptions;
	protected instances: ServiceInstance[] = [];
	protected server: express.Application;
	protected usedPorts: Record<number, boolean>;

	constructor(app: App, options: IServiceOptions) {
		this.app = app;
		this.options = options;

		this.usedPorts = new Array(this.options.endPort - this.options.startPort)
			.fill(null)
			.reduce(
				(ports, item, key) => {
					ports[this.options.startPort + key] = false;

					return ports;
				},
				{},
			);
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
				const { instance } = this.getInstanceById(dir);

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

		const { index, instance } = this.getInstanceById(id);

		if (instance) {
			const port = instance.getPort();

			instance.destroy();

			this.app.log(`Port ${port} is now free`);
			this.usedPorts[port] = false;

			if (!noSplice) {
				this.instances.splice(index, 1);
			}
		}
	}

	getInstanceById(id: string) {
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

	protected getInstanceByReq(req: express.Request) {
		const instanceId = this.options.getInstanceIdByReq(req);

		return this.getInstanceById(instanceId);
	}

	protected async initInstance(dir: string) {
		const port = this.getAvailablePort();
		const cwd = path.resolve(this.options.dir, dir);

		if (!fs.existsSync(cwd)) {
			this.app.log(`Init instance failed. Directory "${cwd}" not found`);
		} else {
			this.usedPorts[port] = true;

			this.app.log(`Use port ${port} for instance ${dir}`);

			const instance = new ServiceInstance(
				this.app,
				{
					serviceName: this.options.name,
					id: dir,
					port,
					cwd,
					exec: this.options.exec,
					logPrefixFormat: this.options.logPrefixFormat,
				},
			);

			this.instances.push(instance);
		}
	}

	protected proxyToInstance(instance: ServiceInstance, req: express.Request, res: express.Response) {
		try {
			const proxy = httpProxy.createProxyServer();

			proxy.web(req, res, { target: `http://127.0.0.1:${instance.getPort()}` });

			proxy.on('error', (err: Error) => {
				this.app.log(`Error proxy: `, err && err.toString());

				this.proxyErrorHandler(res, err);

				proxy.close();
			});

			proxy.on('close', () => this.app.log(`Proxy to port ${instance.getPort()} closed`));
		} catch (err) {
			this.proxyErrorHandler(res, err);
		}
	}

	protected startHttpWrapper() {
		this.server = express();

		this.server.listen(this.options.port, '0.0.0.0', () => {
			this.app.log(`Service ${this.options.name} http server listening on http://0.0.0.0:${this.options.port}`);

			this.server.all('*', async (req: express.Request, res: express.Response) => {
				const instanceId = this.options.getInstanceIdByReq(req);
				const { instance } = this.getInstanceByReq(req);

				if (instance) {
					this.app.log(`Instance found on port ${instance.getPort()}`);

					if (instance.isRunned) {
						this.proxyToInstance(instance, req, res);
					} else if (instance.isRunning) {
						await instance.promiseRun;
						this.proxyToInstance(instance, req, res);
					} else {
						await instance.run();
						this.proxyToInstance(instance, req, res);
					}
				} else {
					this.app.log(`Instance "${instanceId}" not found`);

					res.status(404);
					res.send(`<h1>Instance "${instanceId}" not found</h1>`);
				}
			});
		});
	}

	protected getAvailablePort() {
		const port = Number(Object.keys(this.usedPorts).find((port) => !this.usedPorts[Number(port)]));

		return isNaN(port) ? null : port;
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
