import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateTelegramDto {
  /** @username or phone text. Empty/null clears the field. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  telegramUsername?: string | null;
}
