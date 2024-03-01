# docker-k6-grafana-influxdb
Demonstrates how to run load tests with containerised instances of K6, Grafana and InfluxDB.

## Setup steps
.env:
```
BASE_URL="https://"
USERNAME=""
PASSWORD=""
```
docker-compose up -d influxdb grafana
docker-compose run k6 run /scripts/regular.js

Cleanup with this when done:
docker rm $(docker ps -q -a -f status=exited --filter name=dockerk6 | xargs)

## Wild Goosechase with K6 and Docker
In a very particular set of circumstances, Docker networking fails intermittently. The symptom is occasional “dial i/o timeout”-errors on egress connections (leaving the container environment, docker-to-host/remote and docker-to-docker via host.docker.internal). The observed behavior is very similar to the issue described in https://github.com/docker/for-win/issues/8861.

https://medium.com/@olebhansen/what-i-learned-from-a-wild-goose-chase-with-k6-and-docker-2a7dcfa00265

#### Article
This is the accompanying source code for the following article. Please read for a detailed breakdown of the code and how K6, Grafana and InfluxDB work together using Docker Compose:

https://medium.com/swlh/beautiful-load-testing-with-k6-and-docker-compose-4454edb3a2e3

#### Dashboards
The dashboard in /dashboards is adapted from the excellent K6 / Grafana dashboard here:
https://grafana.com/grafana/dashboards/2587

There are only two small modifications:
* the data source is configured to use the docker created InfluxDB data source
* the time period is set to now-15m, which I feel is a better view for most tests

#### Scripts
The script here is an example of a low Virtual User (VU) load test of the excellent Star Wars API:
https://swapi.dev/

If you're tinkering with the script, it is just a friendly open source API, be gentle!
