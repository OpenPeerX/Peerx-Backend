import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EdgeNode {
  id: string;
  region: string;
  endpoint: string;
  latency: number;
  healthy: boolean;
  lastHealthCheck: Date;
  computeCapacity: number;
  currentLoad: number;
}

export interface EdgeRequest {
  id: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
  region?: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  timeout: number;
}

export interface EdgeResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  edgeNode: string;
  latency: number;
  cached: boolean;
  region: string;
}

@Injectable()
export class EdgeComputingService {
  private readonly logger = new Logger(EdgeComputingService.name);
  private edgeNodes: Map<string, EdgeNode> = new Map();
  private requestQueue: Map<string, Promise<EdgeResponse>> = new Map();

  constructor(private readonly configService: ConfigService) {
    this.initializeEdgeNodes();
  }

  private initializeEdgeNodes(): void {
    const config = this.configService.get('edge');
    if (!config?.edge?.enabled) {
      this.logger.warn('Edge computing is disabled');
      return;
    }

    const regions = config.edge.regions || [];
    regions.forEach((region: string) => {
      const nodeId = `edge-${region}`;
      this.edgeNodes.set(nodeId, {
        id: nodeId,
        region,
        endpoint: this.getEdgeEndpoint(region),
        latency: 0,
        healthy: true,
        lastHealthCheck: new Date(),
        computeCapacity: config.edge.computeUnits || 10,
        currentLoad: 0,
      });
    });

    this.logger.log(`Initialized ${this.edgeNodes.size} edge nodes`);
  }

  private getEdgeEndpoint(region: string): string {
    // Map regions to edge endpoints
    const endpoints: Record<string, string> = {
      'us-east': 'https://edge-us-east.swaptrade.io',
      'us-west': 'https://edge-us-west.swaptrade.io',
      'eu-west': 'https://edge-eu-west.swaptrade.io',
      'eu-central': 'https://edge-eu-central.swaptrade.io',
      'ap-southeast': 'https://edge-ap-southeast.swaptrade.io',
      'ap-northeast': 'https://edge-ap-northeast.swaptrade.io',
    };
    return endpoints[region] || `https://edge-${region}.swaptrade.io`;
  }

  async routeRequest(request: EdgeRequest): Promise<EdgeResponse> {
    const startTime = Date.now();
    const config = this.configService.get('edge');

    if (!config?.edge?.enabled) {
      return this.fallbackToOrigin(request);
    }

    // Select optimal edge node
    const edgeNode = await this.selectOptimalEdgeNode(request);
    if (!edgeNode) {
      this.logger.warn('No healthy edge nodes available, falling back to origin');
      return this.fallbackToOrigin(request);
    }

    // Check for request deduplication
    const deduplicationKey = this.getDeduplicationKey(request);
    if (config.deduplication?.enabled && this.requestQueue.has(deduplicationKey)) {
      this.logger.debug(`Deduplicating request: ${deduplicationKey}`);
      return this.requestQueue.get(deduplicationKey)!;
    }

    // Execute request at edge
    const responsePromise = this.executeAtEdge(edgeNode, request);
    
    if (config.deduplication?.enabled) {
      this.requestQueue.set(deduplicationKey, responsePromise);
      responsePromise.finally(() => {
        this.requestQueue.delete(deduplicationKey);
      });
    }

    const response = await responsePromise;
    const latency = Date.now() - startTime;

    // Update edge node metrics
    this.updateEdgeNodeMetrics(edgeNode.id, latency);

    // Log performance
    this.logPerformance(request, response, latency);

    return {
      ...response,
      latency,
      edgeNode: edgeNode.id,
      region: edgeNode.region,
    };
  }

  private async selectOptimalEdgeNode(request: EdgeRequest): Promise<EdgeNode | null> {
    const healthyNodes = Array.from(this.edgeNodes.values()).filter(node => node.healthy);
    
    if (healthyNodes.length === 0) {
      return null;
    }

    const config = this.configService.get('edge');
    const strategy = config?.geographic?.routingStrategy || 'latency';

    switch (strategy) {
      case 'latency':
        return this.selectByLatency(healthyNodes);
      case 'geo':
        return this.selectByGeo(healthyNodes, request);
      case 'round-robin':
        return this.selectByRoundRobin(healthyNodes);
      default:
        return this.selectByLatency(healthyNodes);
    }
  }

  private selectByLatency(nodes: EdgeNode[]): EdgeNode {
    return nodes.reduce((fastest, current) => 
      current.latency < fastest.latency ? current : fastest
    );
  }

  private selectByGeo(nodes: EdgeNode[], request: EdgeRequest): EdgeNode {
    // Extract region from request headers or use default
    const clientRegion = request.headers['x-client-region'] || 
                        request.headers['cf-ipcountry'] ||
                        this.configService.get('edge')?.geographic?.defaultRegion;
    
    if (clientRegion) {
      const regionalNode = nodes.find(node => node.region === clientRegion);
      if (regionalNode) {
        return regionalNode;
      }
    }

    // Fallback to latency-based selection
    return this.selectByLatency(nodes);
  }

  private selectByRoundRobin(nodes: EdgeNode[]): EdgeNode {
    // Simple round-robin implementation
    const now = Date.now();
    const index = Math.floor(now / 1000) % nodes.length;
    return nodes[index];
  }

  private getDeduplicationKey(request: EdgeRequest): string {
    return `${request.method}:${request.path}:${JSON.stringify(request.body || {})}`;
  }

  private async executeAtEdge(edgeNode: EdgeNode, request: EdgeRequest): Promise<EdgeResponse> {
    const config = this.configService.get('edge');
    const timeout = request.timeout || config?.edge?.timeout || 5000;

    try {
      // Simulate edge execution - in production, this would make actual HTTP requests
      // to the edge node endpoints
      const response = await this.simulateEdgeExecution(edgeNode, request, timeout);
      
      return {
        statusCode: response.statusCode,
        headers: response.headers,
        body: response.body,
        edgeNode: edgeNode.id,
        latency: 0, // Will be updated by caller
        cached: response.cached || false,
        region: edgeNode.region,
      };
    } catch (error) {
      this.logger.error(`Edge execution failed at ${edgeNode.id}: ${error.message}`);
      throw error;
    }
  }

  private async simulateEdgeExecution(
    edgeNode: EdgeNode,
    request: EdgeRequest,
    timeout: number
  ): Promise<any> {
    // Simulate network latency based on edge node latency
    const simulatedLatency = edgeNode.latency + Math.random() * 10;
    await new Promise(resolve => setTimeout(resolve, simulatedLatency));

    // Simulate successful response
    return {
      statusCode: 200,
      headers: {
        'content-type': 'application/json',
        'x-edge-node': edgeNode.id,
        'x-edge-region': edgeNode.region,
        'x-edge-latency': `${simulatedLatency.toFixed(2)}ms`,
      },
      body: {
        success: true,
        edge: true,
        node: edgeNode.id,
        region: edgeNode.region,
        timestamp: new Date().toISOString(),
      },
      cached: false,
    };
  }

  private async fallbackToOrigin(request: EdgeRequest): Promise<EdgeResponse> {
    this.logger.debug('Falling back to origin server');
    
    // Simulate origin response
    return {
      statusCode: 200,
      headers: {
        'content-type': 'application/json',
        'x-edge-fallback': 'true',
      },
      body: {
        success: true,
        edge: false,
        origin: true,
        timestamp: new Date().toISOString(),
      },
      edgeNode: 'origin',
      latency: 0,
      cached: false,
      region: 'origin',
    };
  }

  private updateEdgeNodeMetrics(nodeId: string, latency: number): void {
    const node = this.edgeNodes.get(nodeId);
    if (node) {
      // Exponential moving average for latency
      node.latency = node.latency * 0.9 + latency * 0.1;
      node.lastHealthCheck = new Date();
    }
  }

  private logPerformance(request: EdgeRequest, response: EdgeResponse, latency: number): void {
    const config = this.configService.get('edge');
    const target = config?.performance?.targetResponseTime || 100;

    if (latency > target) {
      this.logger.warn(
        `Slow response: ${request.method} ${request.path} took ${latency.toFixed(2)}ms ` +
        `(target: ${target}ms) at edge node ${response.edgeNode}`
      );
    } else {
      this.logger.debug(
        `Fast response: ${request.method} ${request.path} took ${latency.toFixed(2)}ms ` +
        `at edge node ${response.edgeNode}`
      );
    }
  }

  async getEdgeNodeStatus(): Promise<EdgeNode[]> {
    return Array.from(this.edgeNodes.values());
  }

  async healthCheck(): Promise<{ healthy: boolean; nodes: EdgeNode[] }> {
    const nodes = await this.getEdgeNodeStatus();
    const healthyNodes = nodes.filter(node => node.healthy);
    
    return {
      healthy: healthyNodes.length > 0,
      nodes: healthyNodes,
    };
  }

  async updateEdgeNodeHealth(nodeId: string, healthy: boolean): Promise<void> {
    const node = this.edgeNodes.get(nodeId);
    if (node) {
      node.healthy = healthy;
      node.lastHealthCheck = new Date();
      this.logger.log(`Edge node ${nodeId} health updated to ${healthy}`);
    }
  }

  async getMetrics(): Promise<{
    totalNodes: number;
    healthyNodes: number;
    averageLatency: number;
    totalRequests: number;
  }> {
    const nodes = Array.from(this.edgeNodes.values());
    const healthyNodes = nodes.filter(node => node.healthy);
    const averageLatency = nodes.reduce((sum, node) => sum + node.latency, 0) / nodes.length;

    return {
      totalNodes: nodes.length,
      healthyNodes: healthyNodes.length,
      averageLatency: averageLatency || 0,
      totalRequests: this.requestQueue.size,
    };
  }
}
