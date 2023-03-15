import { App } from './App';

export { App };

export const run = () => {
	let app: App;

	try {
		app = new App();
	} catch (err) {
		console.error('ERROR: ', err, err.stack);
		app.destroy();
	}

	process.on('SIGTERM', () => {
		app.destroy();

		process.exit(0);
	});

	process
		.on('uncaughtException', (err: Error) => {
			console.error(err, err.stack, 'Uncaught Exception thrown');
			app.destroy();
			process.exit(1);
		});
};
