import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateWithdrawalDto {
  @IsString()
  @Matches(/^\d{1,8}(\.\d{1,2})?$/, { message: 'Amount must be a number with up to 2 decimal places' })
  amount: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  method: string;

  @IsString()
  @IsNotEmpty({ message: 'Payment details are required' })
  @MaxLength(500)
  paymentDetails: string;
}

export const WITHDRAWAL_STATUSES = ['PENDING', 'PROCESSING', 'APPROVED', 'REJECTED', 'PAID'] as const;

export class UpdateWithdrawalDto {
  @IsIn(WITHDRAWAL_STATUSES as unknown as string[])
  status: (typeof WITHDRAWAL_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNote?: string;
}
