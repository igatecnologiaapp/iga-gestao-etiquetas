import { describe, it, expect } from "vitest";
import {
  aggregateByDimension, aggregateByEnum, aggregateByPeriod,
  bucketKey, buildDashboardCsv, computeMetrics,
} from "./print-analytics";
import type { HistoryRow } from "./print-history-service";

const r = (over: Partial<HistoryRow> = {}): HistoryRow => ({
  id: "j-" + Math.random(),
  company_id: "c1", branch_id: null, user_id: "u1",
  printer_id: "p1", layout_id: "l1", product_id: "pr1", batch_id: null,
  quantity: 2, status: "completed", source: "print_agent",
  payload: {}, agent_job_id: null, error_message: null, attempts: 0,
  started_at: "2026-01-01T10:00:00Z", finished_at: "2026-01-01T10:00:01Z",
  created_at: "2026-01-01T10:00:00Z", updated_at: "2026-01-01T10:00:01Z",
  printer_name: "Zebra", layout_name: "10x10", product_name: "Picanha",
  product_code: "P1", user_name: "Operador", user_email: "op@x.com",
  is_reprint: false, reprint_of: null, duration_ms: 1000,
  ...over,
});

describe("computeMetrics", () => {
  it("counts all metrics correctly", () => {
    const rows = [
      r({ status: "completed", quantity: 5 }),
      r({ status: "failed", quantity: 3 }),
      r({ status: "canceled", quantity: 2 }),
      r({ status: "completed", source: "pdf_fallback", quantity: 1 }),
      r({ status: "completed", is_reprint: true, quantity: 4 }),
    ];
    const m = computeMetrics(rows);
    expect(m.totalJobs).toBe(5);
    expect(m.totalLabels).toBe(15);
    expect(m.completed).toBe(3);
    expect(m.failed).toBe(1);
    expect(m.canceled).toBe(1);
    expect(m.reprints).toBe(1);
    expect(m.fallback).toBe(1);
    expect(m.successRate).toBeCloseTo(3 / 5);
    expect(m.errorRate).toBeCloseTo(2 / 5);
    expect(m.avgDurationMs).toBe(1000);
  });
  it("handles empty rows", () => {
    const m = computeMetrics([]);
    expect(m.totalJobs).toBe(0);
    expect(m.successRate).toBe(0);
    expect(m.avgDurationMs).toBeNull();
  });
});

describe("bucketKey", () => {
  const iso = "2026-03-04T12:00:00Z"; // a Wednesday in ISO week 10 of 2026
  it("buckets by day/month/year", () => {
    expect(bucketKey(iso, "day")).toBe("2026-03-04");
    expect(bucketKey(iso, "month")).toBe("2026-03");
    expect(bucketKey(iso, "year")).toBe("2026");
  });
  it("buckets by ISO week", () => {
    const w = bucketKey(iso, "week");
    expect(w).toMatch(/^2026-W\d{2}$/);
  });
});

describe("aggregateByPeriod", () => {
  it("groups by day in ascending order", () => {
    const rows = [
      r({ created_at: "2026-01-02T10:00:00Z", quantity: 1 }),
      r({ created_at: "2026-01-01T10:00:00Z", quantity: 2 }),
      r({ created_at: "2026-01-01T22:00:00Z", quantity: 3, status: "failed" }),
    ];
    const out = aggregateByPeriod(rows, "day");
    expect(out).toEqual([
      { bucket: "2026-01-01", jobs: 2, labels: 5, failed: 1 },
      { bucket: "2026-01-02", jobs: 1, labels: 1, failed: 0 },
    ]);
  });
});

describe("aggregateByDimension", () => {
  it("groups by printer and sorts by jobs desc", () => {
    const rows = [
      r({ printer_id: "A", printer_name: "A", quantity: 1 }),
      r({ printer_id: "A", printer_name: "A", status: "failed", quantity: 2 }),
      r({ printer_id: "B", printer_name: "B", quantity: 5 }),
    ];
    const out = aggregateByDimension(rows, "printer");
    expect(out[0]).toEqual({ key: "A", label: "A", jobs: 2, labels: 3, failed: 1 });
    expect(out[1].key).toBe("B");
  });
  it("limits to topN", () => {
    const rows = Array.from({ length: 15 }, (_, i) =>
      r({ printer_id: `P${i}`, printer_name: `P${i}` }),
    );
    expect(aggregateByDimension(rows, "printer", 5)).toHaveLength(5);
  });
  it("supports user/layout/product", () => {
    const rows = [r({ user_id: "U", user_name: "U" }), r({ layout_id: "L", layout_name: "L" })];
    expect(aggregateByDimension(rows, "user")[0].label).toBe("U");
    expect(aggregateByDimension(rows, "layout")[0].label).toBe("L");
  });
});

describe("aggregateByEnum", () => {
  it("counts by status with pt-BR label", () => {
    const out = aggregateByEnum(
      [r({ status: "failed" }), r({ status: "failed" }), r({ status: "completed" })],
      "status",
    );
    const failed = out.find((x) => x.key === "failed")!;
    expect(failed.jobs).toBe(2);
    expect(failed.label).toBe("Falhou");
  });
  it("counts by source", () => {
    const out = aggregateByEnum(
      [r({ source: "pdf_fallback" }), r({ source: "print_agent" })],
      "source",
    );
    expect(out.find((x) => x.key === "pdf_fallback")!.label).toBe("PDF (fallback)");
  });
});

describe("buildDashboardCsv", () => {
  it("contains header + indicators + period rows", () => {
    const m = computeMetrics([r(), r({ status: "failed" })]);
    const csv = buildDashboardCsv(m, [{ bucket: "2026-01-01", jobs: 2, labels: 4, failed: 1 }]);
    expect(csv[0]).toEqual(["indicador", "valor"]);
    expect(csv.some((row) => row[0] === "taxa_sucesso")).toBe(true);
    expect(csv[csv.length - 1]).toEqual(["2026-01-01", "2", "4", "1"]);
  });
});
