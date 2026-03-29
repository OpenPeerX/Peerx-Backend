import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class DashboardLayoutDto {
  @IsIn([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  x: number;

  @IsIn([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  y: number;

  @IsIn([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  w: number;

  @IsIn([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  h: number;
}

class DashboardWidgetDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  title: string;

  @IsIn(['line', 'bar', 'area', 'candlestick', 'heatmap', 'scatter', 'kpi'])
  type: 'line' | 'bar' | 'area' | 'candlestick' | 'heatmap' | 'scatter' | 'kpi';

  @IsIn([
    'tradingPerformance',
    'marketTrends',
    'userBehavior',
    'systemMetrics',
    'predictiveAnalytics',
  ])
  dataSource: string;

  @IsObject()
  config: Record<string, unknown>;

  @ValidateNested()
  @Type(() => DashboardLayoutDto)
  layout: DashboardLayoutDto;
}

export class CreateDashboardDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(240)
  description?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => DashboardWidgetDto)
  widgets: DashboardWidgetDto[];

  @IsOptional()
  @IsObject()
  filters?: {
    from?: string;
    to?: string;
    assets?: string[];
  };
}

export class UpdateDashboardDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(240)
  description?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => DashboardWidgetDto)
  widgets?: DashboardWidgetDto[];

  @IsObject()
  @IsOptional()
  filters?: {
    from?: string;
    to?: string;
    assets?: string[];
  };
}

export class PredictiveAnalyticsQueryDto {
  @IsIn(['1h', '24h', '7d'])
  @IsOptional()
  horizon?: '1h' | '24h' | '7d';

  @IsString()
  @IsOptional()
  asset?: string;
}

export class CreateReportScheduleDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  cronExpression: string;

  @IsIn(['json', 'csv', 'xlsx'])
  format: 'json' | 'csv' | 'xlsx';

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  recipients: string[];
}

export class ExportAnalyticsQueryDto {
  @IsIn(['json', 'csv'])
  @IsOptional()
  format?: 'json' | 'csv';

  @IsIn(['snapshot', 'trading', 'userBehavior', 'marketTrends', 'systemPerformance'])
  @IsOptional()
  scope?: 'snapshot' | 'trading' | 'userBehavior' | 'marketTrends' | 'systemPerformance';

  @IsString()
  @IsOptional()
  userId?: string;
}

export class UpsertBiConnectorDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsIn(['powerbi', 'tableau', 'looker', 'custom-webhook'])
  type: 'powerbi' | 'tableau' | 'looker' | 'custom-webhook';

  @IsString()
  @IsNotEmpty()
  endpoint: string;

  @IsBoolean()
  enabled: boolean;
}
