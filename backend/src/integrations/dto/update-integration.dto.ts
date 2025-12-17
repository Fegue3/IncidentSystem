import { IsBoolean } from 'class-validator';

export class UpdateIntegrationDto {
    @IsBoolean()
    notificationsEnabled!: boolean;
}
