import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppKitProvider } from "@/context/AppKitProvider";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import AppHome from "@/pages/app";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/app" component={AppHome} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <AppKitProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <ToastProvider />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </AppKitProvider>
  );
}

export default App;