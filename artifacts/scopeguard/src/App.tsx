import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import AppLayout from "@/components/app-layout";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import Projects from "@/pages/projects";
import ProjectDetail from "@/pages/project-detail";
import ChangeRequests from "@/pages/change-requests";
import Contacts from "@/pages/contacts";
import Approve from "@/pages/approve";
import Analytics from "@/pages/analytics";
import Team from "@/pages/team";
import Webhooks from "@/pages/webhooks";
import AuditLog from "@/pages/audit-log";
import Reminders from "@/pages/reminders";
import Exports from "@/pages/exports";
import Search from "@/pages/search";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  return <AppLayout>{children}</AppLayout>;
}

function Router() {
  return (
    <Switch>
      <Route path="/">
        <Redirect to="/dashboard" />
      </Route>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/approve/:token" component={Approve} />

      <Route path="/dashboard">
        <ProtectedLayout><Dashboard /></ProtectedLayout>
      </Route>
      <Route path="/projects/:id">
        {(params) => (
          <ProtectedLayout><ProjectDetail /></ProtectedLayout>
        )}
      </Route>
      <Route path="/projects">
        <ProtectedLayout><Projects /></ProtectedLayout>
      </Route>
      <Route path="/change-requests">
        <ProtectedLayout><ChangeRequests /></ProtectedLayout>
      </Route>
      <Route path="/contacts">
        <ProtectedLayout><Contacts /></ProtectedLayout>
      </Route>
      <Route path="/analytics">
        <ProtectedLayout><Analytics /></ProtectedLayout>
      </Route>
      <Route path="/team">
        <ProtectedLayout><Team /></ProtectedLayout>
      </Route>
      <Route path="/webhooks">
        <ProtectedLayout><Webhooks /></ProtectedLayout>
      </Route>
      <Route path="/audit-log">
        <ProtectedLayout><AuditLog /></ProtectedLayout>
      </Route>
      <Route path="/reminders">
        <ProtectedLayout><Reminders /></ProtectedLayout>
      </Route>
      <Route path="/exports">
        <ProtectedLayout><Exports /></ProtectedLayout>
      </Route>
      <Route path="/search">
        <ProtectedLayout><Search /></ProtectedLayout>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
