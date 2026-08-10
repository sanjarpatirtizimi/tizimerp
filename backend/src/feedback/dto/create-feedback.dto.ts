import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateFeedbackDto {
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  body: string;
}
