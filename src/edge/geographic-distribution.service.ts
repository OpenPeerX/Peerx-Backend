import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface Region {
  id: string;
  name: string;
  endpoint: string;
  location: {
    latitude: number;
    longitude: number;
    country: string;
    continent: string;
  };
  healthy: boolean;
  latency: number;
  load: number;
  capacity: number;
  lastHealthCheck: Date;
}

export interface RoutingDecision {
  region: string;
  reason: string;
  latency: number;
  alternatives: string[];
}

@Injectable()
export class GeographicDistributionService {
  private readonly logger = new Logger(GeographicDistributionService.name);
  private regions: Map<string, Region> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(private readonly configService: ConfigService) {
    this.initializeRegions();
    this.startHealthChecks();
  }

  private initializeRegions(): void {
    const config = this.configService.get('edge');
    if (!config?.geographic?.enabled) {
      this.logger.warn('Geographic distribution is disabled');
      return;
    }

    // Define global regions
    const regionDefinitions: Omit<Region, 'healthy' | 'latency' | 'load' | 'lastHealthCheck'>[] = [
      {
        id: 'us-east',
        name: 'US East (N. Virginia)',
        endpoint: 'https://api-us-east.swaptrade.io',
        location: {
          latitude: 39.0438,
          longitude: -77.4874,
          country: 'US',
          continent: 'North America',
        },
        capacity: 100,
      },
      {
        id: 'us-west',
        name: 'US West (Oregon)',
        endpoint: 'https://api-us-west.swaptrade.io',
        location: {
          latitude: 45.5231,
          longitude: -122.6765,
          country: 'US',
          continent: 'North America',
        },
        capacity: 100,
      },
      {
        id: 'eu-west',
        name: 'EU West (Ireland)',
        endpoint: 'https://api-eu-west.swaptrade.io',
        location: {
          latitude: 53.3498,
          longitude: -6.2603,
          country: 'IE',
          continent: 'Europe',
        },
        capacity: 100,
      },
      {
        id: 'eu-central',
        name: 'EU Central (Frankfurt)',
        endpoint: 'https://api-eu-central.swaptrade.io',
        location: {
          latitude: 50.1109,
          longitude: 8.6821,
          country: 'DE',
          continent: 'Europe',
        },
        capacity: 100,
      },
      {
        id: 'ap-southeast',
        name: 'Asia Pacific (Singapore)',
        endpoint: 'https://api-ap-southeast.swaptrade.io',
        location: {
          latitude: 1.3521,
          longitude: 103.8198,
          country: 'SG',
          continent: 'Asia',
        },
        capacity: 100,
      },
      {
        id: 'ap-northeast',
        name: 'Asia Pacific (Tokyo)',
        endpoint: 'https://api-ap-northeast.swaptrade.io',
        location: {
          latitude: 35.6762,
          longitude: 139.6503,
          country: 'JP',
          continent: 'Asia',
        },
        capacity: 100,
      },
      {
        id: 'sa-east',
        name: 'South America (São Paulo)',
        endpoint: 'https://api-sa-east.swaptrade.io',
        location: {
          latitude: -23.5505,
          longitude: -46.6333,
          country: 'BR',
          continent: 'South America',
        },
        capacity: 100,
      },
      {
        id: 'af-south',
        name: 'Africa (Cape Town)',
        endpoint: 'https://api-af-south.swaptrade.io',
        location: {
          latitude: -33.9249,
          longitude: 18.4241,
          country: 'ZA',
          continent: 'Africa',
        },
        capacity: 100,
      },
    ];

    regionDefinitions.forEach(regionDef => {
      this.regions.set(regionDef.id, {
        ...regionDef,
        healthy: true,
        latency: 0,
        load: 0,
        lastHealthCheck: new Date(),
      });
    });

    this.logger.log(`Initialized ${this.regions.size} geographic regions`);
  }

  private startHealthChecks(): void {
    const config = this.configService.get('edge');
    if (!config?.geographic?.healthCheck?.enabled) {
      return;
    }

    const interval = config.geographic.healthCheck.interval || 30000;
    
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, interval);

    // Perform initial health check
    this.performHealthChecks();
  }

  private async performHealthChecks(): Promise<void> {
    const config = this.configService.get('edge');
    const timeout = config?.geographic?.healthCheck?.timeout || 5000;

    const healthCheckPromises = Array.from(this.regions.values()).map(async region => {
      try {
        const startTime = Date.now();
        
        // Simulate health check - in production, this would make actual HTTP requests
        await this.simulateHealthCheck(region.endpoint, timeout);
        
        const latency = Date.now() - startTime;
        
        region.healthy = true;
        region.latency = latency;
        region.lastHealthCheck = new Date();
        
        this.logger.debug(`Health check passed for ${region.id}: ${latency}ms`);
      } catch (error) {
        region.healthy = false;
        region.lastHealthCheck = new Date();
        
        this.logger.warn(`Health check failed for ${region.id}: ${error.message}`);
      }
    });

    await Promise.allSettled(healthCheckPromises);
  }

  private async simulateHealthCheck(endpoint: string, timeout: number): Promise<void> {
    // Simulate network latency
    const latency = Math.random() * 100;
    await new Promise(resolve => setTimeout(resolve, latency));
    
    // Simulate occasional failures
    if (Math.random() < 0.05) {
      throw new Error('Health check timeout');
    }
  }

  async selectRegion(clientInfo: {
    latitude?: number;
    longitude?: number;
    country?: string;
    continent?: string;
  }): Promise<RoutingDecision> {
    const config = this.configService.get('edge');
    const strategy = config?.geographic?.routingStrategy || 'latency';

    const healthyRegions = Array.from(this.regions.values()).filter(r => r.healthy);
    
    if (healthyRegions.length === 0) {
      return {
        region: config?.geographic?.defaultRegion || 'us-east',
        reason: 'no_healthy_regions',
        latency: 0,
        alternatives: [],
      };
    }

    let selectedRegion: Region;
    let reason: string;

    switch (strategy) {
      case 'geo':
        selectedRegion = this.selectByGeoLocation(healthyRegions, clientInfo);
        reason = 'geographic_proximity';
        break;
      case 'latency':
        selectedRegion = this.selectByLatency(healthyRegions);
        reason = 'lowest_latency';
        break;
      case 'round-robin':
        selectedRegion = this.selectByRoundRobin(healthyRegions);
        reason = 'round_robin';
        break;
      case 'load':
        selectedRegion = this.selectByLoad(healthyRegions);
        reason = 'lowest_load';
        break;
      default:
        selectedRegion = this.selectByLatency(healthyRegions);
        reason = 'lowest_latency';
    }

    const alternatives = healthyRegions
      .filter(r => r.id !== selectedRegion.id)
      .sort((a, b) => a.latency - b.latency)
      .slice(0, 3)
      .map(r => r.id);

    return {
      region: selectedRegion.id,
      reason,
      latency: selectedRegion.latency,
      alternatives,
    };
  }

  private selectByGeoLocation(regions: Region[], clientInfo: any): Region {
    if (!clientInfo.latitude || !clientInfo.longitude) {
      return this.selectByLatency(regions);
    }

    // Calculate distances to each region
    const regionsWithDistance = regions.map(region => {
      const distance = this.calculateDistance(
        clientInfo.latitude,
        clientInfo.longitude,
        region.location.latitude,
        region.location.longitude
      );
      return { region, distance };
    });

    // Sort by distance and return closest
    regionsWithDistance.sort((a, b) => a.distance - b.distance);
    return regionsWithDistance[0].region;
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    // Haversine formula for calculating distance between two points on Earth
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private selectByLatency(regions: Region[]): Region {
    return regions.reduce((fastest, current) =>
      current.latency < fastest.latency ? current : fastest
    );
  }

  private selectByRoundRobin(regions: Region[]): Region {
    const now = Date.now();
    const index = Math.floor(now / 1000) % regions.length;
    return regions[index];
  }

  private selectByLoad(regions: Region[]): Region {
    return regions.reduce((leastLoaded, current) =>
      current.load < leastLoaded.load ? current : leastLoaded
    );
  }

  async getRegion(regionId: string): Promise<Region | null> {
    return this.regions.get(regionId) || null;
  }

  async getAllRegions(): Promise<Region[]> {
    return Array.from(this.regions.values());
  }

  async getHealthyRegions(): Promise<Region[]> {
    return Array.from(this.regions.values()).filter(r => r.healthy);
  }

  async updateRegionLoad(regionId: string, load: number): Promise<void> {
    const region = this.regions.get(regionId);
    if (region) {
      region.load = Math.min(load, region.capacity);
      this.logger.debug(`Updated load for ${regionId}: ${region.load}/${region.capacity}`);
    }
  }

  async getRegionStats(): Promise<{
    totalRegions: number;
    healthyRegions: number;
    averageLatency: number;
    totalCapacity: number;
    totalLoad: number;
    regionDistribution: Record<string, { healthy: boolean; latency: number; load: number }>;
  }> {
    const regions = Array.from(this.regions.values());
    const healthyRegions = regions.filter(r => r.healthy);
    const averageLatency = healthyRegions.length > 0
      ? healthyRegions.reduce((sum, r) => sum + r.latency, 0) / healthyRegions.length
      : 0;
    const totalCapacity = regions.reduce((sum, r) => sum + r.capacity, 0);
    const totalLoad = regions.reduce((sum, r) => sum + r.load, 0);

    const regionDistribution: Record<string, { healthy: boolean; latency: number; load: number }> = {};
    regions.forEach(region => {
      regionDistribution[region.id] = {
        healthy: region.healthy,
        latency: region.latency,
        load: region.load,
      };
    });

    return {
      totalRegions: regions.length,
      healthyRegions: healthyRegions.length,
      averageLatency,
      totalCapacity,
      totalLoad,
      regionDistribution,
    };
  }

  async setRegionHealth(regionId: string, healthy: boolean): Promise<void> {
    const region = this.regions.get(regionId);
    if (region) {
      region.healthy = healthy;
      region.lastHealthCheck = new Date();
      this.logger.log(`Set health for ${regionId}: ${healthy}`);
    }
  }

  async getOptimalEndpoint(clientInfo: any): Promise<string> {
    const decision = await this.selectRegion(clientInfo);
    const region = this.regions.get(decision.region);
    return region?.endpoint || this.configService.get('edge')?.geographic?.defaultRegion || 'us-east';
  }

  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}
