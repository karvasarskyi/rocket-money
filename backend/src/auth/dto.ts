import { IsOptional, IsString, MaxLength } from 'class-validator';

export class InitAuthDto {
  @IsOptional()
  @IsString()
  @MaxLength(8192)
  initData?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  startParam?: string;
}
