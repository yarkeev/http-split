import { spawn, ChildProcess } from 'child_process';

import { App } from './App';

import { IServiceExecParams } from './interfaces';

export interface IServiceInstanceOptions {
	serviceName: string;
	id: string;
	port: number;
	cwd: string;
	exec: IServiceExecParams;
	logPrefixFormat?: string;
}

export class ServiceInstance {

	protected app: App;
	protected options: IServiceInstanceOptions;
	protected process: ChildProcess;

	constructor(app: App, options: IServiceInstanceOptions) {
		this.app = app;
		this.options = options;
	}

	async run() {
		const exec = this.options.exec;
		const args = [
			...exec.extra.split(' '),
			exec.extraPort,
			String(this.options.port),
		];
		const isSupportedInstanceId = await this.isSupportedArgument('--instance-id');

		if (isSupportedInstanceId) {
			args.push(`--instance-id=${this.options.id}`);
		}

		App.log(`Run instance of service ${this.options.serviceName} on port ${this.options.port} with args ${JSON.stringify(args)}`);

		this.process = spawn(
			exec.start,
			args,
			{
				cwd: this.options.cwd,
			}
		);

		this.process.stdout.on('data', (data) => this.logFromInstance(data.toString()));
		this.process.stdout.on('error', (data) => this.logFromInstance(data.toString()));
		this.process.stderr.on('data', (data) => this.logFromInstance(data.toString()));
		this.process.stderr.on('error', (data) => this.logFromInstance(data.toString()));

		this.process.on('close', (code) => {
			this.app.log(`Process of service ${this.options.serviceName} with id ${this.getId()} exit with code ${code}`);
		});
	}

	protected async isSupportedArgument(arg: string) {
		return new Promise((resolve) => {
			const { exec, cwd } = this.options;
			const process = spawn(
				exec.start,
				['-h'],
				{ cwd },
			);
			let output = '';

			process.stdout.on('data', (data) => output += data.toString());

			process.on('close', () => resolve(output.includes(arg)));
		});
	}

	destroy() {
		this.app.log(`Destroy instance with id "${this.getId()}" in service ${this.options.serviceName}`);

		if (this.process) {
			try {
				this.process.kill();
			} catch (err) {
				this.app.log(`Failed kill process`);
			}
		} else {
			this.app.log(`Process does not exist`);
		}
	}

	getId() {
		return this.options.id;
	}

	getPort() {
		return this.options.port;
	}

	protected getLogPrefix(): string {
		const format = this.options.logPrefixFormat || '%{date} => %{service} => %{instance_id}';

		return format
			.replace(/%\{date\}/g, (new Date()).toString())
			.replace(/%\{service\}/g, this.options.serviceName)
			.replace(/%\{instance_id\}/g, this.getId());
	}

	protected logFromInstance(message: string) {
		console.log(`${this.getLogPrefix()}: ${message}`);
	}

}
