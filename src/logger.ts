// Load .env before the CloudWatch transport reads the AWS credentials.
// ES imports are hoisted, so main.ts's dotenv.config() runs too late.
import "dotenv/config";
import winston from 'winston';
import WinstonCloudWatch from 'winston-cloudwatch';

// PM2 cluster mode sets NODE_APP_INSTANCE (0, 1, ...) for each worker
export const WORKER = process.env.NODE_APP_INSTANCE ?? 'single';

// Create a Winston logger
const logger = winston.createLogger({
  level: 'info', // Set the desired log level
  format: winston.format.json(),
  // pid tells the PM2 cluster workers apart in CloudWatch
  defaultMeta: { service: 'express-app', pid: process.pid, worker: WORKER },
  transports: [
    // Output logs to the console for local development
    new winston.transports.Console(),

    // Send logs to CloudWatch Logs
    new WinstonCloudWatch({
      logGroupName: 'server-logs',
      logStreamName: 'server-logs',
      awsRegion: 'us-east-1', // Shouldn't have to replace this
      jsonMessage: true, // Ensure logs are formatted as JSON
    }),
  ],
});

export default logger;
