import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AgentClient } from '../agent/agent.client';

export class PredictionDto {
  @Type(() => Number) @IsInt() @Min(1950) @Max(2100) year: number;
  @IsString() @MinLength(2) @MaxLength(64) circuit: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(99) driver_number: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(30) grid: number;
  @IsString() @MinLength(2) @MaxLength(64) constructor_name: string;
}

/**
 * Datos de F1 y predicciones para el frontend. No usa el LLM: lee del
 * agent-service, que es el dueño de los datos de Ergast y del modelo.
 */
@Controller('f1')
export class F1Controller {
  constructor(private readonly agent: AgentClient) {}

  @Get('stats')
  stats() {
    return this.agent.request('GET', '/v1/stats');
  }

  @Get('seasons')
  seasons() {
    return this.agent.request('GET', '/v1/seasons');
  }

  @Get('seasons/:year/races')
  races(@Param('year', ParseIntPipe) year: number) {
    return this.agent.request('GET', `/v1/seasons/${year}/races`);
  }

  @Get('seasons/:year/standings')
  standings(@Param('year', ParseIntPipe) year: number, @Query('limit') limit?: string) {
    return this.agent.request('GET', `/v1/seasons/${year}/standings`, { query: { limit } });
  }

  @Get('races/:year/results')
  results(@Param('year', ParseIntPipe) year: number, @Query('circuit') circuit?: string) {
    return this.agent.request('GET', `/v1/races/${year}/results`, { query: { circuit } });
  }

  @Get('predictions/options')
  predictionOptions() {
    return this.agent.request('GET', '/v1/predictions/options');
  }

  @Post('predictions')
  predict(@Body() dto: PredictionDto) {
    const { constructor_name, ...rest } = dto;
    return this.agent.request('POST', '/v1/predictions', { body: { ...rest, constructor: constructor_name } });
  }
}
