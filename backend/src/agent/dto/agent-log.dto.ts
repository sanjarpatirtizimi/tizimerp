import { IsString, IsOptional, IsIn, MaxLength } from 'class-validator';

export class AgentLogDto {
  @IsString()
  @MaxLength(2000)
  message: string;

  @IsOptional()
  @IsIn(['info', 'warn', 'error'])
  level?: string;

  /** Raw original log text from the relay agent */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  raw?: string;

  /** Agent code version */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  version?: string;
}

export class AgentHeartbeatDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  version?: string;

  @IsOptional()
  pendingCount?: number;

  @IsOptional()
  lastError?: string | null;
}
