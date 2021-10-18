# reSolve + Cody Skeleton

Cody is a code monkey bot running in the context of a project. It's communicating with [prooph board](https://prooph-board.com/) and translates a visual design in working code at realtime.
This is a preconfigured skeleton app based on [reSolve framework](https://github.com/reimagined/resolve) and with integrated [Cody hooks](https://github.com/event-engine/nodejs-inspectio-cody).

## Installation
Please make sure you have installed [Docker](https://docs.docker.com/install/ "Install Docker") 
and [Docker Compose](https://docs.docker.com/compose/install/ "Install Docker Compose").

Please copy the file `.env.dist` to `.env` and configure for your needs e.g. UID!

## Running

To start this application, you should use the `dev.sh` bash script in the root directory.
This is needed to setup the application. After that you can use Docker Compose as usual.

```bash
$ ./dev.sh
```

## Repo Structure

It's split into two main parts:

1.) The reSolve app is found in `app/src`
2.) Cody server `cody/src` & specific Cody hooks in `cody/hooks`

### Install Dependencies

You have to install dependencies for both parts independently:

```bash
docker-compose run --rm app yarn install
docker-compose run --rm cody yarn install
```
## Connect to Cody

Open a board in [prooph board (free)](https://free.prooph-board.com/) and connect Cody on `http://localhost:3322`
Cody will say hello and explain you everything.

## Open the app

[http://localhost:3000/](http://localhost:3000/)
