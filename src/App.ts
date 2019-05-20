import * as fs from 'fs';
import * as path from 'path';
import * as commander from 'commander';

import { ServiceManager } from './ServiceManager';

import { IServiceConfig } from './interfaces';

export interface IPackage {
	version: string;
}

export interface IAppOptions {
	config: string;
}

export interface IConfig {
	auditTimeout: number;
	services: IServiceConfig[];
}

export class App {

	protected options: IAppOptions;
	protected pkg: IPackage;
	protected config: IConfig;
	protected serviceManager: ServiceManager;

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

		this.init();
	}

	destroy() {
		this.serviceManager.destroy();
	}

	parsePkg() {
		this.pkg = JSON.parse(fs.readFileSync('./package.json').toString());
	}

	async init() {
		try {
			this.config = await this.readConfig();

			this.serviceManager = new ServiceManager(this, {
				auditTimeout: this.config.auditTimeout,
				services: this.config.services,
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
				...config,
			}
		} catch (err) {
			this.log(`Failed read config file: ${err.toString()}`);

			throw err;
		}

		// return new Promise((resolve, reject) => {
		// 	// fs.readFile(this.options.config, 'utf-8', (err, content) => {
		// 	// 	if (err) {
		// 	// 		this.log(`Failed read config file: ${err.toString()}`);
		// 	//
		// 	// 		reject(err);
		// 	// 	} else {
		// 	// 		try {
		// 	// 			resolve(JSON.parse(content));
		// 	// 		} catch (err) {
		// 	// 			this.log(`Failed parse config file: ${err.toString()}`);
		// 	//
		// 	// 			reject(err);
		// 	// 		}
		// 	// 	}
		// 	// });
		// });
	}

}