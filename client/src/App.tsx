import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import NotFound from "@/pages/not-found";
import Navbar from "@/components/Navbar";
import CommunityBoard from "@/pages/CommunityBoard";
import IssueSubmissionForm from "@/pages/IssueSubmissionForm";
import ProjectDetails from "@/pages/ProjectDetails";
import AuthPage from "@/pages/auth-page";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AuthProvider } from "@/hooks/use-auth";

function Router() {
  const { toast } = useToast();

  // Global error handler for API requests
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && typeof event.reason.message === 'string') {
      toast({
        variant: "destructive",
        title: "Error",
        description: event.reason.message,
      });
    }
  });

  return (
    <>
      <Navbar />
      <Switch>
        <Route path="/" component={CommunityBoard} />
        <ProtectedRoute path="/submit" component={IssueSubmissionForm} />
        <Route path="/projects/:id" component={ProjectDetails} />
        <Route path="/auth" component={AuthPage} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
