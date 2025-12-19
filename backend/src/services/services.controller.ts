// src/services/services.controller.ts
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ServicesService } from './services.service';
import { ListServicesDto } from './dto/list-services.dto';

/**
 * Controller HTTP do módulo Services.
 *
 * Rotas:
 * - GET /services?isActive=true&q=auth  -> lista serviços com filtros opcionais
 * - GET /services/id/:id               -> obtém serviço por id
 * - GET /services/key/:key             -> obtém serviço por key
 */
@Controller('services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  /**
   * Lista serviços com filtros opcionais.
   *
   * @param query ListServicesDto (querystring)
   * @returns lista de serviços ordenada por name asc
   */
  @Get()
  list(@Query() query: ListServicesDto) {
    return this.services.list(query);
  }

  /**
   * Obtém um serviço por ID.
   *
   * @param id Service.id
   */
  @Get('id/:id')
  getById(@Param('id') id: string) {
    return this.services.getById(id);
  }

  /**
   * Obtém um serviço por key.
   *
   * @param key Service.key
   */
  @Get('key/:key')
  getByKey(@Param('key') key: string) {
    return this.services.getByKey(key);
  }
}
