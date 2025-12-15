import {
  Controller,
  Get,
  Header,
  Query,
  UseGuards,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { AccessJwtGuard } from '../auth/guards/access-jwt.guard';
import { ReportsService } from './reports.service';
import { ReportsKpisQueryDto } from './dto/reports-kpis.dto';
import { ReportsBreakdownQueryDto } from './dto/reports-breakdown.dto';
import { ReportsTimeseriesQueryDto } from './dto/reports-timeseries.dto';
import { ReportsExportCsvQueryDto } from './dto/reports-export-csv.dto';
import { ReportsExportPdfQueryDto } from './dto/reports-export-pdf.dto';

@UseGuards(AccessJwtGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('kpis')
  kpis(@Query() query: ReportsKpisQueryDto) {
    return this.reportsService.getKpis(query);
  }

  @Get('breakdown')
  breakdown(@Query() query: ReportsBreakdownQueryDto) {
    return this.reportsService.getBreakdown(query as any);
  }

  @Get('timeseries')
  timeseries(@Query() query: ReportsTimeseriesQueryDto) {
    return this.reportsService.getTimeseries(query as any);
  }

  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="incident-reports.csv"')
  exportCsv(@Query() query: ReportsExportCsvQueryDto) {
    return this.reportsService.exportCsv(query as any);
  }

  @Get('export.pdf')
  async exportPdf(
    @Query() query: ReportsExportPdfQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const fileName = query.incidentId
      ? `incident-${query.incidentId}.pdf`
      : 'incident-reports.pdf';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    const buf = await this.reportsService.exportPdf(query as any);
    return new StreamableFile(buf);
  }
}