import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { getGetApprovalRequestQueryOptions, useSubmitApproval } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, CheckCircle, XCircle, RefreshCw, Clock, AlertCircle, PenLine, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Approve() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [comments, setComments] = useState("");
  const [signedName, setSignedName] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [submitted, setSubmitted] = useState<{ status: string; message: string } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  const { data: cr, isLoading, isError } = useQuery({
    ...getGetApprovalRequestQueryOptions(token),
    retry: false,
  });

  const { mutate: submit, isPending } = useSubmitApproval({
    mutation: {
      onSuccess: (data: any) => setSubmitted(data),
      onError: () => setSubmitted({ status: "error", message: "Something went wrong. Please try again." }),
    },
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const touch = e.touches[0];
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    lastPoint.current = getPos(e, canvas);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx || !lastPoint.current) return;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPoint.current = pos;
  };

  const endDraw = () => {
    setIsDrawing(false);
    lastPoint.current = null;
    const canvas = canvasRef.current;
    if (canvas) setSignatureData(canvas.toDataURL());
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setSignatureData(null);
  };

  const handleDecision = (decision: "approve" | "reject" | "revise") => {
    submit({
      token,
      data: {
        decision,
        comments,
        ...(decision === "approve" && signatureData ? { clientSignature: signatureData } : {}),
        ...(decision === "approve" && signedName ? { clientSignedName: signedName } : {}),
      } as any,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-xl space-y-4">
          <Skeleton className="h-12 w-48 mx-auto" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError || !cr) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold">Link Not Found</h2>
          <p className="text-muted-foreground max-w-sm">
            This approval link is invalid or has already been used. Contact your project manager for a new link.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    const isApproved = submitted.status === "approved";
    const isRejected = submitted.status === "rejected";
    const icon = isApproved
      ? <CheckCircle className="h-14 w-14 text-green-500 mx-auto" />
      : isRejected
      ? <XCircle className="h-14 w-14 text-red-500 mx-auto" />
      : <RefreshCw className="h-14 w-14 text-amber-500 mx-auto" />;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          {icon}
          <h2 className="text-xl font-semibold">
            {isApproved ? "All set!" : isRejected ? "Response recorded" : "Revision requested"}
          </h2>
          <p className="text-muted-foreground">{submitted.message}</p>
          {isApproved && signedName && (
            <p className="text-xs text-muted-foreground border rounded-md px-3 py-2 bg-muted/30">
              Electronically signed by <strong>{signedName}</strong> on {new Date().toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    );
  }

  const primaryColor = cr.primaryColor || "#2563eb";

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <header className="border-b bg-card px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
          <Shield className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-medium">{cr.organizationName}</p>
          <p className="text-xs text-muted-foreground">Change Order Approval</p>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center p-6 pt-10">
        <div className="w-full max-w-xl space-y-4">
          <div className="text-center space-y-1 mb-6">
            <div className="inline-flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-3 py-1 mb-3">
              <Clock className="h-3 w-3" />
              Awaiting your approval
            </div>
            <h1 className="text-2xl font-bold">{cr.title}</h1>
            <p className="text-muted-foreground text-sm">{cr.projectName}</p>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Scope of Work</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{cr.description}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Cost</p>
                  {cr.deadline && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Deadline: {new Date(cr.deadline).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold tabular-nums" style={{ color: primaryColor }}>
                    {cr.totalFormatted}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Comments (optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Add any notes or questions for the project manager…"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={3}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <PenLine className="h-4 w-4" />
                Electronic Signature
                <span className="text-xs font-normal text-muted-foreground ml-1">(required to approve)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Full name</Label>
                <Input
                  placeholder="Type your full name"
                  value={signedName}
                  onChange={(e) => setSignedName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Draw your signature</Label>
                  <button className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1" onClick={clearSignature}>
                    <Trash2 className="h-3 w-3" />Clear
                  </button>
                </div>
                <div className="border rounded-lg overflow-hidden bg-white touch-none">
                  <canvas
                    ref={canvasRef}
                    width={560}
                    height={120}
                    className="w-full h-28 cursor-crosshair"
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={endDraw}
                    onMouseLeave={endDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={endDraw}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Draw in the box above. Your signature will be stored with this approval.</p>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-3 pt-2">
            <Button
              variant="outline"
              className="border-amber-300 text-amber-700 hover:bg-amber-50"
              onClick={() => handleDecision("revise")}
              disabled={isPending}
            >
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Request Revision
            </Button>
            <Button
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-50"
              onClick={() => handleDecision("reject")}
              disabled={isPending}
            >
              <XCircle className="h-4 w-4 mr-1.5" />
              Reject
            </Button>
            <Button
              className="text-white"
              style={{ backgroundColor: primaryColor }}
              onClick={() => handleDecision("approve")}
              disabled={isPending || !signedName.trim()}
              title={!signedName.trim() ? "Please enter your name to approve" : ""}
            >
              <CheckCircle className="h-4 w-4 mr-1.5" />
              {isPending ? "Submitting…" : "Approve"}
            </Button>
          </div>
          {!signedName.trim() && (
            <p className="text-center text-xs text-amber-600">Enter your name above to enable the Approve button</p>
          )}

          <p className="text-center text-xs text-muted-foreground pb-6">
            Powered by <span className="font-medium">ScopeGuard</span> · Your response is recorded, timestamped, and legally binding
          </p>
        </div>
      </main>
    </div>
  );
}
