import { IsNotEmpty, IsObject, IsString, MaxLength } from 'class-validator';

export class AdminLoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  username: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}

export class UpdateSettingsDto {
  @IsObject()
  settings: Record<string, string>;
}
