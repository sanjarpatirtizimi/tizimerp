import { IsNumber, IsString, Max, Min, MinLength } from 'class-validator';

/**
 * Mistake-proof end-of-shift handoff:
 * - toOperatorId: who receives the remaining cash
 * - confirmAmount: MUST equal current balance exactly (server re-checks under lock)
 */
export class EndShiftDto {
  @IsString()
  @MinLength(1)
  toOperatorId!: string;

  @IsNumber()
  @Min(0.01)
  @Max(999_999_999_999)
  confirmAmount!: number;
}
