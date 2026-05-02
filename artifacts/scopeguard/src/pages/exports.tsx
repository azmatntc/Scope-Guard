import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, BarChart3, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Exports() {
  const { toast } = useToast();
  const [crStatus, setCrStatus] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loadingCsv, setLoadingCsv] = useState(false);
  const [loadingFinancial, setLoadingFinancial] = useState(false);
  const [financialData, setFinancialData] = useState<any>(null);

  const downloadCsv = async () => {
    setLoadingCsv(true);
    try {
      const params = new URLSearchParams();
      if (crStatus !== "ALL") params.set("status", crStatus);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const r = await fetch(`${BASE}/api/exports/change-requests?${params}`, { credentials: "include" });
      if (!r.ok) throw new Error("Export failed");

      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `change_requests_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export downloaded!" });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    } finally {
      setLoadingCsv(false);
    }
  };

  const loadFinancial = async () => {
    setLoadingFinancial(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const r = await fetch(`${BASE}/api/exports/financial-summary?${params}`, { credentials: "include" });
      const d = await r.json();
      setFinancialData(d);
    } catch {
      toast({ title: "Failed to load summary", variant: "destructive" });
    } finally {
      setLoadingFinancial(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Exports</h1>
        <p className="text-muted-foreground text-sm mt-1">Download your data for accounting, reporting, and backups</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label className="text-xs">From date</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">To date</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Status filter</Label>
          <Select value={crStatus} onValueChange={setCrStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="SENT">Sent</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
              <SelectItem value="REVISED">Revised</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Change Orders CSV
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Export all change orders with project, client, hours, rate, total, status, and timestamps.
              Ready for QuickBooks, Excel, or any spreadsheet tool.
            </p>
            <Button onClick={downloadCsv} disabled={loadingCsv} className="w-full">
              {loadingCsv ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              {loadingCsv ? "Exporting…" : "Download CSV"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Financial Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Revenue breakdown by project from approved change orders. Shows total recovered per client and project.
            </p>
            <Button variant="outline" onClick={loadFinancial} disabled={loadingFinancial} className="w-full">
              {loadingFinancial ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <BarChart3 className="h-4 w-4 mr-2" />}
              {loadingFinancial ? "Loading…" : "Generate Summary"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {financialData && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Financial Summary</CardTitle>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Grand Total</p>
                <p className="text-xl font-bold text-green-600">{financialData.grandTotalFormatted}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              {financialData.approvedCount} approved change orders · Generated {new Date(financialData.generatedAt).toLocaleString()}
            </p>
            <div className="space-y-2">
              {financialData.byProject?.map((p: any) => (
                <div key={p.name} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.client} · {p.count} CO{p.count !== 1 ? "s" : ""}</p>
                  </div>
                  <p className="font-semibold text-green-600">${(p.totalCents / 100).toFixed(2)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
