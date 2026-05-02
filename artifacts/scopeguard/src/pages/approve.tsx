import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { getGetApprovalRequestQueryOptions, useSubmitApproval } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, CheckCircle, XCircle, RefreshCw, Clock, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Approve() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [comments, setComments] = useState("");
  const [submitted, setSubmitted] = useState<{ status: string; message: string } | null>(null);

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

  const handleDecision = (decision: "approve" | "reject" | "revise") => {
    submit({ token, data: { decision, comments } });
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
    const icon = submitted.status === "approved"
      ? <CheckCircle className="h-14 w-14 text-green-500 mx-auto" />
      : submitted.status === "rejected"
      ? <XCircle className="h-14 w-14 text-red-500 mx-auto" />
      : <RefreshCw className="h-14 w-14 text-amber-500 mx-auto" />;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          {icon}
          <h2 className="text-xl font-semibold">
            {submitted.status === "approved" ? "All set!" : submitted.status === "rejected" ? "Response recorded" : "Revision requested"}
          </h2>
          <p className="text-muted-foreground">{submitted.message}</p>
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
              disabled={isPending}
            >
              <CheckCircle className="h-4 w-4 mr-1.5" />
              {isPending ? "Submitting…" : "Approve"}
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground pb-6">
            Powered by{" "}
            <span className="font-medium">ScopeGuard</span> · Your response is recorded and timestamped
          </p>
        </div>
      </main>
    </div>
  );
}
