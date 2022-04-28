import * as fs from 'fs';
import * as path from 'path';
import * as commander from 'commander';

import { ServiceManager } from './ServiceManager';
import { Api } from './Api';

import { IServiceConfig } from './interfaces';

export interface IPackage {
	version: string;
}

export interface IAppOptions {
	config: string;
}

export interface IConfig {
	auditTimeout: number;
	apiPort: number;
	services: IServiceConfig[];
}

export class App {

	protected options: IAppOptions;
	protected pkg: IPackage;
	protected config: IConfig;
	protected serviceManager: ServiceManager;
	protected api: Api;

	static log(...args: any[]) {
		console.log.apply(console, [(new Date()).toString(), ':'].concat(Array.prototype.slice.call(arguments)));
	}

	constructor() {
		this.parsePkg();

		const options: IAppOptions = commander
			.option('-c, --config <config>', 'path to config')
			.version(this.pkg.version)
			.parse(process.argv) as any;

		this.options = {
			...options,
		};

		if (this.options.config) {
			this.init();
		} else {
			this.log(`--config option is required`);
		}
	}

	destroy() {
		this.log('Start destroy App');

		this.serviceManager.destroy();

		this.log('Finish destroy App');
	}

	parsePkg() {
		this.pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json')).toString());
	}

	getServiceManager() {
		return this.serviceManager;
	}

	async init() {
		try {
			this.config = await this.readConfig();

			this.serviceManager = new ServiceManager(this, {
				auditTimeout: this.config.auditTimeout,
				services: this.config.services,
			});

			this.api = new Api(this, {
				port: this.config.apiPort,
			});
		} catch (err) {
			this.log(`Failed init: ${err.toString()}`);
		}
	}

	log(...args: any[]) {
		App.log(...args);
	}

	protected readConfig(): Promise<IConfig> {
		const cfgPath = path.resolve(this.options.config);

		this.log(`Read config from ${cfgPath}`);

		try {
			const config = require(cfgPath);

			return {
				auditTimeout: config.auditTimeout || 60 * 1000,
				apiPort: config.apiPort || 13000,
				...config,
			}
		} catch (err) {
			this.log(`Failed read config file: ${err.toString()}`);

			throw err;
		}
	}

}
