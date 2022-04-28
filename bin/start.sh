#!/usr/bin/env bash

function kill_processes() {
	echo "";

	echo "KILL TS $pid_ts";
	kill -9 "$pid_ts";

	echo "KILL NODEMON $pid_nodemon";
	kill -9 "$pid_nodemon";

	exit 0;
}

npm run build

npm run ts -- -w &
pid_ts=$!

npm run nodemon &
pid_nodemon=$!

trap kill_processes SIGHUP SIGINT SIGTERM
wait
