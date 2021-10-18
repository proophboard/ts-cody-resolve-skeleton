#!/usr/bin/env bash

if [[ ! -f .env ]]; then
    echo "Please copy the file .env.dist to .env and configure for your needs!" >&2
    (return 2>/dev/null) && return 1 || exit 1
fi

if [[ ! -d app/node_modules ]]; then
    # wait until dependencies are installed
    docker-compose run --rm app yarn install
fi

if [[ ! -d cody/node_modules ]]; then
    # wait until dependencies are installed
    docker-compose run --rm cody yarn install
fi

docker-compose up -d --no-recreate

docker-compose ps
