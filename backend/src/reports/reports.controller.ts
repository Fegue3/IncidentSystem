// src/reports/reports.controller.ts

import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AccessJwtGuard } from '../auth/guards/access-jwt.guard';
import { ReportsService } from './reports.service';
import { ReportsBreakdownQueryDto } from './dto/reports-breakdown.dto';
import { ReportsExportCsvQueryDto } from './dto/reports-export-csv.dto';
import { ReportsExportPdfQueryDto } from './dto/reports-export-pdf.dto';
import { ReportsKpisQueryDto } from './dto/reports-kpis.dto';
import { ReportsTimeseriesQueryDto } from './dto/reports-timeseries.dto';

/**
 * Sanitiza uma string para uso em nomes de ficheiro:
 * - remove/normaliza caracteres proibidos em sistemas de ficheiros
 * - limita tamanho
 * - normaliza espaços para hífens
 *
 * @param s Input string (ex.: incidentId)
 */
function safePart(s: string) {
  return s
    .trim()
    .slice(0, 80)
    .replaceAll(/[\\/:*?"<>|]+/g, '-')
    .replaceAll(/\\s+/g, '-')
    .toLowerCase();
}

/**
 * Extrai YYYY-MM-DD de um ISO string válido.
 *
 * @param iso string ISO
 * @returns string "YYYY-MM-DD" ou '' se inválido/ausente
 */
function dateOnly(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/**
 * @file src/reports/reports.controller.ts
 * @module Backend.Reports.Controller
 *
 * @summary
 * Controller HTTP para relatórios e exportações.
 *
 * @description
 * Endpoints:
 * - GET /reports/kpis
 * - GET /reports/breakdown
 * - GET /reports/timeseries
 * - GET /reports/export.csv
 * - GET /reports/export.pdf
 *
 * Todos os endpoints requerem autenticação via AccessJwtGuard.
 *
 * O controller também é responsável por:
 * - definir headers de download (Content-Disposition)
 * - gerar nomes de ficheiro consistentes e seguros
 */
@Controller('reports')
@UseGuards(AccessJwtGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /**
   * KPIs agregados (ex.: contagens, tempos médios, etc.)
   */
  @Get('kpis')
  kpis(@Query() q: ReportsKpisQueryDto, @Req() req: any) {
    return this.reports.getKpis(q as any, req.user);
  }

  /**
   * Breakdown (agregação por dimensão: status, severity, team, etc.)
   */
  @Get('breakdown')
  breakdown(@Query() q: ReportsBreakdownQueryDto, @Req() req: any) {
    return this.reports.getBreakdown(q as any, req.user);
  }

  /**
   * Série temporal agregada por dia/semana.
   */
  @Get('timeseries')
  timeseries(@Query() q: ReportsTimeseriesQueryDto, @Req() req: any) {
    return this.reports.getTimeseries(q as any, req.user);
  }

  /**
   * Export CSV.
   *
   * @remarks
   * - O controller devolve como `attachment` e define Content-Length.
   * - O nome do ficheiro tenta refletir o intervalo (from/to), se existir.
   */
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
      from && to
        ? `relatorio-incidentes_${from}_a_${to}.csv`
        : 'relatorio-incidentes.csv';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.setHeader('Content-Length', Buffer.byteLength(csv, 'utf8'));

    return res.status(200).send(csv);
  }

  /**
   * Export PDF.
   *
   * @remarks
   * - Suporta naming por `incidentId` (quando fornecido) ou por intervalo (from/to).
   * - Resposta é enviada como `application/pdf` e `attachment`.
   */
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
