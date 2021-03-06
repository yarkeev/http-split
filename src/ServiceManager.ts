import { App } from './App';
import { Service } from './Service';

import { IServiceConfig } from './interfaces';

export interface IServiceManagerOptions {
	auditTimeout: number;
	services: IServiceConfig[];
}

export class ServiceManager {

	protected app: App;
	protected options: IServiceManagerOptions;
	protected services: Service[];

	constructor(app: App, options: IServiceManagerOptions) {
		this.app = app;
		this.options = options;

		this.initInstances();

		setInterval(() => this.audit(), this.options.auditTimeout);
	}

	initInstances() {
		this.services = this.options.services.map((config: IServiceConfig) => new Service(this.app, config));

		this.services.forEach((service: Service) => service.init());
	}

	destroy() {
		this.app.log('Start destroy ServiceManager');

		for (let i = 0; i < this.services.length; i++) {
			this.services[i].destroy();
		}

		this.services = [];

		this.app.log('Finish destroy ServiceManager');
	}

	audit() {
		this.app.log('Run audit services');

		this.services.forEach((service: Service) => service.audit());
	}

	restartInstance(serviceName: string, instanceId: string) {
		const service = this.services.find((service: Service) => service.getName() === serviceName);

		if (service) {
			service.restartById(instanceId);
		} else {
			this.app.log(`Service "${serviceName}" not found`);
		}
	}
}