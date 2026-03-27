# Distributed Task Scheduling & Processing

## Overview

The SwapTrade Backend now includes a comprehensive distributed task scheduling system built on top of Bull queues and NestJS Schedule. This system handles cache warming, reporting, cleanup tasks, and portfolio optimization with built-in monitoring, failover, and recovery mechanisms.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Scheduler Service                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Cron Jobs (NestJS Schedule)                         │   │
│  │  - Cache Warming (every 30 min)                      │   │
│  │  - Portfolio Optimization (daily 1 AM)               │   │
│  │  - Daily Reports (daily 2 AM)                        │   │
│  │  - Weekly Cleanup (Sunday 3 AM)                      │   │
│  │  - Health Checks (every 5 min)                       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Queue Service                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Notifications│  │    Reports   │  │   Cleanup    │      │
│  │    Queue     │  │    Queue     │  │    Queue     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 Monitoring & Failover                        │
│  ┌─────────────────────┐  ┌──────────────────────┐         │
│  │ Queue Monitoring    │  │  Failover Service    │         │
│  │ - Task Metrics      │  │  - Auto-retry        │         │
│  │ - Health Status     │  │  - Stalled jobs      │         │
│  │ - Performance       │  │  - DLQ management    │         │
│  └─────────────────────┘  └──────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

## Scheduled Tasks

### Task Schedule Summary

| Task Name | Schedule | Description | Priority |
|-----------|----------|-------------|----------|
| `cache-warming` | Every 30 minutes | Pre-populate cache with frequently accessed data | High |
| `portfolio-optimization` | Daily at 1:00 AM UTC | Generate portfolio optimization reports | Medium |
| `daily-report-generation` | Daily at 2:00 AM UTC | Generate daily performance reports | Medium |
| `hourly-temp-cleanup` | Every hour | Clean up temporary files older than 1 hour | Low |
| `session-cleanup` | Every 30 minutes | Remove expired user sessions | Low |
| `weekly-cleanup` | Sunday at 3:00 AM UTC | Deep cleanup of old data and logs | Low |
| `system-health-check` | Every 5 minutes | Monitor queue health and send alerts | High |
| `monthly-report-generation` | 1st of month at 1:00 AM UTC | Generate monthly reports | Medium |

### Task Details

#### 1. Cache Warming (`*/30 * * * *`)

**Purpose**: Pre-populate cache to improve application performance

**Implementation**:
```typescript
@Cron('*/30 * * * *', { name: 'cache-warming' })
async performCacheWarming(): Promise<void> {
  const warmingResult = await this.cacheWarming.forceWarmCache();
  // Records metrics and sends alerts if failures exceed threshold
}
```

**Strategies**:
- `user_balances`: Cache user balance data
- `market_data`: Cache market prices for popular symbols
- `trading_pairs`: Cache trading pair information
- `portfolio`: Cache portfolio calculations

**Monitoring**: 
- Tracks keys warmed, success/failure counts
- Sends alert if failure rate > 50%

#### 2. Portfolio Optimization (`0 1 * * *`)

**Purpose**: Generate daily portfolio optimization reports

**Implementation**:
```typescript
@Cron('0 1 * * *', { name: 'portfolio-optimization' })
async performPortfolioOptimization(): Promise<void> {
  await this.queueService.addReportJob({
    reportType: 'custom',
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
    format: 'xlsx',
    filters: { includeOptimization: true },
  });
}
```

#### 3. Daily Reports (`0 2 * * *`)

**Purpose**: Generate daily performance reports for admins

**Implementation**:
```typescript
@Cron('0 2 * * *', { name: 'daily-report-generation' })
async generateDailyReports(): Promise<void> {
  const adminEmails = await this.getAdminEmails();
  for (const email of adminEmails) {
    await this.queueService.generateDailyReport(email);
  }
}
```

#### 4. System Health Check (`*/5 * * * *`)

**Purpose**: Monitor queue health and detect issues early

**Implementation**:
```typescript
@Cron(CronExpression.EVERY_5_MINUTES, { name: 'system-health-check' })
async checkSystemHealth(): Promise<void> {
  const unhealthyQueues = [];
  for (const queueName of queueNames) {
    const health = this.queueAnalytics.getQueueHealth(queueName);
    if (health.status !== 'healthy') {
      unhealthyQueues.push(`${queueName}: ${health.issues.join(', ')}`);
    }
  }
  
  if (unhealthyQueues.length > 0) {
    await this.queueService.addNotificationJob({
      userId: 'admin',
      type: 'system_alert',
      title: 'Queue Health Alert',
      message: `Unhealthy queues: ${unhealthyQueues.join('; ')}`,
      priority: 'high',
    });
  }
}
```

## Failover & Recovery

### Automatic Failover Mechanisms

#### 1. Health Monitoring (`SchedulerFailoverService`)

- **Frequency**: Every 5 minutes
- **Checks**:
  - Failed job count per queue
  - Active/stalled job detection
  - Queue connectivity

**Auto-Recovery Triggers**:
```typescript
if (jobCounts.failed > 100) {
  await this.autoRetryFailedJobs(queue, 10);
}
```

#### 2. Stalled Job Handler

**Detection**: Bull's built-in stalled job detection

**Recovery Strategy**:
```typescript
async handleStalledJob(queue: Queue, jobId: string): Promise<void> {
  const stalledCount = job.opts?.maxStalledCount || 1;
  
  if (job.attemptsMade >= stalledCount) {
    // Move to Dead Letter Queue
    await this.dlqService.addToDLQ(job, error, 'MAX_STALLED', queue.name);
  } else {
    // Retry the job
    await job.retry();
  }
}
```

#### 3. Auto-Retry Mechanism

**Configuration**:
- Max retries: 3 (configurable per job type)
- Backoff strategy: Exponential with jitter
- Non-retryable errors: ValidationError, AuthenticationError, PermissionDenied

**Implementation**:
```typescript
async autoRetryFailedJobs(queue: Queue, maxRetries: number = 10): Promise<number> {
  const failedJobs = await queue.getFailed(0, maxRetries);
  let retryCount = 0;

  for (const job of failedJobs) {
    if (await this.canRetryJob(job)) {
      await job.retry();
      retryCount++;
    }
  }
  
  return retryCount;
}
```

#### 4. Dead Letter Queue (DLQ)

**When jobs go to DLQ**:
- Max retries exceeded
- Non-retryable errors
- Max stalled count exceeded
- Manual DLQ placement

**DLQ Management**:
- Retention: 7 days
- Recovery via API endpoints
- Automatic cleanup of old failed jobs

## Monitoring & Metrics

### Task Execution Tracking

**Recorded Metrics**:
- `lastExecution`: Last execution timestamp
- `nextExecution`: Next scheduled execution
- `status`: scheduled | running | completed | failed
- `lastDuration`: Execution duration in ms
- `lastError`: Error message if failed
- `executionCount`: Total executions
- `failureCount`: Total failures

### API Endpoints

#### Get Scheduler Status
```http
GET /api/scheduler/status
```

**Response**:
```json
{
  "success": true,
  "data": {
    "status": "running",
    "scheduledJobs": [
      {
        "name": "cache-warming",
        "schedule": "*/30 * * * *",
        "description": "Cache warming every 30 minutes"
      },
      {
        "name": "portfolio-optimization",
        "schedule": "0 1 * * *",
        "description": "Portfolio optimization at 1 AM"
      }
      // ... more jobs
    ]
  },
  "timestamp": "2024-01-30T19:30:00Z"
}
```

#### Get Scheduled Task Metrics
```http
GET /api/scheduler/metrics
```

**Response**:
```json
{
  "success": true,
  "data": {
    "totalTasks": 8,
    "totalExecutions": 1250,
    "totalFailures": 12,
    "successRate": "99.04%",
    "tasks": [
      {
        "name": "cache-warming",
        "lastExecution": "2024-01-30T19:00:00Z",
        "status": "completed",
        "lastDuration": 1523,
        "failureCount": 2
      }
    ]
  },
  "timestamp": "2024-01-30T19:30:00Z"
}
```

#### Trigger Cache Warming (Manual)
```http
POST /api/scheduler/trigger/cache-warming
```

#### Trigger Portfolio Optimization (Manual)
```http
POST /api/scheduler/trigger/portfolio-optimization
```

#### Get Failed Jobs Summary
```http
GET /api/scheduler/failover/:queueName/summary
```

**Response**:
```json
{
  "success": true,
  "data": {
    "queue": "notifications",
    "totalFailed": 15,
    "recentFailures": [
      {
        "id": "123",
        "failedAt": "2024-01-30T18:45:00Z",
        "error": "Connection timeout",
        "attempts": 3
      }
    ]
  }
}
```

#### Recover Failed Jobs
```http
POST /api/scheduler/failover/:queueName/recover
Content-Type: application/json

{
  "limit": 50
}
```

## Configuration

### Environment Variables

```bash
# Redis Configuration (required for Bull queues)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Cache Warming Configuration
CACHE_WARMING_ENABLED=true
CACHE_WARMING_TIMEOUT=30000
CACHE_WARMING_STRATEGIES=user_balances,market_data,portfolio,trading_pairs

# Queue Configuration
QUEUE_CONCURRENCY=5
QUEUE_MAX_STALLED_COUNT=10
QUEUE_STALLED_INTERVAL=30000

# Feature Flags
FEATURE_QUEUE_MONITORING=true
```

### Queue Configuration

Each queue has specific settings optimized for its workload:

```typescript
// Notifications Queue (high throughput)
{
  name: QueueName.NOTIFICATIONS,
  limiter: { max: 100, duration: 1000 },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  }
}

// Reports Queue (long-running jobs)
{
  name: QueueName.REPORTS,
  limiter: { max: 1, duration: 5000 },
  defaultJobOptions: {
    attempts: 2,
    timeout: 300000, // 5 minutes
    backoff: { type: 'exponential', delay: 5000 },
  }
}
```

## Reliability Features

### 1. Exponential Backoff

Prevents cascade failures by spacing out retry attempts:

```typescript
backoff: {
  type: 'exponential',
  delay: 1000, // Base delay
  // Actual delay = delay * 2^attemptNumber + jitter
}
```

### 2. Job Timeouts

Prevents jobs from running indefinitely:

```typescript
defaultJobOptions: {
  timeout: 30000, // 30 seconds for notifications
  // timeout: 300000, // 5 minutes for reports
}
```

### 3. Rate Limiting

Protects downstream services from overload:

```typescript
limiter: {
  max: 100,      // Max jobs per interval
  duration: 1000 // Interval in ms
}
```

### 4. Circuit Breaker Pattern

Implemented in cache service to prevent cascade failures when cache is unavailable.

### 5. Idempotency

Jobs are designed to be idempotent where possible:

```typescript
// Check if notification already sent
if (await this.isAlreadySent(job.data)) {
  return; // Skip duplicate
}
```

## Operations Guide

### Starting the Scheduler

The scheduler starts automatically when the application starts:

```bash
npm run start:dev
# or
npm run start:prod
```

### Monitoring Scheduler Health

1. **Check scheduler status**:
   ```bash
   curl http://localhost:3000/api/scheduler/status
   ```

2. **View task metrics**:
   ```bash
   curl http://localhost:3000/api/scheduler/metrics
   ```

3. **Check queue health**:
   ```bash
   curl http://localhost:3000/api/queue/health
   ```

### Manual Task Execution

Trigger tasks manually when needed:

```bash
# Trigger cache warming
curl -X POST http://localhost:3000/api/scheduler/trigger/cache-warming

# Trigger portfolio optimization
curl -X POST http://localhost:3000/api/scheduler/trigger/portfolio-optimization

# Trigger custom report
curl -X POST http://localhost:3000/api/scheduler/trigger/custom-report \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","format":"pdf"}'
```

### Recovering Failed Jobs

```bash
# Get failed jobs summary
curl http://localhost:3000/api/scheduler/failover/notifications/summary

# Attempt recovery
curl -X POST http://localhost:3000/api/scheduler/failover/notifications/recover \
  -H "Content-Type: application/json" \
  -d '{"limit":50}'
```

### Debugging Issues

1. **Check task execution logs**:
   ```typescript
   // Logs show task execution with timing
   Logger.log('Cache warming completed: 150 keys, 148 success, 2 failed');
   ```

2. **Review failed job details**:
   ```bash
   curl http://localhost:3000/api/queue/admin/dead-letter/notifications
   ```

3. **Monitor real-time queue status**:
   ```bash
   # Watch queue metrics
   watch -n 5 'curl -s http://localhost:3000/api/queue/metrics'
   ```

## Performance Considerations

### Concurrency Settings

Adjust based on job type:

```typescript
// High concurrency for fast jobs
@Process({ concurrency: 10 })

// Low concurrency for resource-intensive jobs
@Process({ concurrency: 1 })
```

### Memory Management

- Completed jobs are automatically removed after 24 hours
- Failed jobs retained for 7 days for debugging
- Metrics history limited to 24 hours

### Redis Performance

- Use Redis Cluster for high availability
- Configure proper connection pooling
- Monitor Redis memory usage

## Best Practices

### 1. Job Design

✅ **DO**:
- Keep jobs idempotent
- Set appropriate timeouts
- Use exponential backoff
- Log progress with `job.progress()`
- Handle errors gracefully

❌ **DON'T**:
- Run jobs indefinitely
- Skip error handling
- Ignore job timeouts
- Forget to record metrics

### 2. Monitoring

✅ **DO**:
- Set up alerts for failure rates > 5%
- Monitor queue backlog growth
- Track processing time trends
- Review DLQ regularly

❌ **DON'T**:
- Ignore growing waiting queues
- Skip health checks
- Miss alert notifications

### 3. Scaling

✅ **DO**:
- Use multiple worker instances
- Configure appropriate concurrency
- Monitor Redis performance
- Implement graceful shutdown

❌ **DON'T**:
- Run too many concurrent heavy jobs
- Ignore rate limits
- Forget about lock durations

## Troubleshooting

### Issue: Jobs Not Executing

**Possible Causes**:
1. Redis connection lost
2. Queue paused
3. All workers busy

**Solutions**:
```bash
# Check queue health
curl http://localhost:3000/api/queue/health

# Resume paused queue
curl -X POST http://localhost:3000/api/queue/admin/notifications/resume

# Check Redis connectivity
redis-cli ping
```

### Issue: High Failure Rate

**Possible Causes**:
1. Downstream service unavailable
2. Invalid job data
3. Resource exhaustion

**Solutions**:
```bash
# Get failed jobs analysis
curl http://localhost:3000/api/scheduler/failover/notifications/summary

# Retry failed jobs
curl -X POST http://localhost:3000/api/scheduler/failover/notifications/recover

# Check system resources
top
free -m
```

### Issue: Slow Processing

**Possible Causes**:
1. Redis latency
2. Too many concurrent jobs
3. Resource contention

**Solutions**:
```bash
# Check Redis latency
redis-cli --latency

# Reduce concurrency temporarily
# Update queue configuration

# Monitor job processing times
curl http://localhost:3000/api/scheduler/metrics
```

## Future Enhancements

- [ ] Dynamic schedule adjustment based on load
- [ ] Priority-based preemption for critical jobs
- [ ] Distributed locking for cluster-wide singleton jobs
- [ ] Job dependency graphs
- [ ] Advanced analytics dashboard
- [ ] Predictive scaling based on historical patterns

## Related Documentation

- [Queue Implementation Guide](./QUEUE_IMPLEMENTATION_GUIDE.md)
- [Advanced Caching](./ADVANCED_CACHING.md)
- [Error Handling](./ERROR_HANDLING.md)
- [Performance Optimization](./PERFORMANCE_OPTIMIZATION.md)
