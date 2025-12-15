import { render, screen } from "@testing-library/react";
import { ReportsPage } from "./ReportsPage";

function getMockFn() {
  const anyGlobal = globalThis as any;
  return (anyGlobal.jest && anyGlobal.jest.fn) || (anyGlobal.vi && anyGlobal.vi.fn) || ((f: any) => f);
}

function mockFetch() {
  const fn = getMockFn();

  const okJson = (body: any) =>
    Promise.resolve({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => body,
      text: async () => JSON.stringify(body),
      blob: async () => new Blob([JSON.stringify(body)], { type: "application/json" }),
    } as any);

  (globalThis as any).fetch = fn((url: string) => {
    if (url.includes("/reports/kpis")) {
      return okJson({
        openCount: 1,
        resolvedCount: 2,
        closedCount: 3,
        mttrSeconds: { avg: 1200, median: 900, p90: 3600 },
        slaCompliancePct: 87.5,
      });
    }
    if (url.includes("/reports/breakdown")) {
      return okJson([{ key: "SEV1", label: "SEV1", count: 2 }]);
    }
    if (url.includes("/reports/timeseries")) {
      return okJson([{ date: new Date().toISOString(), count: 1 }]);
    }
    if (url.includes("/teams")) return okJson([]);
    if (url.includes("/services")) return okJson([]);
    return okJson({});
  });
}

describe("ReportsPage", () => {
  it("mostra o título", () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({ user: { id: "u1", email: "a@a.com" }, accessToken: "t", refreshToken: "r" }),
    );

    mockFetch();
    render(<ReportsPage />);
    expect(screen.getByText(/relatórios e métricas/i)).toBeInTheDocument();
  });
});