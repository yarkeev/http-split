import * as express from 'express';

export interface IServiceExecParams {
	start: string;
	extra: string;
	extraPort: string;
}

export interface IServiceConfig {
	name: string;
	port: number;
	dir: string;
	exclude?: string[];
	exec: IServiceExecParams;
	startPort: number;
	endPort: number;
	logPrefixFormat?: string;
	getInstanceIdByReq(req: express.Request): string;
}
