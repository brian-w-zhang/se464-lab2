# SE464 Lab 2: Load Balancing, Multithreading, and Observability

This is our Lab 1 server (Express REST + MySQL on RDS) extended for Lab 2:

- **Logging to CloudWatch** with Winston (`src/logger.ts`). Every request is logged with its method, path, route params, query string, status, server-side duration and the running request count. Logs go to the console and to CloudWatch log group/stream `server-logs`.
- **Multithreading with PM2** (`ecosystem.config.js`): 2 workers in cluster mode. Each log line is tagged with the PM2 worker id (`[worker 0]`, `[worker 1]`).
- **Load balancing**: two identical EC2 instances behind an AWS Application Load Balancer (HTTP :3000). The ALB was set up in the AWS console/CLI, so there's no code for it here.
- **Keep-alive fix**: the HTTP keep-alive timeout is raised to 65 s, above the ALB's 60 s idle timeout. With Node's 5 s default, clients reusing idle connections got "socket hang up" errors (and an ALB can return 502s).

Results, screenshots and answers are in the Lab 2 report (shared separately).

Lab 2 only uses the **REST + MySQL** configuration. The gRPC and DynamoDB code from Lab 1 is still here but unused.

## Setup

Requires Node 20+.

```
npm ci
```

Create a `.env` in the repo root. Never commit it; it's in `.gitignore`.

```
RDS_HOSTNAME=<rds endpoint>
RDS_USERNAME=<master username>
RDS_PASSWORD=<master password>
RDS_PORT=3306
RDS_DATABASE=se464
AWS_REGION=us-east-1
```

The database is populated with the Lab 1 `database-setup` scripts.

**CloudWatch access:** the logger writes to log group `server-logs`, stream `server-logs` in us-east-1. Create both first in CloudWatch → Log management. On EC2, attach an IAM role with CloudWatch Logs permissions (we used the AWS-managed `CloudWatchAgentServerPolicy`), so no access keys are needed. When running locally, the AWS SDK uses your normal AWS CLI credentials.

## Running

One Node process (Part 1, and the "without PM2" runs):

```
npm start rest mysql
```

PM2 cluster mode with 2 workers (Part 2):

```
npm i -g pm2
npx tsc
pm2 start ecosystem.config.js
pm2 logs se464-lab     # wait for "MySQL connected!" from both workers
pm2 monit              # live view of each worker
pm2 delete all         # stop
```

Stop any `npm start` server before starting PM2; both use port 3000.

## Benchmarking

We used the Lab 1 benchmarker with the gRPC suite commented out in `src/testing.ts`, pointed at either an instance's public IP or the ALB's DNS name. An *N*-iteration run sends *N* concurrent requests to each endpoint.

To keep a long-running server alive after logging out of EC2, use `screen` (or PM2):

```
screen -S server          # start a session, run the server, then Ctrl+A D to detach
screen -r server          # reattach
```
