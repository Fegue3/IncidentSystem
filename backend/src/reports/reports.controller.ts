// backend/src/reports/reports.controller.ts
import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AccessJwtGuard } from '../auth/guards/access-jwt.guard';
import { ReportsService } from './reports.service';
import { ReportsBreakdownQueryDto } from './dto/reports-breakdown.dto';
import { ReportsExportCsvQueryDto } from './dto/reports-export-csv.dto';
import { ReportsExportPdfQueryDto } from './dto/reports-export-pdf.dto';
import { ReportsKpisQueryDto } from './dto/reports-kpis.dto';
import { ReportsTimeseriesQueryDto } from './dto/reports-timeseries.dto';

function safePart(s: string) {
  return s
    .trim()
    .slice(0, 80)
    .replaceAll(/[\\/:*?"<>|]+/g, '-')
    .replaceAll(/\s+/g, '-')
    .toLowerCase();
}

function dateOnly(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

@Controller('reports')
@UseGuards(AccessJwtGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) { }

  @Get('kpis')
  kpis(@Query() q: ReportsKpisQueryDto, @Req() req: any) {
    return this.reports.getKpis(q as any, req.user);
  }

  @Get('breakdown')
  breakdown(@Query() q: ReportsBreakdownQueryDto, @Req() req: any) {
    return this.reports.getBreakdown(q as any, req.user);
  }

  @Get('timeseries')
  timeseries(@Query() q: ReportsTimeseriesQueryDto, @Req() req: any) {
    return this.reports.getTimeseries(q as any, req.user);
  }

  @Get('export.csv')
  async exportCsv(
    @Query() q: ReportsExportCsvQueryDto,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const csv = await this.reports.exportCsv(q as any, req.user);

    const from = dateOnly((q as any)?.from);
    const to = dateOnly((q as any)?.to);
    const name =
      from && to ? `relatorio-incidentes_${from}_a_${to}.csv` : 'relatorio-incidentes.csv';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.setHeader('Content-Length', Buffer.byteLength(csv, 'utf8'));

    return res.status(200).send(csv);
  }

  @Get('export.pdf')
  async exportPdf(
    @Query() q: ReportsExportPdfQueryDto,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const buf = await this.reports.exportPdf(q as any, req.user);

    const incidentId = (q as any)?.incidentId as string | undefined;
    const from = dateOnly((q as any)?.from);
    const to = dateOnly((q as any)?.to);

    const name = incidentId
      ? `incidente_${safePart(incidentId.slice(0, 12))}.pdf`
      : from && to
        ? `relatorio-incidentes_${from}_a_${to}.pdf`
        : 'relatorio-incidentes.pdf';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.setHeader('Content-Length', buf.length);

    return res.status(200).send(buf);
  }
}
