import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PaginacionQueryDto {
  @ApiPropertyOptional({ example: 20, default: 20, description: 'Número de registros a retornar' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ example: 0, default: 0, description: 'Desplazamiento / offset' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;

  @ApiPropertyOptional({ example: 'KALLPA', description: 'Búsqueda por término' })
  @IsOptional()
  @IsString()
  busqueda?: string;
}
